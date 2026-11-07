import React from 'react';
import { CharacterState } from '../../types';

interface Props {
  state: CharacterState;
  scale?: number;
  audioLevel?: number;
}

export const SparkyRobot: React.FC<Props> = ({ state, scale = 1, audioLevel = 0 }) => {
  // Mouth opening height based on talking state and audio level
  const mouthHeight = state === 'talking' ? Math.max(4, 4 + audioLevel * 14) : 2;
  const isSleeping = state === 'sleeping';
  const isListening = state === 'listening';
  const isThinking = state === 'thinking';
  const isSuccess = state === 'success';
  const isConfused = state === 'confused';

  return (
    <div 
      className="relative flex items-center justify-center transition-transform duration-300 pointer-events-none select-none"
      style={{ transform: `scale(${scale})` }}
    >
      {/* Status aura glow */}
      <div 
        className={`absolute inset-0 rounded-full blur-2xl transition-all duration-500 opacity-60 ${
          isThinking ? 'bg-cyan-400 animate-pulse' :
          isListening ? 'bg-emerald-400 scale-110' :
          isSuccess ? 'bg-amber-400 scale-125' :
          isConfused ? 'bg-rose-400' :
          isSleeping ? 'bg-indigo-900 opacity-20' :
          'bg-sky-500 opacity-40'
        }`}
      />

      <svg 
        width="160" 
        height="180" 
        viewBox="0 0 160 180" 
        className={`relative z-10 transition-all duration-300 drop-shadow-[0_8px_16px_rgba(0,0,0,0.5)] ${
          isSuccess ? 'animate-bounce' : 
          isConfused ? 'rotate-[-8deg]' : 
          isSleeping ? 'opacity-85 translate-y-3' : 'animate-float'
        }`}
      >
        <defs>
          <linearGradient id="sparkyBody" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f8fafc" />
            <stop offset="50%" stopColor="#e2e8f0" />
            <stop offset="100%" stopColor="#94a3b8" />
          </linearGradient>
          <linearGradient id="sparkyAccent" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#0284c7" />
          </linearGradient>
          <linearGradient id="sparkyVisor" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#0f172a" />
            <stop offset="100%" stopColor="#1e293b" />
          </linearGradient>
          <linearGradient id="thrusterFire" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="50%" stopColor="#60a5fa" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
          <filter id="eyeGlow">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Floating Thruster Flame */}
        {!isSleeping && (
          <g className="animate-pulse">
            <polygon points="68,145 92,145 80,175" fill="url(#thrusterFire)" opacity="0.85" />
            <polygon points="73,145 87,145 80,165" fill="#bae6fd" opacity="0.9" />
          </g>
        )}

        {/* Thruster Jet Nozzle */}
        <ellipse cx="80" cy="144" rx="14" ry="5" fill="#475569" />
        <ellipse cx="80" cy="142" rx="11" ry="3" fill="#0f172a" />

        {/* Antenna */}
        <path d="M80 40 L80 18" stroke="#64748b" strokeWidth="4" strokeLinecap="round" />
        <circle 
          cx="80" 
          cy="15" 
          r="7" 
          fill={
            isListening ? '#10b981' : 
            isThinking ? '#06b6d4' : 
            isSuccess ? '#f59e0b' : 
            isConfused ? '#ef4444' : 
            isSleeping ? '#475569' : '#38bdf8'
          } 
          filter="url(#eyeGlow)"
          className="transition-colors duration-300"
        />

        {/* Arms */}
        <g className="transition-transform duration-300">
          {/* Left Arm */}
          <path 
            d={isSuccess ? "M42 95 Q25 70 30 50" : isConfused ? "M42 95 Q25 90 28 80" : "M44 95 Q28 110 32 125"} 
            stroke="#94a3b8" 
            strokeWidth="8" 
            strokeLinecap="round" 
            fill="none" 
          />
          <circle cx={isSuccess ? 30 : 32} cy={isSuccess ? 50 : isConfused ? 80 : 125} r="6" fill="#38bdf8" />

          {/* Right Arm */}
          <path 
            d={isSuccess ? "M118 95 Q135 70 130 50" : isListening ? "M118 95 Q135 85 132 75" : "M116 95 Q132 110 128 125"} 
            stroke="#94a3b8" 
            strokeWidth="8" 
            strokeLinecap="round" 
            fill="none" 
          />
          <circle cx={isSuccess ? 130 : isListening ? 132 : 128} cy={isSuccess ? 50 : isListening ? 75 : 125} r="6" fill="#38bdf8" />
        </g>

        {/* Robot Torso / Chassis */}
        <rect x="44" y="86" width="72" height="56" rx="20" fill="url(#sparkyBody)" stroke="#cbd5e1" strokeWidth="2" />
        {/* Torso Center Indicator Light */}
        <rect x="62" y="100" width="36" height="24" rx="8" fill="#1e293b" />
        <circle 
          cx="80" 
          cy="112" 
          r="5" 
          fill={isThinking ? '#06b6d4' : isListening ? '#10b981' : isSuccess ? '#fbbf24' : '#38bdf8'} 
          className={isThinking ? 'animate-ping' : ''}
        />

        {/* Robot Head */}
        <rect 
          x="36" 
          y="34" 
          width="88" 
          height="62" 
          rx="24" 
          fill="url(#sparkyBody)" 
          stroke="#e2e8f0" 
          strokeWidth="2" 
        />
        {/* Head Side Ear Caps */}
        <rect x="30" y="52" width="8" height="26" rx="4" fill="#38bdf8" />
        <rect x="122" y="52" width="8" height="26" rx="4" fill="#38bdf8" />

        {/* Digital Screen / Visor */}
        <rect x="46" y="44" width="68" height="42" rx="14" fill="url(#sparkyVisor)" stroke="#334155" strokeWidth="2" />

        {/* Eyes & Facial Expression */}
        {isSleeping ? (
          // Sleeping eyes: curved lines
          <g stroke="#38bdf8" strokeWidth="3" strokeLinecap="round" opacity="0.6">
            <path d="M56 64 Q64 68 72 64" fill="none" />
            <path d="M88 64 Q96 68 104 64" fill="none" />
            <text x="110" y="45" fill="#38bdf8" fontSize="12" fontWeight="bold" opacity="0.8">Z</text>
            <text x="118" y="35" fill="#38bdf8" fontSize="10" opacity="0.5">z</text>
          </g>
        ) : isSuccess ? (
          // Happy squinting arch eyes
          <g stroke="#fbbf24" strokeWidth="4" strokeLinecap="round" filter="url(#eyeGlow)" fill="none">
            <path d="M56 64 Q64 56 72 64" />
            <path d="M88 64 Q96 56 104 64" />
          </g>
        ) : isConfused ? (
          // Confused: one big circle, one squiggly eyebrow, question mark
          <g filter="url(#eyeGlow)">
            <circle cx="64" cy="62" r="7" fill="#f43f5e" />
            <line x1="88" y1="65" x2="104" y2="61" stroke="#f43f5e" strokeWidth="4" strokeLinecap="round" />
            <text x="110" y="48" fill="#f43f5e" fontSize="14" fontWeight="bold">?</text>
          </g>
        ) : (
          // Normal/Listening/Thinking/Talking Eyes
          <g filter="url(#eyeGlow)">
            <ellipse 
              cx="64" 
              cy="62" 
              rx="7" 
              ry={isListening ? 9 : 7} 
              fill={isListening ? '#34d399' : isThinking ? '#22d3ee' : '#38bdf8'} 
            />
            <ellipse 
              cx="96" 
              cy="62" 
              rx="7" 
              ry={isListening ? 9 : 7} 
              fill={isListening ? '#34d399' : isThinking ? '#22d3ee' : '#38bdf8'} 
            />
            {/* Eye reflection glints */}
            <circle cx="62" cy="59" r="2.5" fill="#ffffff" />
            <circle cx="94" cy="59" r="2.5" fill="#ffffff" />
          </g>
        )}

        {/* Digital Mouth Display */}
        {state === 'talking' ? (
          <rect 
            x="70" 
            y={76 - mouthHeight / 2} 
            width="20" 
            height={mouthHeight} 
            rx={mouthHeight / 2} 
            fill="#38bdf8" 
            filter="url(#eyeGlow)" 
          />
        ) : isSuccess ? (
          <path d="M72 74 Q80 80 88 74" stroke="#fbbf24" strokeWidth="3" strokeLinecap="round" fill="none" />
        ) : (
          <line x1="74" y1="76" x2="86" y2="76" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" opacity="0.7" />
        )}
      </svg>
    </div>
  );
};
