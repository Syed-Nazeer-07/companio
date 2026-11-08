import React from 'react';
import { CharacterState } from '../../types';

interface Props {
  state: CharacterState;
  scale?: number;
  audioLevel?: number;
}

export const PixelMascot: React.FC<Props> = ({ state, scale = 1, audioLevel = 0 }) => {
  const isSleeping = state === 'sleeping';
  const isListening = state === 'listening';
  const isThinking = state === 'thinking';
  const isSuccess = state === 'success';
  const isConfused = state === 'confused';
  const isWaking = state === 'waking';
  const isTalking = state === 'talking';

  return (
    <div 
      className="relative flex items-center justify-center transition-transform duration-300 pointer-events-none select-none"
      style={{ transform: `scale(${scale})` }}
    >
      <svg 
        width="160" 
        height="180" 
        viewBox="0 0 32 36" 
        className={`relative z-10 transition-all duration-200 ${
          isSuccess ? 'animate-companio-celebrate' :
          isWaking ? 'animate-companio-wake' :
          isListening ? 'animate-companio-listen' :
          isThinking ? 'animate-companio-think' : 
          isConfused ? 'rotate-[-6deg]' : 
          isSleeping ? 'opacity-85 translate-y-1' : 'animate-companio-idle'
        }`}
        style={{ shapeRendering: 'crispEdges' }}
      >
        {/* Pixel Cyber-Fox Mascot (32x36 grid) */}

        {/* Floating Shadow */}
        <rect x="8" y="32" width="16" height="2" fill="#0f172a" opacity="0.6" />

        {/* Ears */}
        {/* Left Ear */}
        <rect x="7" y="4" width="4" height="6" fill="#f97316" />
        <rect x="8" y="5" width="2" height="4" fill={isListening ? '#34d399' : '#fed7aa'} />
        <rect x="6" y="3" width="6" height="1" fill="#c2410c" />

        {/* Right Ear */}
        <rect x="21" y="4" width="4" height="6" fill="#f97316" />
        <rect x="22" y="5" width="2" height="4" fill={isListening ? '#34d399' : '#fed7aa'} />
        <rect x="20" y="3" width="6" height="1" fill="#c2410c" />

        {/* Head Block */}
        <rect x="7" y="8" width="18" height="14" fill="#ea580c" />
        <rect x="9" y="10" width="14" height="11" fill="#f97316" />

        {/* White Cheek / Muzzle Fluff */}
        <rect x="5" y="15" width="4" height="6" fill="#fff7ed" />
        <rect x="23" y="15" width="4" height="6" fill="#fff7ed" />
        <rect x="11" y="17" width="10" height="4" fill="#fff7ed" />

        {/* Eyes */}
        {isSleeping ? (
          <g fill="#7c2d12">
            <rect x="10" y="14" width="3" height="1" />
            <rect x="19" y="14" width="3" height="1" />
            {/* Pixel Z */}
            <rect x="24" y="6" width="3" height="1" fill="#38bdf8" />
            <rect x="26" y="7" width="1" height="1" fill="#38bdf8" />
            <rect x="24" y="8" width="3" height="1" fill="#38bdf8" />
          </g>
        ) : isSuccess ? (
          <g fill="#facc15">
            {/* Star/Squint Eyes */}
            <rect x="10" y="13" width="3" height="1" />
            <rect x="9" y="14" width="5" height="1" />
            <rect x="10" y="15" width="3" height="1" />

            <rect x="19" y="13" width="3" height="1" />
            <rect x="18" y="14" width="5" height="1" />
            <rect x="19" y="15" width="3" height="1" />
          </g>
        ) : isConfused ? (
          <g>
            <rect x="10" y="13" width="3" height="3" fill="#1e293b" />
            <rect x="10" y="13" width="1" height="1" fill="#ffffff" />
            {/* Right eye squiggly / line */}
            <rect x="19" y="14" width="3" height="1" fill="#1e293b" />
            {/* Pixel Question Mark */}
            <rect x="24" y="6" width="3" height="1" fill="#ef4444" />
            <rect x="26" y="7" width="1" height="1" fill="#ef4444" />
            <rect x="25" y="8" width="1" height="1" fill="#ef4444" />
            <rect x="25" y="10" width="1" height="1" fill="#ef4444" />
          </g>
        ) : (
          <g>
            {/* Normal Pixel Eyes */}
            <rect x="10" y="13" width="3" height="3" fill={isListening ? '#059669' : '#1e293b'} />
            <rect x="10" y="13" width="1" height="1" fill="#ffffff" />

            <rect x="19" y="13" width="3" height="3" fill={isListening ? '#059669' : '#1e293b'} />
            <rect x="19" y="13" width="1" height="1" fill="#ffffff" />
          </g>
        )}

        {/* Nose */}
        <rect x="15" y="17" width="2" height="1" fill="#431407" />

        {/* Mouth */}
        {isTalking ? (
          <rect x="15" y="19" width="2" height={audioLevel > 0.3 ? 2 : 1} fill="#b91c1c" />
        ) : isSuccess ? (
          <g fill="#ea580c">
            <rect x="14" y="19" width="4" height="1" />
            <rect x="13" y="18" width="1" height="1" />
            <rect x="18" y="18" width="1" height="1" />
          </g>
        ) : (
          <rect x="15" y="19" width="2" height="1" fill="#ea580c" />
        )}

        {/* Body */}
        <rect x="10" y="22" width="12" height="7" fill="#ea580c" />
        <rect x="12" y="22" width="8" height="5" fill="#fff7ed" />

        {/* Cyber Scarf */}
        <rect x="9" y="21" width="14" height="2" fill="#0284c7" />
        <rect x="20" y="23" width="3" height="4" fill="#38bdf8" />

        {/* Tail (Curled pixel tail) */}
        <rect x="22" y="24" width="4" height="3" fill="#ea580c" />
        <rect x="24" y="21" width="3" height="3" fill="#ea580c" />
        <rect x="25" y="19" width="3" height="2" fill="#fff7ed" />

        {/* Paws */}
        <rect x="10" y="29" width="3" height="2" fill="#431407" />
        <rect x="19" y="29" width="3" height="2" fill="#431407" />
      </svg>
    </div>
  );
};
