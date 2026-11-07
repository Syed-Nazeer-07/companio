import React from 'react';
import { CharacterState } from '../../types';

interface Props {
  state: CharacterState;
  scale?: number;
  audioLevel?: number;
}

export const CloudieDream: React.FC<Props> = ({ state, scale = 1, audioLevel = 0 }) => {
  const isSleeping = state === 'sleeping';
  const isListening = state === 'listening';
  const isThinking = state === 'thinking';
  const isSuccess = state === 'success';
  const isConfused = state === 'confused';
  const mouthHeight = state === 'talking' ? Math.max(4, 4 + audioLevel * 12) : 2.5;

  return (
    <div 
      className="relative flex items-center justify-center transition-transform duration-300 pointer-events-none select-none"
      style={{ transform: `scale(${scale})` }}
    >
      {/* Soft Pastel Cloud Glow */}
      <div 
        className={`absolute inset-0 rounded-full blur-2xl transition-all duration-500 opacity-60 ${
          isThinking ? 'bg-sky-300 animate-pulse' :
          isListening ? 'bg-emerald-300 scale-110' :
          isSuccess ? 'bg-yellow-300 scale-125' :
          isConfused ? 'bg-rose-300' :
          isSleeping ? 'bg-indigo-950 opacity-20' :
          'bg-pink-300 opacity-50'
        }`}
      />

      <svg 
        width="170" 
        height="180" 
        viewBox="0 0 170 180" 
        className={`relative z-10 transition-all duration-300 drop-shadow-[0_10px_20px_rgba(0,0,0,0.15)] ${
          isSuccess ? 'animate-bounce' : 
          isConfused ? 'rotate-[-8deg]' : 
          isSleeping ? 'opacity-85 translate-y-3' : 'animate-float'
        }`}
      >
        <defs>
          <linearGradient id="cloudGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="60%" stopColor="#f8fafc" />
            <stop offset="100%" stopColor="#e0f2fe" />
          </linearGradient>
          <linearGradient id="rainbowAura" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f472b6" />
            <stop offset="50%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#fde047" />
          </linearGradient>
        </defs>

        {/* Orbiting Tiny Smiling Star Friend */}
        {!isSleeping && (
          <g className="animate-spin-slow origin-center" transform="rotate(35 85 90)">
            <g transform="translate(130, 45)">
              <polygon points="0,-7 2,-2 7,0 2,2 0,7 -2,2 -7,0 -2,-2" fill="#facc15" />
              <circle cx="-1.5" cy="-0.5" r="0.8" fill="#713f12" />
              <circle cx="1.5" cy="-0.5" r="0.8" fill="#713f12" />
            </g>
          </g>
        )}

        {/* Fluffy Cloud Body */}
        <g>
          {/* Back puffs */}
          <circle cx="55" cy="85" r="30" fill="url(#cloudGrad)" />
          <circle cx="115" cy="85" r="30" fill="url(#cloudGrad)" />
          <circle cx="85" cy="65" r="34" fill="url(#cloudGrad)" />
          {/* Main center puff */}
          <ellipse cx="85" cy="98" rx="55" ry="32" fill="url(#cloudGrad)" />
          <circle cx="68" cy="95" r="28" fill="url(#cloudGrad)" />
          <circle cx="102" cy="95" r="28" fill="url(#cloudGrad)" />
        </g>

        {/* Soft Pink Blush Cheeks */}
        <ellipse cx="56" cy="98" rx="8" ry="5" fill="#f472b6" opacity={isSuccess ? 0.75 : 0.5} />
        <ellipse cx="114" cy="98" rx="8" ry="5" fill="#f472b6" opacity={isSuccess ? 0.75 : 0.5} />

        {/* Eyes */}
        {isSleeping ? (
          <g stroke="#334155" strokeWidth="2.5" strokeLinecap="round" fill="none">
            <path d="M62 90 Q70 96 78 90" />
            <path d="M92 90 Q100 96 108 90" />
            <text x="120" y="55" fill="#38bdf8" fontSize="13" fontWeight="bold">z</text>
            <text x="128" y="44" fill="#38bdf8" fontSize="10" opacity="0.6">z</text>
          </g>
        ) : isSuccess ? (
          <g stroke="#0284c7" strokeWidth="3.5" strokeLinecap="round" fill="none">
            <path d="M62 90 Q70 82 78 90" />
            <path d="M92 90 Q100 82 108 90" />
            <text x="120" y="55" fill="#f59e0b" fontSize="14">✨</text>
          </g>
        ) : isConfused ? (
          <g>
            <circle cx="70" cy="88" r="7" fill="#0f172a" />
            <circle cx="68" cy="86" r="2.5" fill="#ffffff" />
            {/* Wavy line for other eye */}
            <path d="M92 90 Q100 86 108 90" stroke="#0f172a" strokeWidth="3" fill="none" strokeLinecap="round" />
            <text x="120" y="65" fill="#f43f5e" fontSize="16" fontWeight="bold">?</text>
          </g>
        ) : (
          <g>
            {/* Left Eye */}
            <circle cx="70" cy="88" r={isListening ? 7.5 : 6.5} fill="#0f172a" />
            <circle cx="68" cy="86" r="2.5" fill="#ffffff" />
            <circle cx="72" cy="90" r="1" fill="#ffffff" />

            {/* Right Eye */}
            <circle cx="100" cy="88" r={isListening ? 7.5 : 6.5} fill="#0f172a" />
            <circle cx="98" cy="86" r="2.5" fill="#ffffff" />
            <circle cx="102" cy="90" r="1" fill="#ffffff" />
          </g>
        )}

        {/* Cute Smiling Mouth */}
        {state === 'talking' ? (
          <ellipse cx="85" cy="100" rx="5" ry={mouthHeight} fill="#f43f5e" stroke="#9f1239" strokeWidth="1" />
        ) : isSuccess ? (
          <path d="M80 97 Q85 106 90 97" stroke="#0f172a" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        ) : (
          <path d="M81 98 Q85 102 89 98" stroke="#0f172a" strokeWidth="2" strokeLinecap="round" fill="none" />
        )}

        {/* Tiny Floating Rainbow Sparkle Dots */}
        <circle cx="48" cy="65" r="2" fill="#38bdf8" opacity="0.6" />
        <circle cx="122" cy="65" r="2" fill="#ec4899" opacity="0.6" />
        <circle cx="85" cy="42" r="2.5" fill="#facc15" opacity="0.7" />
      </svg>
    </div>
  );
};
