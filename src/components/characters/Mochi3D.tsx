import React from 'react';
import { CharacterState } from '../../types';

interface Props {
  state: CharacterState;
  scale?: number;
  audioLevel?: number;
}

export const Mochi3D: React.FC<Props> = ({ state, scale = 1, audioLevel = 0 }) => {
  const isSleeping = state === 'sleeping';
  const isListening = state === 'listening';
  const isThinking = state === 'thinking';
  const isSuccess = state === 'success';
  const isConfused = state === 'confused';
  const mouthHeight = state === 'talking' ? Math.max(4, 4 + audioLevel * 12) : 3;

  return (
    <div 
      className="relative flex items-center justify-center transition-transform duration-300 pointer-events-none select-none"
      style={{ transform: `scale(${scale})` }}
    >
      {/* Soft Ambient Shadow & Glow */}
      <div 
        className={`absolute inset-0 rounded-full blur-2xl transition-all duration-500 opacity-60 ${
          isThinking ? 'bg-amber-300 animate-pulse' :
          isListening ? 'bg-emerald-300 scale-110' :
          isSuccess ? 'bg-yellow-400 scale-125' :
          isConfused ? 'bg-rose-400' :
          isSleeping ? 'bg-slate-800 opacity-20' :
          'bg-rose-300 opacity-50'
        }`}
      />

      <svg 
        width="160" 
        height="180" 
        viewBox="0 0 160 180" 
        className={`relative z-10 transition-all duration-300 drop-shadow-[0_12px_24px_rgba(0,0,0,0.35)] ${
          isSuccess ? 'animate-bounce' : 
          isConfused ? 'rotate-[-8deg]' : 
          isSleeping ? 'opacity-85 translate-y-3' : 'animate-float'
        }`}
      >
        <defs>
          {/* 3D Radial Sphere Shading for Mochi */}
          <radialGradient id="mochiShading" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="40%" stopColor="#fed7aa" />
            <stop offset="85%" stopColor="#fb923c" />
            <stop offset="100%" stopColor="#ea580c" />
          </radialGradient>
          <radialGradient id="earShading" cx="30%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#ffedd5" />
            <stop offset="80%" stopColor="#f97316" />
            <stop offset="100%" stopColor="#c2410c" />
          </radialGradient>
          <radialGradient id="cheekGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#f43f5e" stopOpacity="0" />
          </radialGradient>
          <filter id="softShadow">
            <feDropShadow dx="0" dy="8" stdDeviation="6" floodOpacity="0.25" />
          </filter>
        </defs>

        {/* Floating Crown / Star Antenna */}
        <g className="animate-pulse">
          <circle cx="80" cy="22" r="7" fill={isListening ? '#10b981' : isSuccess ? '#facc15' : '#fbbf24'} filter="url(#softShadow)" />
          <path d="M80 12 L82 19 L89 19 L83 23 L85 30 L80 25 L75 30 L77 23 L71 19 L78 19 Z" fill="#ffffff" opacity="0.9" />
          <line x1="80" y1="30" x2="80" y2="40" stroke="#f97316" strokeWidth="3" strokeLinecap="round" />
        </g>

        {/* Small Bunny / Bear Ears */}
        <ellipse cx="48" cy="48" rx="14" ry="20" fill="url(#earShading)" transform="rotate(-20 48 48)" />
        <ellipse cx="48" cy="48" rx="7" ry="12" fill="#fda4af" transform="rotate(-20 48 48)" />

        <ellipse cx="112" cy="48" rx="14" ry="20" fill="url(#earShading)" transform="rotate(20 112 48)" />
        <ellipse cx="112" cy="48" rx="7" ry="12" fill="#fda4af" transform="rotate(20 112 48)" />

        {/* Main 3D Squishy Body */}
        <path 
          d="M32 95 C30 55, 130 55, 128 95 C128 145, 32 145, 32 95 Z" 
          fill="url(#mochiShading)" 
        />

        {/* Specular 3D Gloss Highlight on Top-Left */}
        <ellipse cx="58" cy="72" rx="16" ry="8" fill="#ffffff" opacity="0.6" transform="rotate(-25 58 72)" />
        <circle cx="75" cy="65" r="4" fill="#ffffff" opacity="0.7" />

        {/* Blush Cheeks */}
        <circle cx="50" cy="104" r="10" fill="url(#cheekGlow)" />
        <circle cx="110" cy="104" r="10" fill="url(#cheekGlow)" />

        {/* Expressive Glossy Eyes */}
        {isSleeping ? (
          <g stroke="#7c2d12" strokeWidth="3" strokeLinecap="round" fill="none">
            <path d="M54 94 Q64 100 74 94" />
            <path d="M86 94 Q96 100 106 94" />
            <text x="115" y="55" fill="#f97316" fontSize="13" fontWeight="bold">Z</text>
            <text x="123" y="45" fill="#f97316" fontSize="10" opacity="0.6">z</text>
          </g>
        ) : isSuccess ? (
          <g stroke="#ea580c" strokeWidth="4" strokeLinecap="round" fill="none">
            <path d="M54 94 Q64 84 74 94" />
            <path d="M86 94 Q96 84 106 94" />
          </g>
        ) : isConfused ? (
          <g>
            <circle cx="64" cy="92" r="8" fill="#1e293b" />
            <circle cx="62" cy="89" r="3" fill="#ffffff" />
            {/* Confused tilted line for other eye */}
            <line x1="88" y1="96" x2="104" y2="88" stroke="#1e293b" strokeWidth="3.5" strokeLinecap="round" />
            <text x="114" y="65" fill="#e11d48" fontSize="16" fontWeight="bold">?</text>
          </g>
        ) : (
          <g>
            {/* Left Big Glassy Eye */}
            <circle cx="64" cy="92" r={isListening ? 9 : 8} fill="#1e293b" />
            <circle cx="62" cy="89" r="3.5" fill="#ffffff" />
            <circle cx="67" cy="95" r="1.5" fill="#ffffff" />

            {/* Right Big Glassy Eye */}
            <circle cx="96" cy="92" r={isListening ? 9 : 8} fill="#1e293b" />
            <circle cx="94" cy="89" r="3.5" fill="#ffffff" />
            <circle cx="99" cy="95" r="1.5" fill="#ffffff" />
          </g>
        )}

        {/* Cute Mouth */}
        {state === 'talking' ? (
          <ellipse cx="80" cy="106" rx="6" ry={mouthHeight} fill="#be123c" stroke="#4c0519" strokeWidth="1" />
        ) : isSuccess ? (
          <path d="M74 104 Q80 112 86 104" stroke="#7c2d12" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        ) : (
          <path d="M76 104 Q80 108 84 104" stroke="#7c2d12" strokeWidth="2" strokeLinecap="round" fill="none" />
        )}

        {/* Tiny Stubby Paws */}
        <ellipse cx="44" cy="125" rx="8" ry="10" fill="url(#earShading)" />
        <ellipse cx="116" cy="125" rx="8" ry="10" fill="url(#earShading)" />
      </svg>
    </div>
  );
};
