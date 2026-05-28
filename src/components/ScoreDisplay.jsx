import { useState, useEffect, useRef } from 'react';

export default function ScoreDisplay({ score, maxScore = 10 }) {
  const [displayScore, setDisplayScore] = useState(0);
  const previousScore = useRef(0);

  useEffect(() => {
    const start = previousScore.current;
    const end = score;
    const duration = 400;
    const startTime = performance.now();

    function animate(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = start + (end - start) * eased;
      setDisplayScore(current);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        previousScore.current = end;
      }
    }

    requestAnimationFrame(animate);
  }, [score]);

  // Color transitions based on score
  function getScoreColor(s) {
    if (s <= 3) return '#DC5A5A'; // soft red
    if (s <= 6) return '#E8A020'; // golden amber
    return '#2F9E4A'; // soft green
  }

  const color = getScoreColor(score);
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const percentage = (score / maxScore) * 100;
  const strokeOffset = circumference * (1 - percentage / 100);

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: 100, height: 100 }}>
        {/* Background circle */}
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="rgba(0, 0, 0, 0.05)"
            strokeWidth="7"
          />
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeOffset}
            style={{
              transition: 'stroke-dashoffset 0.7s ease-out, stroke 0.5s ease',
            }}
          />
        </svg>
        {/* Score number */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="text-[28px] font-bold tabular-nums"
            style={{ color, transition: 'color 0.3s ease' }}
          >
            {displayScore.toFixed(1)}
          </span>
        </div>
      </div>
      <p className="mt-3 text-[11px] text-navy-500 font-medium uppercase tracking-widest">
        Sage's overall understanding
      </p>
    </div>
  );
}
