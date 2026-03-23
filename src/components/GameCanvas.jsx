import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Player } from '../game/Player';
import { LevelGenerator, TILE_TYPES } from '../game/LevelGenerator';
import { TILE_SIZE } from '../game/collision';

const DEATH_DELAY = 2000;
const WIN_DELAY = 2500;

const GameCanvas = ({ level, onLevelComplete, onRestart, score, setScore }) => {
  const canvasRef = useRef(null);
  const requestRef = useRef();
  const playerRef = useRef(new Player(100, 100));
  const levelDataRef = useRef(null);
  const keysRef = useRef({});
  const cameraRef = useRef({ x: 0, y: 0 });
  const gameStateRef = useRef('playing');
  const overlayTimerRef = useRef(0);
  const [, forceRender] = useState(0);

  const generator = useRef(new LevelGenerator(12345));

  // Initialize Level
  useEffect(() => {
    const data = generator.current.generate(level, TILE_SIZE);
    levelDataRef.current = data;
    playerRef.current.reset(data.playerStart.x * TILE_SIZE, data.playerStart.y * TILE_SIZE);
    gameStateRef.current = 'playing';
    overlayTimerRef.current = 0;
    cameraRef.current = { x: 0, y: 0 };
  }, [level]);

  // Input
  useEffect(() => {
    const handleKeyDown = (e) => {
      e.preventDefault();
      keysRef.current[e.key] = true;
    };
    const handleKeyUp = (e) => {
      keysRef.current[e.key] = false;
    };
    // Clear all keys when window loses focus (prevents stuck keys)
    const handleBlur = () => {
      keysRef.current = {};
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  // Game Loop — runs continuously, even during overlays
  const update = useCallback(() => {
    const state = gameStateRef.current;
    const player = playerRef.current;
    const levelData = levelDataRef.current;

    if (!levelData) {
      requestRef.current = requestAnimationFrame(update);
      return;
    }

    const { grid, movingPlatforms } = levelData;

    // Always update moving platforms for visual continuity
    if (movingPlatforms) {
      movingPlatforms.forEach(p => {
        const oldX = p.x;
        p.x = p.startX + Math.sin(Date.now() * p.speed + p.offset) * p.range;
        p.vx = p.x - oldX;
        p.vy = 0;
      });
    }

    if (state === 'playing') {
      player.update(keysRef.current, grid, movingPlatforms);

      if (player.dead) {
        gameStateRef.current = 'dead';
        overlayTimerRef.current = Date.now();
      } else if (player.win) {
        gameStateRef.current = 'win';
        overlayTimerRef.current = Date.now();
      }

      // Camera
      const targetCameraX = player.x - 400;
      cameraRef.current.x += (targetCameraX - cameraRef.current.x) * 0.1;
      cameraRef.current.x = Math.max(0, Math.min(cameraRef.current.x, (levelData.width * TILE_SIZE) - 800));
    } else if (state === 'dead') {
      const elapsed = Date.now() - overlayTimerRef.current;
      if (elapsed > DEATH_DELAY) {
        player.reset(levelData.playerStart.x * TILE_SIZE, levelData.playerStart.y * TILE_SIZE);
        gameStateRef.current = 'playing';
        onRestart();
      }
    } else if (state === 'win') {
      const elapsed = Date.now() - overlayTimerRef.current;
      if (elapsed > WIN_DELAY) {
        onLevelComplete();
      }
    }

    draw();
    requestRef.current = requestAnimationFrame(update);
  }, [onLevelComplete, onRestart]);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const levelData = levelDataRef.current;
    if (!levelData) return;

    const { grid, width, height } = levelData;
    const offsetX = cameraRef.current.x;
    const state = gameStateRef.current;

    // Background
    ctx.fillStyle = '#1e272e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grid lines
    ctx.strokeStyle = '#2d3436';
    ctx.lineWidth = 1;
    for (let i = 0; i < canvas.width; i += TILE_SIZE) {
      const lx = i - (offsetX % TILE_SIZE);
      ctx.beginPath(); ctx.moveTo(lx, 0); ctx.lineTo(lx, canvas.height); ctx.stroke();
    }

    // Tiles
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const tile = grid[y][x];
        if (tile === TILE_TYPES.EMPTY) continue;
        const tx = x * TILE_SIZE - offsetX;
        const ty = y * TILE_SIZE;
        if (tx + TILE_SIZE < 0 || tx > canvas.width) continue;

        if (tile === TILE_TYPES.GROUND) {
          ctx.fillStyle = '#0fbcf9';
          ctx.fillRect(tx, ty, TILE_SIZE, TILE_SIZE);
          ctx.strokeStyle = '#1e90ff';
          ctx.strokeRect(tx + 1, ty + 1, TILE_SIZE - 2, TILE_SIZE - 2);
        } else if (tile === TILE_TYPES.SPIKES) {
          ctx.fillStyle = '#ff3f34';
          ctx.beginPath();
          ctx.moveTo(tx, ty + TILE_SIZE);
          ctx.lineTo(tx + TILE_SIZE / 2, ty);
          ctx.lineTo(tx + TILE_SIZE, ty + TILE_SIZE);
          ctx.fill();
        } else if (tile === TILE_TYPES.GOAL) {
          ctx.fillStyle = '#05c46b';
          ctx.fillRect(tx, ty, TILE_SIZE, TILE_SIZE);
          // Pulsing inner square
          const pulse = (Math.sin(Date.now() / 300) + 1) / 2;
          ctx.fillStyle = `rgba(85, 239, 196, ${0.4 + pulse * 0.6})`;
          ctx.fillRect(tx + 8, ty + 8, TILE_SIZE - 16, TILE_SIZE - 16);
        }
      }
    }

    // Moving Platforms
    const mps = levelData.movingPlatforms;
    if (mps) {
      for (const p of mps) {
        const tx = p.x - offsetX;
        if (tx + p.width < 0 || tx > canvas.width) continue;
        ctx.fillStyle = '#ffd32a';
        ctx.fillRect(tx, p.y, p.width, p.height);
        ctx.fillStyle = '#e1b12c';
        ctx.fillRect(tx, p.y + p.height - 3, p.width, 3);
      }
    }

    // Player
    playerRef.current.draw(ctx, offsetX);

    // ========= ANIMATED OVERLAYS =========

    if (state === 'dead') {
      const elapsed = Date.now() - overlayTimerRef.current;
      const progress = Math.min(elapsed / DEATH_DELAY, 1);

      // Fade-in dark overlay
      const fadeAlpha = Math.min(progress * 2, 0.7);
      ctx.fillStyle = `rgba(30, 0, 0, ${fadeAlpha})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Sliding-in "GAME OVER" text
      const textProgress = Math.min(progress * 3, 1);
      const eased = 1 - Math.pow(1 - textProgress, 3); // ease-out cubic
      const textY = canvas.height / 2 - 20 + (1 - eased) * 60;

      ctx.globalAlpha = eased;
      ctx.fillStyle = '#ff4757';
      ctx.font = 'bold 52px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('GAME OVER', canvas.width / 2, textY);

      // Subtext with delay
      if (progress > 0.4) {
        const subProgress = Math.min((progress - 0.4) / 0.3, 1);
        ctx.globalAlpha = subProgress;
        ctx.fillStyle = '#dfe6e9';
        ctx.font = '18px Inter, sans-serif';
        ctx.fillText('Restarting...', canvas.width / 2, textY + 40);
      }

      // Progress bar at bottom
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = '#ff4757';
      ctx.fillRect(0, canvas.height - 6, canvas.width * progress, 6);

      ctx.globalAlpha = 1;

    } else if (state === 'win') {
      const elapsed = Date.now() - overlayTimerRef.current;
      const progress = Math.min(elapsed / WIN_DELAY, 1);

      // Fade-in overlay
      const fadeAlpha = Math.min(progress * 2, 0.7);
      ctx.fillStyle = `rgba(0, 30, 10, ${fadeAlpha})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Bouncing "LEVEL COMPLETE" text
      const textProgress = Math.min(progress * 2.5, 1);
      const bounce = 1 - Math.pow(1 - textProgress, 3);
      const textY = canvas.height / 2 - 20 + (1 - bounce) * 80;

      ctx.globalAlpha = bounce;
      ctx.fillStyle = '#05c46b';
      ctx.font = 'bold 52px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('LEVEL COMPLETE!', canvas.width / 2, textY);

      // Stars animation
      if (progress > 0.3) {
        const starProgress = Math.min((progress - 0.3) / 0.4, 1);
        ctx.globalAlpha = starProgress;
        ctx.fillStyle = '#ffd32a';
        ctx.font = '36px sans-serif';
        const spread = starProgress * 120;
        ctx.fillText('★', canvas.width / 2 - spread, textY + 50);
        ctx.fillText('★', canvas.width / 2, textY + 40);
        ctx.fillText('★', canvas.width / 2 + spread, textY + 50);
      }

      // Sub text
      if (progress > 0.5) {
        const subProgress = Math.min((progress - 0.5) / 0.3, 1);
        ctx.globalAlpha = subProgress;
        ctx.fillStyle = '#dfe6e9';
        ctx.font = '18px Inter, sans-serif';
        ctx.fillText('Loading next level...', canvas.width / 2, textY + 90);
      }

      // Progress bar at bottom
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = '#05c46b';
      ctx.fillRect(0, canvas.height - 6, canvas.width * progress, 6);

      ctx.globalAlpha = 1;
    }
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(update);
    return () => cancelAnimationFrame(requestRef.current);
  }, [update]);

  return (
    <div className="game-container">
      <canvas ref={canvasRef} width={800} height={480} className="game-canvas" />
    </div>
  );
};

export default GameCanvas;
