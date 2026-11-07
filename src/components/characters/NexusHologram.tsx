import React from 'react';
import { CharacterState } from '../../types';

interface Props {
  state: CharacterState;
  scale?: number;
  audioLevel?: number;
}

export const NexusHologram: React.FC<Props> = ({ state, scale = 1, audioLevel = 0 }) => {
  const isSleeping = state === 'sleeping';
  const isListening = state === 'listening';
  const isThinking = state === 'thinking';
  const isSuccess = state === 'success';
  const isConfused = state === 'confused';
  const coreScale = 1 + (state === 'talking' ? audioLevel * 0.4 : isThinking ? 0.2 : 0);

  return (
    <div 
      className="relative flex items-center justify-center transition-transform duration-300 pointer-events-none select-none"
      style={{ transform: `scale(${scale})` }}
    >
      {/* Sci-Fi Hologram Outer Glow */}
      <div 
        className={`absolute inset-0 rounded-full blur-2xl transition-all duration-700 ${
          isThinking ? 'bg-cyan-400 opacity-80 animate-ping' :
          isListening ? 'bg-emerald-400 opacity-70' :
          isSuccess ? 'bg-amber-300 opacity-90' :
          isConfused ? 'bg-rose-500 opacity-60' :
          isSleeping ? 'bg-blue-950 opacity-20' :
          'bg-cyan-500 opacity-50'
        }`}
      />

      <svg 
        width="170" 
        height="180" 
        viewBox="0 0 170 180" 
        className={`relative z-10 transition-all duration-300 ${
          isSuccess ? 'animate-bounce' : 
          isConfused ? 'rotate-[-5deg]' : 
          isSleeping ? 'opacity-50' : 'animate-float'
        }`}
      >
        <defs>
          <linearGradient id="holoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.9" />
            <stop offset="50%" stopColor="#818cf8" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#c084fc" stopOpacity="0.8" />
          </linearGradient>
          <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.2" />
            <stop offset="50%" stopColor="#38bdf8" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.2" />
          </linearGradient>
          <filter id="holoGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="glow" />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Outer Orbiting Data Ring 1 */}
        <ellipse 
          cx="85" 
          cy="90" 
          rx="68" 
          ry="24" 
          fill="none" 
          stroke="url(#ringGrad)" 
          strokeWidth="2" 
          strokeDasharray="12 6 4 6" 
          className={isSleeping ? '' : 'animate-spin-slow origin-center'}
          transform="rotate(-25 85 90)"
        />

        {/* Outer Orbiting Data Ring 2 */}
        <ellipse 
          cx="85" 
          cy="90" 
          rx="60" 
          ry="22" 
          fill="none" 
          stroke="#818cf8" 
          strokeWidth="1.5" 
          strokeDasharray="8 8" 
          opacity="0.7"
          transform="rotate(35 85 90)"
        />

        {/* Scanlines / Grid Backdrop */}
        <g opacity="0.3" stroke="#38bdf8" strokeWidth="0.8">
          <line x1="50" y1="70" x2="120" y2="70" />
          <line x1="45" y1="90" x2="125" y2="90" />
          <line x1="50" y1="110" x2="120" y2="110" />
        </g>

        {/* Central Geometric Humanoid Prism Core */}
        <g 
          transform={`scale(${coreScale})`} 
          className="origin-center transition-transform duration-150"
          filter="url(#holoGlow)"
        >
          {/* Head Prism */}
          <polygon 
            points="85,35 105,52 85,70 65,52" 
            fill="url(#holoGradient)" 
            stroke="#a5f3fc" 
            strokeWidth="1.5" 
          />
          {/* Head Inner Facets */}
          <line x1="85" y1="35" x2="85" y2="70" stroke="#ffffff" strokeWidth="1" opacity="0.8" />
          <line x1="65" y1="52" x2="105" y2="52" stroke="#ffffff" strokeWidth="1" opacity="0.6" />

          {/* Hologram Eyes */}
          {isSleeping ? (
            <g stroke="#38bdf8" strokeWidth="2" opacity="0.5">
              <line x1="74" y1="52" x2="80" y2="52" />
              <line x1="90" y1="52" x2="96" y2="52" />
            </g>
          ) : isSuccess ? (
            <g fill="#fde047">
              <circle cx="77" cy="52" r="3" />
              <circle cx="93" cy="52" r="3" />
            </g>
          ) : (
            <g fill={isListening ? '#34d399' : isThinking ? '#67e8f9' : '#ffffff'}>
              <circle cx="77" cy="52" r={isListening ? 3.5 : 2.5} />
              <circle cx="93" cy="52" r={isListening ? 3.5 : 2.5} />
            </g>
          )}

          {/* Neck / Spine Link */}
          <line x1="85" y1="70" x2="85" y2="82" stroke="#67e8f9" strokeWidth="3" />

          {/* Torso / Diamond Diamond Core */}
          <polygon 
            points="85,80 115,105 85,145 55,105" 
            fill="url(#holoGradient)" 
            stroke="#a5f3fc" 
            strokeWidth="2" 
            opacity="0.85"
          />
          {/* Internal Quantum Reactor */}
          <circle 
            cx="85" 
            cy="105" 
            r={isThinking ? 12 : 9} 
            fill={isListening ? '#10b981' : isSuccess ? '#f59e0b' : isConfused ? '#f43f5e' : '#38bdf8'} 
            className={isThinking ? 'animate-pulse' : ''}
          />
          <circle cx="85" cy="105" r="4" fill="#ffffff" />

          {/* Floating Shoulder Shards */}
          <polygon points="46,90 52,80 50,105 44,100" fill="#38bdf8" opacity="0.8" />
          <polygon points="124,90 118,80 120,105 126,100" fill="#38bdf8" opacity="0.8" />
        </g>

        {/* Base Emitter Projector */}
        <ellipse cx="85" cy="165" rx="36" ry="7" fill="#0f172a" stroke="#0ea5e9" strokeWidth="1.5" />
        <ellipse cx="85" cy="164" rx="26" ry="4" fill="#0284c7" />
        <ellipse cx="85" cy="163" rx="14" ry="2" fill="#bae6fd" />
        {/* Hologram Light Cone */}
        <polygon points="75,163 95,163 120,110 50,110" fill="url(#ringGrad)" opacity="0.15" />
      </svg>
    </div>
  );
};
