import { useState, useCallback } from 'react';
import GameCanvas from './components/GameCanvas';
import './App.css';

function App() {
  const [level, setLevel] = useState(1);
  const [score, setScore] = useState(0);
  const [gameComplete, setGameComplete] = useState(false);

  const handleLevelComplete = useCallback(() => {
    setLevel(prev => {
      const next = prev + 1;
      if (next > 20) {
        setGameComplete(true);
        return 1;
      }
      return next;
    });
    setScore(prev => prev + 1000);
  }, []);

  const handleRestart = useCallback(() => {
    setScore(prev => Math.max(0, prev - 100));
  }, []);

  const handleSkipLevel = useCallback(() => {
    setLevel(prev => {
      const next = prev + 1;
      if (next > 20) return 1;
      return next;
    });
    setScore(prev => Math.max(0, prev - 500));
  }, []);

  const handleFullRestart = useCallback(() => {
    setLevel(1);
    setScore(0);
    setGameComplete(false);
  }, []);

  const totalScore = Math.floor(score / 60);

  if (gameComplete) {
    return (
      <div className="app-root">
        <div className="game-complete-screen">
          <div className="complete-title">🎉 YOU WIN! 🎉</div>
          <div className="complete-subtitle">All 20 levels completed!</div>
          <div className="complete-score">Final Score: {totalScore}</div>
          <button className="restart-btn play-again-btn" onClick={handleFullRestart}>
            PLAY AGAIN
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-root">
      <header className="game-header">
        <div className="stat-box">
          <span className="label">LEVEL</span>
          <span className="value">{level}</span>
        </div>
        <div className="game-title">2D Platformer</div>
        <div className="stat-box">
          <span className="label">SCORE</span>
          <span className="value">{totalScore}</span>
        </div>
      </header>

      <main className="game-wrapper">
        <div className="game-toolbar">
          <button className="skip-btn" onClick={handleSkipLevel}>SKIP LEVEL ⏭️</button>
        </div>
        <GameCanvas 
          level={level} 
          onLevelComplete={handleLevelComplete}
          onRestart={handleRestart}
          score={score}
          setScore={setScore}
        />
        <div className="controls-hint">
          <span>[W/A/S/D] or [Arrows] to Move & Jump</span>
        </div>
      </main>

      <footer className="game-footer">
        <button className="restart-btn" onClick={handleFullRestart}>
          RESTART GAME
        </button>
      </footer>
    </div>
  );
}

export default App;
