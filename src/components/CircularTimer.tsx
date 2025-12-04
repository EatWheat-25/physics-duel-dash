import { useEffect, useState } from 'react';

interface CircularTimerProps {
  timeLeft: number;
  totalTime: number;
  size?: number;
}

export function CircularTimer({ timeLeft, totalTime, size = 60 }: CircularTimerProps) {
  const [strokeColor, setStrokeColor] = useState('#06b6d4');
  
  // Calculate circumference (2 * π * r, where r = 26 for viewBox="0 0 60 60")
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  
  // Calculate progress (0 to 1)
  const progress = timeLeft / totalTime;
  const offset = circumference - (progress * circumference);
  
  // Update stroke color based on time remaining
  useEffect(() => {
    if (timeLeft <= 5) {
      setStrokeColor('#ef4444'); // Red
    } else if (timeLeft <= 10) {
      setStrokeColor('#f59e0b'); // Gold/Warning
    } else {
      setStrokeColor('#06b6d4'); // Cyan
    }
  }, [timeLeft]);
  
  return (
    <div className="circular-timer" style={{ width: size, height: size }}>
      <svg 
        className="timer-ring" 
        viewBox="0 0 60 60"
        style={{ width: '100%', height: '100%' }}
      >
        {/* Background circle */}
        <circle
          className="timer-circle"
          cx="30"
          cy="30"
          r={radius}
        />
        {/* Progress circle */}
        <circle
          className="timer-progress"
          cx="30"
          cy="30"
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ 
            stroke: strokeColor,
            strokeDasharray: circumference,
            strokeDashoffset: offset
          }}
        />
      </svg>
      {/* Timer text */}
      <div className="timer-text">
        {timeLeft}
      </div>
    </div>
  );
}


