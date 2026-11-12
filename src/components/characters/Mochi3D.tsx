import React from 'react';
import { CharacterState } from '../../types';

interface Props {
  state: CharacterState;
  scale?: number;
  audioLevel?: number;
}

/** Soft, flat-shaded mochi mascot: same visual language as Kiko and Cloudie. */
export const Mochi3D: React.FC<Props> = ({ state, scale = 1, audioLevel = 0 }) => {
  const sleeping = state === 'sleeping';
  const listening = state === 'listening';
  const thinking = state === 'thinking';
  const success = state === 'success';
  const confused = state === 'confused';
  const waking = state === 'waking';
  const mouthHeight = state === 'talking' ? 3 + Math.min(audioLevel, 1) * 9 : 3;
  const motion = success ? 'animate-companio-celebrate'
    : waking ? 'animate-companio-wake'
    : listening ? 'animate-companio-listen'
    : thinking ? 'animate-companio-think'
    : confused ? 'rotate-[-6deg]'
    : sleeping ? 'opacity-85 translate-y-3'
    : 'animate-companio-idle';

  return (
    <div className="relative flex items-center justify-center pointer-events-none select-none transition-transform duration-300"
      style={{ transform: 'scale(' + scale + ')' }}>
      <svg width="160" height="180" viewBox="0 0 160 180" role="img" aria-label="Mochi companion"
        className={'relative z-10 drop-shadow-[0_10px_20px_rgba(0,0,0,0.12)] transition-all duration-300 ' + motion}>
        <defs>
          <linearGradient id="mochiFur" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#fffdf9" />
            <stop offset="100%" stopColor="#fbe9d8" />
          </linearGradient>
          <linearGradient id="mochiBlush" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#f9a8b5" />
            <stop offset="100%" stopColor="#fda4af" />
          </linearGradient>
        </defs>
        {/* Little folded wrapper and tiny feet keep the silhouette recognizable. */}
        <ellipse cx="80" cy="155" rx="38" ry="6" fill="#c8b7ab" opacity="0.18" />
        <ellipse cx="58" cy="146" rx="15" ry="10" fill="#f6d6c6" stroke="#e8bcab" strokeWidth="1.5" />
        <ellipse cx="103" cy="146" rx="15" ry="10" fill="#f6d6c6" stroke="#e8bcab" strokeWidth="1.5" />
        <path d="M32 100 C31 62 50 49 80 49 C110 49 129 62 128 100 C128 136 106 151 80 151 C54 151 32 136 32 100 Z"
          fill="url(#mochiFur)" stroke="#e7cbbd" strokeWidth="2" />
        <path d="M51 62 Q60 49 71 51" stroke="#fff" strokeWidth="5" strokeLinecap="round" opacity="0.68" />
        <path d="M42 125 Q29 114 29 101" stroke="#e7cbbd" strokeWidth="8" strokeLinecap="round" fill="none" />
        <path d="M118 125 Q131 114 131 101" stroke="#e7cbbd" strokeWidth="8" strokeLinecap="round" fill="none" />
        <ellipse cx="51" cy="110" rx="8" ry="5" fill="url(#mochiBlush)" opacity="0.7" />
        <ellipse cx="109" cy="110" rx="8" ry="5" fill="url(#mochiBlush)" opacity="0.7" />
        {sleeping || success ? (
          <g fill="none" stroke="#4b3e43" strokeWidth="3" strokeLinecap="round">
            <path d={success ? 'M55 94 Q65 83 74 94' : 'M55 92 Q65 99 74 92'} />
            <path d={success ? 'M86 94 Q95 83 105 94' : 'M86 92 Q95 99 105 92'} />
          </g>
        ) : confused ? (
          <g>
            <circle cx="65" cy="93" r="6.5" fill="#303b4a" />
            <path d="M88 95 Q97 90 105 96" fill="none" stroke="#303b4a" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M119 67 Q128 59 128 72" fill="none" stroke="#d97789" strokeWidth="2" />
          </g>
        ) : (
          <g>
            <ellipse cx="65" cy="93" rx={listening ? 7 : 6} ry="8" fill="#283244" />
            <ellipse cx="95" cy="93" rx={listening ? 7 : 6} ry="8" fill="#283244" />
            <circle cx="63" cy="90" r="2.5" fill="#fff" />
            <circle cx="93" cy="90" r="2.5" fill="#fff" />
          </g>
        )}
        {state === 'talking' ? (
          <ellipse cx="80" cy="111" rx="5" ry={mouthHeight} fill="#aa526b" />
        ) : (
          <path d={success ? 'M73 109 Q80 119 87 109' : 'M75 110 Q80 114 85 110'}
            fill="none" stroke="#7d5362" strokeWidth="2.5" strokeLinecap="round" />
        )}
        {sleeping && <g fill="#b28c9a" fontWeight="bold"><text x="117" y="55" fontSize="14">z</text><text x="127" y="43" fontSize="10">z</text></g>}
        {thinking && <circle cx="127" cy="53" r="4" fill="#eebd75" />}
        {success && <path d="M123 57 L126 63 L132 66 L126 69 L123 75 L120 69 L114 66 L120 63 Z" fill="#f9c96b" />}
      </svg>
    </div>
  );
};
