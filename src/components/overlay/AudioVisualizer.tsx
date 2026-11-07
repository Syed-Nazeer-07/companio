import React from 'react';

interface Props {
  active: boolean;
  color?: string;
}

export const AudioVisualizer: React.FC<Props> = ({ active, color = 'bg-sky-400' }) => {
  return (
    <div className="flex items-center gap-1 h-5 px-2">
      {[0.4, 0.8, 1, 0.6, 0.9, 0.5, 0.7].map((heightScale, i) => (
        <div
          key={i}
          className={`w-1 rounded-full transition-all duration-150 ${color} ${
            active ? 'animate-pulse' : 'opacity-40'
          }`}
          style={{
            height: active ? `${Math.max(4, Math.random() * 18 * heightScale)}px` : '4px',
            animationDelay: `${i * 0.1}s`,
            animationDuration: '0.6s'
          }}
        />
      ))}
    </div>
  );
};
