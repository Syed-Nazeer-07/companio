import React from 'react';
import { CharacterState } from '../../types';

interface Props {
  state: CharacterState;
  scale?: number;
  audioLevel?: number;
}

export const KiraAnime: React.FC<Props> = ({ state, scale = 1, audioLevel = 0 }) => {
  const isSleeping = state === 'sleeping';
  const isListening = state === 'listening';
  const isThinking = state === 'thinking';
  const isSuccess = state === 'success';
  const isConfused = state === 'confused';
  const mouthOpen = state === 'talking' ? Math.max(3, 3 + audioLevel * 10) : 2;

  return (
    <div 
      className="relative flex items-center justify-center transition-transform duration-300 pointer-events-none select-none"
      style={{ transform: `scale(${scale})` }}
    >
      {/* Background Aura */}
      <div 
        className={`absolute inset-0 rounded-full blur-2xl transition-all duration-500 opacity-50 ${
          isThinking ? 'bg-purple-500 animate-pulse' :
          isListening ? 'bg-pink-400 scale-110' :
          isSuccess ? 'bg-yellow-400 scale-125' :
          isConfused ? 'bg-orange-400' :
          isSleeping ? 'bg-indigo-950 opacity-20' :
          'bg-fuchsia-500 opacity-40'
        }`}
      />

      <svg 
        width="160" 
        height="180" 
        viewBox="0 0 160 180" 
        className={`relative z-10 transition-all duration-300 drop-shadow-[0_8px_20px_rgba(0,0,0,0.4)] ${
          isSuccess ? 'animate-bounce' : 
          isConfused ? 'rotate-[-6deg]' : 
          isSleeping ? 'opacity-80 translate-y-2' : 'animate-float'
        }`}
      >
        <defs>
          <linearGradient id="kiraHair" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#c084fc" />
            <stop offset="70%" stopColor="#7e22ce" />
            <stop offset="100%" stopColor="#581c87" />
          </linearGradient>
          <linearGradient id="kiraSkin" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#fff1f2" />
            <stop offset="100%" stopColor="#ffe4e6" />
          </linearGradient>
          <linearGradient id="cyberEar" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#ec4899" />
          </linearGradient>
        </defs>

        {/* Back Hair */}
        <path d="M40 70 C30 110, 35 150, 48 160 C55 140, 52 110, 55 90 Z" fill="url(#kiraHair)" />
        <path d="M120 70 C130 110, 125 150, 112 160 C105 140, 108 110, 105 90 Z" fill="url(#kiraHair)" />

        {/* Cyber Cat Ears Headset */}
        {/* Left Ear */}
        <polygon points="46,55 30,15 62,35" fill="#1e1b4b" stroke="#a855f7" strokeWidth="2" />
        <polygon 
          points="46,48 35,24 56,36" 
          fill={isListening ? '#34d399' : isThinking ? '#38bdf8' : isSuccess ? '#fbbf24' : '#ec4899'} 
          className="transition-colors duration-300"
        />

        {/* Right Ear */}
        <polygon points="114,55 130,15 98,35" fill="#1e1b4b" stroke="#a855f7" strokeWidth="2" />
        <polygon 
          points="114,48 125,24 104,36" 
          fill={isListening ? '#34d399' : isThinking ? '#38bdf8' : isSuccess ? '#fbbf24' : '#ec4899'} 
          className="transition-colors duration-300"
        />

        {/* Headband */}
        <path d="M42 45 Q80 30 118 45" stroke="#1e1b4b" strokeWidth="6" fill="none" />
        <path d="M44 45 Q80 32 116 45" stroke="#ec4899" strokeWidth="2" fill="none" />

        {/* Body / Collar */}
        <path d="M60 135 L80 165 L100 135 Z" fill="#0f172a" />
        <circle cx="80" cy="148" r="4" fill="#38bdf8" />
        {/* Scarf / Jacket Shoulders */}
        <path d="M50 142 Q80 160 110 142 L116 165 Q80 175 44 165 Z" fill="#3b0764" stroke="#7e22ce" strokeWidth="1.5" />

        {/* Face Shape */}
        <path d="M50 65 Q50 120 80 132 Q110 120 110 65 Z" fill="url(#kiraSkin)" />

        {/* Blush Cheeks */}
        <ellipse cx="60" cy="100" rx="6" ry="3" fill="#f43f5e" opacity={isSuccess ? 0.7 : 0.4} />
        <ellipse cx="100" cy="100" rx="6" ry="3" fill="#f43f5e" opacity={isSuccess ? 0.7 : 0.4} />

        {/* Front Hair / Bangs */}
        <path d="M48 65 Q80 40 112 65 Q115 85 105 85 Q95 72 80 82 Q65 72 55 85 Q45 85 48 65 Z" fill="url(#kiraHair)" />
        {/* Hair Highlight */}
        <path d="M58 55 Q80 46 102 55" stroke="#f3e8ff" strokeWidth="3" strokeLinecap="round" opacity="0.6" fill="none" />

        {/* Eyes */}
        {isSleeping ? (
          <g stroke="#7e22ce" strokeWidth="2.5" strokeLinecap="round">
            <path d="M58 92 Q68 98 76 92" fill="none" />
            <path d="M84 92 Q92 98 102 92" fill="none" />
            <text x="110" y="48" fill="#c084fc" fontSize="12" fontWeight="bold">z</text>
            <text x="118" y="38" fill="#c084fc" fontSize="10" opacity="0.6">z</text>
          </g>
        ) : isSuccess ? (
          <g stroke="#ec4899" strokeWidth="3" strokeLinecap="round" fill="none">
            <path d="M58 90 Q68 82 76 90" />
            <path d="M84 90 Q92 82 102 90" />
            {/* Sparkles */}
            <text x="112" y="55" fill="#facc15" fontSize="16">✨</text>
          </g>
        ) : isConfused ? (
          <g>
            {/* Left eye curious */}
            <ellipse cx="67" cy="88" rx="8" ry="9" fill="#1e1b4b" />
            <ellipse cx="67" cy="88" rx="7" ry="8" fill="#a855f7" />
            <circle cx="65" cy="85" r="2.5" fill="#ffffff" />
            {/* Right eye squiggly */}
            <path d="M86 88 Q94 84 102 88" stroke="#1e1b4b" strokeWidth="3" fill="none" strokeLinecap="round" />
            {/* Sweat drop */}
            <path d="M106 72 Q108 66 110 72 A3 3 0 1 1 106 72" fill="#38bdf8" />
          </g>
        ) : (
          <g>
            {/* Left Eye */}
            <ellipse cx="67" cy="88" rx="8" ry={isListening ? 10 : 9} fill="#1e1b4b" />
            <ellipse cx="67" cy="89" rx="7" ry={isListening ? 9 : 8} fill="#a855f7" />
            <ellipse cx="67" cy="92" rx="5" ry="4" fill="#ec4899" />
            <circle cx="65" cy="85" r="3" fill="#ffffff" />
            <circle cx="69" cy="91" r="1.5" fill="#ffffff" />

            {/* Right Eye */}
            <ellipse cx="93" cy="88" rx="8" ry={isListening ? 10 : 9} fill="#1e1b4b" />
            <ellipse cx="93" cy="89" rx="7" ry={isListening ? 9 : 8} fill="#a855f7" />
            <ellipse cx="93" cy="92" rx="5" ry="4" fill="#ec4899" />
            <circle cx="91" cy="85" r="3" fill="#ffffff" />
            <circle cx="95" cy="91" r="1.5" fill="#ffffff" />

            {/* Eyelashes */}
            <path d="M58 82 Q67 78 76 83" stroke="#1e1b4b" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            <path d="M84 83 Q93 78 102 82" stroke="#1e1b4b" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          </g>
        )}

        {/* Small Anime Nose */}
        <circle cx="80" cy="101" r="1" fill="#f43f5e" opacity="0.6" />

        {/* Animated Mouth */}
        {state === 'talking' ? (
          <ellipse cx="80" cy="112" rx="5" ry={mouthOpen} fill="#f43f5e" stroke="#881337" strokeWidth="1" />
        ) : isSuccess ? (
          <path d="M75 110 Q80 116 85 110" stroke="#f43f5e" strokeWidth="2" strokeLinecap="round" fill="none" />
        ) : (
          <path d="M77 111 Q80 113 83 111" stroke="#f43f5e" strokeWidth="1.5" strokeLinecap="round" fill="none" />
        )}
      </svg>
    </div>
  );
};
