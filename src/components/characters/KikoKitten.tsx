import React from 'react';
import { CharacterState } from '../../types';

interface Props {
  state: CharacterState;
  scale?: number;
  audioLevel?: number;
}

export const KikoKitten: React.FC<Props> = ({ state, scale = 1, audioLevel = 0 }) => {
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
      {/* Warm Peach Aura Glow */}
      <div 
        className={`absolute inset-0 rounded-full blur-2xl transition-all duration-500 opacity-60 ${
          isThinking ? 'bg-amber-300 animate-pulse' :
          isListening ? 'bg-emerald-300 scale-110' :
          isSuccess ? 'bg-pink-400 scale-125' :
          isConfused ? 'bg-rose-300' :
          isSleeping ? 'bg-indigo-950 opacity-20' :
          'bg-orange-300 opacity-50'
        }`}
      />

      <svg 
        width="160" 
        height="180" 
        viewBox="0 0 160 180" 
        className={`relative z-10 transition-all duration-300 drop-shadow-[0_10px_20px_rgba(0,0,0,0.15)] ${
          isSuccess ? 'animate-happy-bounce' : 
          isConfused ? 'rotate-[-6deg]' : 
          isSleeping ? 'opacity-85 translate-y-3' : 'animate-float'
        }`}
      >
        <defs>
          <linearGradient id="kittenFur" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#fff7ed" />
            <stop offset="60%" stopColor="#ffedd5" />
            <stop offset="100%" stopColor="#fed7aa" />
          </linearGradient>
          <linearGradient id="earInner" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#fda4af" />
            <stop offset="100%" stopColor="#fb7185" />
          </linearGradient>
        </defs>

        {/* Swishing Tail */}
        <g className="animate-tail-wag origin-bottom-left">
          <path 
            d={isSuccess ? "M115 130 Q145 110 135 85 Q130 75 140 70" : "M115 130 Q140 125 132 105 Q128 95 138 90"} 
            stroke="#ea580c" 
            strokeWidth="8" 
            strokeLinecap="round" 
            fill="none" 
          />
          <circle cx={isSuccess ? 140 : 138} cy={isSuccess ? 70 : 90} r="5" fill="#fff7ed" />
        </g>

        {/* Cat Ears */}
        {/* Left Ear with wiggle */}
        <g className="animate-ear-wiggle origin-bottom">
          <polygon 
            points="42,65 30,22 68,45" 
            fill="url(#kittenFur)" 
            stroke="#f97316" 
            strokeWidth="1.5" 
            className={isListening ? 'animate-pulse' : ''}
          />
          <polygon points="43,58 35,28 62,45" fill="url(#earInner)" opacity="0.85" />
        </g>

        {/* Right Ear */}
        <g className="origin-bottom">
          <polygon 
            points="118,65 130,22 92,45" 
            fill="url(#kittenFur)" 
            stroke="#f97316" 
            strokeWidth="1.5" 
            className={isListening ? 'animate-pulse' : ''}
          />
          <polygon points="117,58 125,28 98,45" fill="url(#earInner)" opacity="0.85" />
        </g>

        {/* Cute Kitten Body */}
        <ellipse cx="80" cy="125" rx="36" ry="26" fill="url(#kittenFur)" stroke="#fed7aa" strokeWidth="1" />
        {/* Belly patch */}
        <ellipse cx="80" cy="128" rx="20" ry="16" fill="#ffffff" />

        {/* Cute Chibi Head */}
        <ellipse cx="80" cy="85" rx="44" ry="36" fill="url(#kittenFur)" stroke="#fed7aa" strokeWidth="1" />

        {/* Orange Head Strip / Forehead Tab */}
        <path d="M72 52 L80 62 L88 52" stroke="#ea580c" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.8" />

        {/* Pink Blush Cheeks */}
        <ellipse cx="54" cy="94" rx="7" ry="4" fill="#fb7185" opacity={isSuccess ? 0.7 : 0.45} />
        <ellipse cx="106" cy="94" rx="7" ry="4" fill="#fb7185" opacity={isSuccess ? 0.7 : 0.45} />

        {/* Whiskers */}
        <line x1="38" y1="90" x2="22" y2="86" stroke="#9a3412" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
        <line x1="38" y1="95" x2="22" y2="98" stroke="#9a3412" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
        <line x1="122" y1="90" x2="138" y2="86" stroke="#9a3412" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
        <line x1="122" y1="95" x2="138" y2="98" stroke="#9a3412" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />

        {/* Eyes */}
        {isSleeping ? (
          <g stroke="#7c2d12" strokeWidth="2.5" strokeLinecap="round" fill="none">
            <path d="M58 84 Q66 90 74 84" />
            <path d="M86 84 Q94 90 102 84" />
            <text x="114" y="55" fill="#f97316" fontSize="12" fontWeight="bold">z</text>
            <text x="122" y="45" fill="#f97316" fontSize="9" opacity="0.6">z</text>
          </g>
        ) : isSuccess ? (
          <g stroke="#ea580c" strokeWidth="3" strokeLinecap="round" fill="none">
            <path d="M58 84 Q66 76 74 84" />
            <path d="M86 84 Q94 76 102 84" />
            {/* Heart floaters */}
            <text x="115" y="55" fill="#f43f5e" fontSize="14">❤️</text>
          </g>
        ) : isConfused ? (
          <g>
            <circle cx="66" cy="82" r="7.5" fill="#1e293b" />
            <circle cx="64" cy="80" r="2.5" fill="#ffffff" />
            <path d="M86 84 Q94 80 102 84" stroke="#1e293b" strokeWidth="2.5" strokeLinecap="round" fill="none" />
            <text x="114" y="60" fill="#f43f5e" fontSize="14" fontWeight="bold">?</text>
          </g>
        ) : (
          <g>
            {/* Left Big Anime Cat Eye */}
            <ellipse cx="66" cy="82" rx="8" ry={isListening ? 10 : 9} fill="#0f172a" />
            <ellipse cx="66" cy="83" rx="7" ry={isListening ? 9 : 8} fill="#0284c7" />
            <circle cx="64" cy="79" r="3" fill="#ffffff" />
            <circle cx="68" cy="85" r="1.5" fill="#ffffff" />

            {/* Right Big Anime Cat Eye */}
            <ellipse cx="94" cy="82" rx="8" ry={isListening ? 10 : 9} fill="#0f172a" />
            <ellipse cx="94" cy="83" rx="7" ry={isListening ? 9 : 8} fill="#0284c7" />
            <circle cx="92" cy="79" r="3" fill="#ffffff" />
            <circle cx="96" cy="85" r="1.5" fill="#ffffff" />
          </g>
        )}

        {/* Tiny Pink Cat Nose */}
        <polygon points="77,90 83,90 80,94" fill="#fb7185" />

        {/* Cat Mouth */}
        {state === 'talking' ? (
          <ellipse cx="80" cy="99" rx="5" ry={mouthOpen} fill="#f43f5e" stroke="#9f1239" strokeWidth="1" />
        ) : isSuccess ? (
          <path d="M75 94 Q80 102 85 94" stroke="#7c2d12" strokeWidth="2" strokeLinecap="round" fill="none" />
        ) : (
          <path d="M74 94 Q77 98 80 94 Q83 98 86 94" stroke="#7c2d12" strokeWidth="1.8" strokeLinecap="round" fill="none" />
        )}

        {/* Paws */}
        <ellipse cx="66" cy="144" rx="7" ry="5" fill="#ffffff" stroke="#fed7aa" strokeWidth="1" />
        <ellipse cx="94" cy="144" rx="7" ry="5" fill="#ffffff" stroke="#fed7aa" strokeWidth="1" />
      </svg>
    </div>
  );
};
