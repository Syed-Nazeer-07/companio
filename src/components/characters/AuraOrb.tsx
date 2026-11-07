import React from 'react';
import { CharacterState } from '../../types';

interface Props {
  state: CharacterState;
  scale?: number;
  audioLevel?: number;
}

export const AuraOrb: React.FC<Props> = ({ state, scale = 1, audioLevel = 0 }) => {
  const isSleeping = state === 'sleeping';
  const isListening = state === 'listening';
  const isThinking = state === 'thinking';
  const isSuccess = state === 'success';
  const isConfused = state === 'confused';
  const isTalking = state === 'talking';

  // Dynamic radius reacts to speech audio level
  const pulseRadius = 38 + (isTalking ? audioLevel * 14 : isThinking ? 6 : isListening ? 4 : 0);

  return (
    <div 
      className="relative flex items-center justify-center transition-transform duration-300 pointer-events-none select-none"
      style={{ transform: `scale(${scale})` }}
    >
      {/* Outer Radiating Core Glow */}
      <div 
        className={`absolute inset-0 rounded-full blur-3xl transition-all duration-500 ${
          isThinking ? 'bg-cyan-400 opacity-90 scale-125 animate-pulse' :
          isListening ? 'bg-emerald-400 opacity-80 scale-110' :
          isSuccess ? 'bg-amber-300 opacity-90 scale-130' :
          isConfused ? 'bg-rose-500 opacity-70' :
          isSleeping ? 'bg-slate-900 opacity-20 scale-75' :
          'bg-sky-500 opacity-60 animate-glow'
        }`}
      />

      <svg 
        width="160" 
        height="180" 
        viewBox="0 0 160 180" 
        className={`relative z-10 transition-all duration-300 ${
          isSuccess ? 'animate-bounce' : 
          isConfused ? 'rotate-[-5deg]' : 
          isSleeping ? 'opacity-40 translate-y-2' : 'animate-float'
        }`}
      >
        <defs>
          <radialGradient id="orbCore" cx="40%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop 
              offset="35%" 
              stopColor={
                isListening ? '#34d399' : 
                isThinking ? '#38bdf8' : 
                isSuccess ? '#fde047' : 
                isConfused ? '#f43f5e' : 
                isSleeping ? '#334155' : '#0ea5e9'
              } 
            />
            <stop 
              offset="80%" 
              stopColor={
                isListening ? '#059669' : 
                isThinking ? '#0284c7' : 
                isSuccess ? '#d97706' : 
                isConfused ? '#be123c' : 
                isSleeping ? '#0f172a' : '#0369a1'
              } 
            />
            <stop offset="100%" stopColor="#082f49" />
          </radialGradient>

          <filter id="orbBloom" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Orbiting Satellite 1 */}
        {!isSleeping && (
          <g className="animate-spin-slow origin-center" transform="rotate(45 80 90)">
            <circle cx="80" cy="30" r="5" fill="#38bdf8" filter="url(#orbBloom)" />
            <circle cx="80" cy="30" r="2" fill="#ffffff" />
          </g>
        )}

        {/* Orbiting Satellite 2 */}
        {!isSleeping && (
          <g className="animate-spin-slow origin-center" style={{ animationDirection: 'reverse', animationDuration: '8s' }} transform="rotate(-60 80 90)">
            <circle cx="80" cy="150" r="4" fill="#a855f7" filter="url(#orbBloom)" />
            <circle cx="80" cy="150" r="1.5" fill="#ffffff" />
          </g>
        )}

        {/* Orbit Path Circles */}
        <circle 
          cx="80" 
          cy="90" 
          r="58" 
          fill="none" 
          stroke="#38bdf8" 
          strokeWidth="1.2" 
          strokeDasharray="4 8" 
          opacity="0.4" 
        />
        <circle 
          cx="80" 
          cy="90" 
          r="48" 
          fill="none" 
          stroke="#818cf8" 
          strokeWidth="1" 
          strokeDasharray="8 6" 
          opacity="0.3" 
        />

        {/* Main Glowing Energy Core */}
        <circle 
          cx="80" 
          cy="90" 
          r={pulseRadius} 
          fill="url(#orbCore)" 
          filter="url(#orbBloom)" 
          className="transition-all duration-150"
        />

        {/* Specular Energy Sheen */}
        <ellipse cx="70" cy="78" rx="14" ry="7" fill="#ffffff" opacity="0.6" transform="rotate(-30 70 78)" />

        {/* Dynamic Waveform Rings when Talking */}
        {isTalking && (
          <g stroke="#ffffff" strokeWidth="2" opacity="0.7" fill="none">
            <circle cx="80" cy="90" r={pulseRadius + 6} className="animate-ping origin-center" />
          </g>
        )}

        {/* Center Iris / Status Beacon */}
        <circle 
          cx="80" 
          cy="90" 
          r={isThinking ? 10 : 7} 
          fill="#ffffff" 
          opacity="0.9" 
          className={isThinking ? 'animate-pulse' : ''}
        />

        {/* Sleeping z's */}
        {isSleeping && (
          <g fill="#94a3b8" fontSize="12" fontWeight="bold">
            <text x="105" y="70">Z</text>
            <text x="114" y="58" fontSize="9">z</text>
          </g>
        )}
      </svg>
    </div>
  );
};
