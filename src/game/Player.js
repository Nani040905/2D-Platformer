import { TILE_SIZE } from './collision';

export class Player {
  constructor(x, y) {
    this.startX = x;
    this.startY = y;
    this.x = x;
    this.y = y;
    this.width = 30;
    this.height = 40;
    this.vx = 0;
    this.vy = 0;
    this.onGround = false;
    this.dead = false;
    this.win = false;

    // Movement Physics
    this.gravity = 0.4;
    this.maxSpeed = 4;
    this.acceleration = 0.4;
    this.friction = 0.85;
    this.jumpPower = -12;
    this.minJumpPower = -4;

    // Pro Mechanics
    this.coyoteTimeMax = 10;
    this.coyoteTimeCounter = 0;
    this.jumpBufferMax = 10;
    this.jumpBufferCounter = 0;

    this.faceDirection = 1;
  }

  reset(x, y) {
    this.x = x !== undefined ? x : this.startX;
    this.y = y !== undefined ? y : this.startY;
    this.vx = 0;
    this.vy = 0;
    this.onGround = false;
    this.dead = false;
    this.win = false;
    this.coyoteTimeCounter = 0;
    this.jumpBufferCounter = 0;
  }

  update(keys, grid, movingPlatforms = []) {
    if (this.dead || this.win) return;

    let horizontalInput = 0;
    if (keys['ArrowLeft'] || keys['a']) horizontalInput = -1;
    else if (keys['ArrowRight'] || keys['d']) horizontalInput = 1;

    if (horizontalInput !== 0) {
      this.vx += horizontalInput * this.acceleration;
      this.faceDirection = horizontalInput;
    } else {
      this.vx *= this.friction;
      // Stop micro-movements
      if (Math.abs(this.vx) < 0.1) this.vx = 0;
    }

    this.vx = Math.max(-this.maxSpeed, Math.min(this.maxSpeed, this.vx));

    // Coyote time
    if (this.onGround) {
      this.coyoteTimeCounter = this.coyoteTimeMax;
    } else {
      this.coyoteTimeCounter--;
    }

    // Jump buffer
    if (keys['ArrowUp'] || keys['w'] || keys[' ']) {
      this.jumpBufferCounter = this.jumpBufferMax;
    } else {
      this.jumpBufferCounter--;
    }

    // Execute jump
    if (this.jumpBufferCounter > 0 && this.coyoteTimeCounter > 0) {
      this.vy = this.jumpPower;
      this.onGround = false;
      this.coyoteTimeCounter = 0;
      this.jumpBufferCounter = 0;
    }

    // Variable jump height — release early for shorter jump
    if (this.vy < this.minJumpPower && !(keys['ArrowUp'] || keys['w'] || keys[' '])) {
      this.vy = this.minJumpPower;
    }

    // Gravity
    this.vy += this.gravity;

    // Cap fall speed to prevent tunneling through platforms
    if (this.vy > 15) this.vy = 15;

    // Void death
    if (this.y > grid.length * TILE_SIZE + TILE_SIZE * 2) {
      this.dead = true;
      return;
    }

    // Prevent going left of level start
    if (this.x < 0) { this.x = 0; this.vx = 0; }

    // Prevent going right past level end
    const levelWidth = grid[0].length * TILE_SIZE;
    if (this.x + this.width > levelWidth) { this.x = levelWidth - this.width; this.vx = 0; }

    // Move X
    this.x += this.vx;
    let collisionX = this.resolveCollisions(grid, 'x');
    this.resolveMovingPlatformCollisions(movingPlatforms, 'x');

    // Move Y
    this.y += this.vy;
    let collisionY = this.resolveCollisions(grid, 'y');
    let mPlatform = this.resolveMovingPlatformCollisions(movingPlatforms, 'y');

    this.onGround = collisionY.onGround || mPlatform.onGround;

    if (collisionY.dead || collisionX.dead) this.dead = true;
    if (collisionY.win || collisionX.win) this.win = true;

    // Inherit platform velocity
    if (mPlatform.platform) {
      this.x += mPlatform.platform.vx;
    }
  }

  resolveMovingPlatformCollisions(platforms, axis) {
    const results = { onGround: false, platform: null };
    for (const p of platforms) {
      if (this.checkCollision(this, p)) {
        if (axis === 'x') {
          const playerBottom = this.y + this.height;
          const platformTop = p.y;
          const isAbovePlatform = playerBottom - platformTop < 10;
          if (!isAbovePlatform) {
            if (this.vx > 0) this.x = p.x - this.width;
            else if (this.vx < 0) this.x = p.x + p.width;
            this.vx = 0;
          }
        } else {
          if (this.vy >= 0) {
            this.y = p.y - this.height;
            this.vy = 0;
            results.onGround = true;
            results.platform = p;
          } else if (this.vy < 0) {
            this.y = p.y + p.height;
            this.vy = 0;
          }
        }
      }
    }
    return results;
  }

  checkCollision(r1, r2) {
    return (
      r1.x < r2.x + r2.width &&
      r1.x + r1.width > r2.x &&
      r1.y < r2.y + r2.height &&
      r1.y + r1.height > r2.y
    );
  }

  resolveCollisions(grid, axis) {
    const results = { onGround: false, dead: false, win: false };
    const startX = Math.floor(this.x / TILE_SIZE);
    const endX = Math.floor((this.x + this.width - 1) / TILE_SIZE);
    const startY = Math.floor(this.y / TILE_SIZE);
    const endY = Math.floor((this.y + this.height - 1) / TILE_SIZE);

    for (let y = startY; y <= endY; y++) {
      for (let x = startX; x <= endX; x++) {
        if (y < 0 || y >= grid.length || x < 0 || x >= grid[0].length) continue;

        const tile = grid[y][x];
        if (tile === 0) continue;

        if (tile === 2) { results.dead = true; continue; }
        if (tile === 4) { results.win = true; continue; }

        if (tile === 1) {
          const tileRect = { x: x * TILE_SIZE, y: y * TILE_SIZE, width: TILE_SIZE, height: TILE_SIZE };
          if (axis === 'x') {
            if (this.vx > 0) { this.x = tileRect.x - this.width; this.vx = 0; }
            else if (this.vx < 0) { this.x = tileRect.x + tileRect.width; this.vx = 0; }
          } else {
            if (this.vy > 0) { this.y = tileRect.y - this.height; this.vy = 0; results.onGround = true; }
            else if (this.vy < 0) { this.y = tileRect.y + tileRect.height; this.vy = 0; }
          }
        }
      }
    }
    return results;
  }

  draw(ctx, offsetX = 0) {
    ctx.fillStyle = '#ff4757';
    ctx.fillRect(this.x - offsetX, this.y, this.width, this.height);

    // Eye
    ctx.fillStyle = 'white';
    const eyeSize = 6;
    const eyeY = this.y + 10;
    if (this.faceDirection === 1) {
      ctx.fillRect(this.x - offsetX + 20, eyeY, eyeSize, eyeSize);
    } else {
      ctx.fillRect(this.x - offsetX + 4, eyeY, eyeSize, eyeSize);
    }
  }
}
