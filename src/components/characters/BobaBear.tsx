import React from 'react';
import { CharacterState } from '../../types';

interface Props {
  state: CharacterState;
  scale?: number;
  audioLevel?: number;
}

export const BobaBear: React.FC<Props> = ({ state, scale = 1, audioLevel = 0 }) => {
  const isSleeping = state === 'sleeping';
  const isListening = state === 'listening';
  const isThinking = state === 'thinking';
  const isSuccess = state === 'success';
  const isConfused = state === 'confused';
  const mouthHeight = state === 'talking' ? Math.max(3, 3 + audioLevel * 10) : 2.5;

  return (
    <div 
      className="relative flex items-center justify-center transition-transform duration-300 pointer-events-none select-none"
      style={{ transform: `scale(${scale})` }}
    >
      {/* Warm Caramel Glow */}
      <div 
        className={`absolute inset-0 rounded-full blur-2xl transition-all duration-500 opacity-60 ${
          isThinking ? 'bg-amber-300 animate-pulse' :
          isListening ? 'bg-emerald-300 scale-110' :
          isSuccess ? 'bg-yellow-300 scale-125' :
          isConfused ? 'bg-rose-300' :
          isSleeping ? 'bg-amber-950 opacity-20' :
          'bg-orange-300 opacity-50'
        }`}
      />

      <svg 
        width="160" 
        height="180" 
        viewBox="0 0 160 180" 
        className={`relative z-10 transition-all duration-300 drop-shadow-[0_10px_20px_rgba(0,0,0,0.15)] ${
          isSuccess ? 'animate-bounce' : 
          isConfused ? 'rotate-[-8deg]' : 
          isSleeping ? 'opacity-85 translate-y-3' : 'animate-float'
        }`}
      >
        <defs>
          <linearGradient id="teaGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#fed7aa" />
            <stop offset="50%" stopColor="#fdba74" />
            <stop offset="100%" stopColor="#fb923c" />
          </linearGradient>
          <linearGradient id="cupGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
            <stop offset="50%" stopColor="#ffffff" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.8" />
          </linearGradient>
        </defs>

        {/* Diagonal Striped Boba Straw */}
        <polygon points="95,15 106,12 88,65 77,68" fill="#f43f5e" />
        <line x1="97" y1="25" x2="87" y2="45" stroke="#ffffff" strokeWidth="4" />

        {/* Bear Ears on Cup Lid */}
        <ellipse cx="46" cy="52" rx="12" ry="12" fill="#fdba74" stroke="#ea580c" strokeWidth="1.5" />
        <ellipse cx="46" cy="52" rx="6" ry="6" fill="#fca5a5" />

        <ellipse cx="114" cy="52" rx="12" ry="12" fill="#fdba74" stroke="#ea580c" strokeWidth="1.5" />
        <ellipse cx="114" cy="52" rx="6" ry="6" fill="#fca5a5" />

        {/* Dome Cup Lid */}
        <path d="M35 62 Q80 40 125 62 Z" fill="#ffffff" stroke="#e2e8f0" strokeWidth="2" />
        <rect x="30" y="60" width="100" height="8" rx="4" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.5" />

        {/* Cup Body */}
        <polygon points="40,66 120,66 110,155 50,155" fill="url(#cupGrad)" stroke="#cbd5e1" strokeWidth="1.5" />
        {/* Milk Tea Liquid Fill inside cup */}
        <polygon points="43,80 117,80 108,152 52,152" fill="url(#teaGrad)" />

        {/* Tapioca Boba Pearls */}
        <g fill="#431407" className={isSuccess ? 'animate-bounce' : ''}>
          <circle cx="62" cy="140" r="7" />
          <circle cx="78" cy="142" r="7" />
          <circle cx="95" cy="138" r="7" />
          <circle cx="70" cy="130" r="6" />
          <circle cx="88" cy="128" r="6" />
          {/* Pearl glints */}
          <circle cx="60" cy="138" r="1.5" fill="#ffffff" opacity="0.6" />
          <circle cx="76" cy="140" r="1.5" fill="#ffffff" opacity="0.6" />
          <circle cx="93" cy="136" r="1.5" fill="#ffffff" opacity="0.6" />
        </g>

        {/* Blush Cheeks */}
        <ellipse cx="58" cy="108" rx="6" ry="4" fill="#f43f5e" opacity={isSuccess ? 0.75 : 0.5} />
        <ellipse cx="102" cy="108" rx="6" ry="4" fill="#f43f5e" opacity={isSuccess ? 0.75 : 0.5} />

        {/* Eyes on Cup Face */}
        {isSleeping ? (
          <g stroke="#431407" strokeWidth="2.5" strokeLinecap="round" fill="none">
            <path d="M60 100 Q68 106 76 100" />
            <path d="M84 100 Q92 106 100 100" />
            <text x="110" y="75" fill="#ea580c" fontSize="12" fontWeight="bold">z</text>
            <text x="118" y="65" fill="#ea580c" fontSize="9" opacity="0.6">z</text>
          </g>
        ) : isSuccess ? (
          <g stroke="#7c2d12" strokeWidth="3" strokeLinecap="round" fill="none">
            <path d="M60 100 Q68 92 76 100" />
            <path d="M84 100 Q92 92 100 100" />
            <text x="110" y="75" fill="#f59e0b" fontSize="14">✨</text>
          </g>
        ) : isConfused ? (
          <g>
            <circle cx="68" cy="98" r="6" fill="#1e293b" />
            <circle cx="66" cy="96" r="2" fill="#ffffff" />
            <path d="M84 100 Q92 96 100 100" stroke="#1e293b" strokeWidth="2.5" strokeLinecap="round" fill="none" />
            <text x="112" y="80" fill="#f43f5e" fontSize="14" fontWeight="bold">?</text>
          </g>
        ) : (
          <g>
            {/* Left Eye */}
            <circle cx="68" cy="98" r={isListening ? 7 : 6} fill="#1e293b" />
            <circle cx="66" cy="96" r="2.5" fill="#ffffff" />

            {/* Right Eye */}
            <circle cx="92" cy="98" r={isListening ? 7 : 6} fill="#1e293b" />
            <circle cx="90" cy="96" r="2.5" fill="#ffffff" />
          </g>
        )}

        {/* Cute Smile */}
        {state === 'talking' ? (
          <ellipse cx="80" cy="110" rx="4" ry={mouthHeight} fill="#be123c" />
        ) : isSuccess ? (
          <path d="M75 108 Q80 115 85 108" stroke="#431407" strokeWidth="2" strokeLinecap="round" fill="none" />
        ) : (
          <path d="M76 108 Q80 112 84 108" stroke="#431407" strokeWidth="2" strokeLinecap="round" fill="none" />
        )}
      </svg>
    </div>
  );
};
