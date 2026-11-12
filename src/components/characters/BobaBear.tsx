import React from 'react';
import { CharacterState } from '../../types';

interface Props {
  state: CharacterState;
  scale?: number;
  audioLevel?: number;
}

/** Chibi bear character, rather than a tea cup, with the shared companion silhouette. */
export const BobaBear: React.FC<Props> = ({ state, scale = 1, audioLevel = 0 }) => {
  const sleeping = state === 'sleeping';
  const listening = state === 'listening';
  const thinking = state === 'thinking';
  const success = state === 'success';
  const confused = state === 'confused';
  const waking = state === 'waking';
  const mouthHeight = state === 'talking' ? 3 + Math.min(audioLevel, 1) * 8 : 3;
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
      <svg width="160" height="180" viewBox="0 0 160 180" role="img" aria-label="Boba bear companion"
        className={'relative z-10 drop-shadow-[0_10px_20px_rgba(0,0,0,0.12)] transition-all duration-300 ' + motion}>
        <defs>
          <linearGradient id="bobaFur" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ffe6be" />
            <stop offset="100%" stopColor="#edb77f" />
          </linearGradient>
        </defs>
        <ellipse cx="80" cy="159" rx="39" ry="6" fill="#7c5537" opacity="0.14" />
        {/* Rounded ears and compact plush body share Kiko's soft outlines. */}
        <circle cx="49" cy="53" r="18" fill="url(#bobaFur)" stroke="#ce9566" strokeWidth="2" />
        <circle cx="111" cy="53" r="18" fill="url(#bobaFur)" stroke="#ce9566" strokeWidth="2" />
        <circle cx="49" cy="53" r="9" fill="#f6b9b3" opacity="0.8" />
        <circle cx="111" cy="53" r="9" fill="#f6b9b3" opacity="0.8" />
        <ellipse cx="80" cy="128" rx="37" ry="27" fill="url(#bobaFur)" stroke="#ce9566" strokeWidth="2" />
        <ellipse cx="80" cy="130" rx="21" ry="17" fill="#fff3dd" />
        <ellipse cx="80" cy="90" rx="51" ry="46" fill="url(#bobaFur)" stroke="#ce9566" strokeWidth="2" />
        <ellipse cx="80" cy="110" rx="20" ry="14" fill="#fff2da" />
        <ellipse cx="41" cy="127" rx="12" ry="9" fill="#edb77f" stroke="#ce9566" strokeWidth="1.5" />
        <ellipse cx="119" cy="127" rx="12" ry="9" fill="#edb77f" stroke="#ce9566" strokeWidth="1.5" />
        <ellipse cx="59" cy="150" rx="15" ry="9" fill="#f6cda3" stroke="#ce9566" strokeWidth="1.5" />
        <ellipse cx="101" cy="150" rx="15" ry="9" fill="#f6cda3" stroke="#ce9566" strokeWidth="1.5" />
        {/* The tiny teal bow is Boba's distinctive detail, not a busy prop. */}
        <path d="M66 133 Q54 119 52 134 Q55 147 66 138 L80 136 L94 138 Q105 147 108 134 Q106 119 94 133 Z"
          fill="#74b7b4" stroke="#4f918d" strokeWidth="1.5" />
        <circle cx="80" cy="136" r="6" fill="#4f918d" />
        <ellipse cx="45" cy="105" rx="8" ry="5" fill="#ed9e9e" opacity="0.75" />
        <ellipse cx="115" cy="105" rx="8" ry="5" fill="#ed9e9e" opacity="0.75" />
        {sleeping || success ? (
          <g stroke="#553d36" strokeWidth="3" strokeLinecap="round" fill="none">
            <path d={success ? 'M52 91 Q63 80 73 91' : 'M52 89 Q63 97 73 89'} />
            <path d={success ? 'M87 91 Q97 80 108 91' : 'M87 89 Q97 97 108 89'} />
          </g>
        ) : confused ? (
          <g>
            <circle cx="62" cy="91" r="6.5" fill="#303b4a" />
            <path d="M87 93 Q97 89 108 94" stroke="#303b4a" strokeWidth="2.5" fill="none" />
          </g>
        ) : (
          <g>
            <ellipse cx="62" cy="91" rx={listening ? 7 : 6} ry="7.5" fill="#303b4a" />
            <ellipse cx="98" cy="91" rx={listening ? 7 : 6} ry="7.5" fill="#303b4a" />
            <circle cx="60" cy="88" r="2.5" fill="#fff" />
            <circle cx="96" cy="88" r="2.5" fill="#fff" />
          </g>
        )}
        <ellipse cx="80" cy="105" rx="5.5" ry="4" fill="#57423c" />
        {state === 'talking' ? (
          <ellipse cx="80" cy="118" rx="4.5" ry={mouthHeight} fill="#9b5261" />
        ) : (
          <path d={success ? 'M71 115 Q80 126 89 115' : 'M74 116 Q80 121 86 116'}
            stroke="#57423c" strokeWidth="2" strokeLinecap="round" fill="none" />
        )}
        {sleeping && <g fill="#b28c7f" fontWeight="bold"><text x="116" y="51" fontSize="14">z</text><text x="127" y="40" fontSize="10">z</text></g>}
        {thinking && <circle cx="127" cy="61" r="4" fill="#74b7b4" />}
        {success && <path d="M126 57 L129 63 L135 66 L129 69 L126 75 L123 69 L117 66 L123 63 Z" fill="#f2ca6a" />}
      </svg>
    </div>
  );
};
