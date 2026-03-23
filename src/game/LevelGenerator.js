function mulberry32(a) {
  return function() {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const TILE_TYPES = {
  EMPTY: 0,
  GROUND: 1,
  SPIKES: 2,
  MOVING_PLATFORM: 3,
  GOAL: 4
};

export class LevelGenerator {
  constructor(seed) {
    this.seed = seed;
    this.rand = mulberry32(seed);
  }

  generate(level, TILE_SIZE) {
    this.rand = mulberry32(this.seed + level * 1337);
    
    const height = 12;
    const width = 30 + Math.floor(level * 5);
    const grid = Array.from({ length: height }, () => Array(width).fill(TILE_TYPES.EMPTY));

    const placePlatform = (x, y, w) => {
      for (let i = 0; i < w; i++) {
        if (x + i < width && y >= 0 && y < height) {
          grid[y][x + i] = TILE_TYPES.GROUND;
        }
      }
    };

    // Initial safe zone — wide and flat
    const startPlatformY = height - 2;
    placePlatform(0, startPlatformY, 7);

    let lastX = 7;
    let lastY = startPlatformY;

    const maxJumpX = 4;

    while (lastX < width - 8) {
      const gap = Math.floor(this.rand() * (level < 5 ? 2 : maxJumpX)) + 2;
      const platformWidth = Math.floor(this.rand() * 4) + 2;
      const yChange = Math.floor(this.rand() * 5) - 2;
      
      let nextY = lastY + yChange;
      nextY = Math.max(4, Math.min(height - 2, nextY));

      const nextX = lastX + gap;

      if (nextX >= width - 8) break;

      if (level >= 11 && this.rand() < 0.3 && nextX + 4 < width - 8) {
        const midX = lastX + Math.floor(gap / 2);
        if (midX >= 0 && midX < width && nextY >= 0 && nextY < height) {
          grid[nextY][midX] = TILE_TYPES.MOVING_PLATFORM;
        }
        const landingX = nextX + 1;
        if (landingX < width - 8) {
          placePlatform(landingX, nextY, platformWidth);
          lastX = landingX + platformWidth;
        } else {
          break;
        }
      } else {
        placePlatform(nextX, nextY, platformWidth);
        lastX = nextX + platformWidth;
      }

      lastY = nextY;
    }

    // Goal zone — always reachable
    const goalY = Math.min(lastY, height - 2);
    placePlatform(width - 7, goalY, 7);
    grid[goalY - 1][width - 4] = TILE_TYPES.GOAL;

    // Extract moving platforms
    const movingPlatforms = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (grid[y][x] === TILE_TYPES.MOVING_PLATFORM) {
          movingPlatforms.push({
            id: `mp-${x}-${y}`,
            startX: x * TILE_SIZE,
            startY: y * TILE_SIZE,
            x: x * TILE_SIZE,
            y: y * TILE_SIZE,
            width: TILE_SIZE * 3,
            height: TILE_SIZE * 0.6,
            vx: 0,
            vy: 0,
            range: 60,
            speed: 0.0008 + (level * 0.0001),
            offset: this.rand() * Math.PI * 2
          });
          grid[y][x] = TILE_TYPES.EMPTY;
        }
      }
    }

    return {
      grid,
      width,
      height,
      playerStart: { x: 2, y: startPlatformY - 1 },
      movingPlatforms
    };
  }
}
