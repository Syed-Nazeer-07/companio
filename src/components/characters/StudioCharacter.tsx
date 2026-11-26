import React from 'react';
import { CharacterId, CharacterState } from '../../types';
import { characterCollection } from './characterCollection';

function renderIdleAndActiveOptics(
  characterId: CharacterId,
  eyeHeight: number,
  state: CharacterState
) {
  const cy = 76;
  const top = cy - eyeHeight / 2;

  switch (characterId) {
    case 'pixel': {
      const drop = state === 'listening' ? 2 : 0;
      const h = Math.max(4, eyeHeight - 2);
      const y0 = cy - h / 2 - drop * 0.5;
      return (
        <>
          <polygon points={`51,${y0} 67,${y0 + 3} 65,${y0 + h} 52,${y0 + h - 2}`} />
          <polygon points={`109,${y0} 93,${y0 + 3} 95,${y0 + h} 108,${y0 + h - 2}`} />
        </>
      );
    }
    case 'mochi':
      return (
        <>
          <rect x="52" y={top} width="15" height={eyeHeight} rx={Math.min(7.5, eyeHeight / 2)} />
          <rect x="93" y={top} width="15" height={eyeHeight} rx={Math.min(7.5, eyeHeight / 2)} />
          {eyeHeight >= 10 && (
            <>
              <circle cx="57" cy={cy - 2} r="1.7" fill="#162128" stroke="none" opacity="0.65" />
              <circle cx="98" cy={cy - 2} r="1.7" fill="#162128" stroke="none" opacity="0.65" />
            </>
          )}
        </>
      );
    case 'cloudie': {
      const r = Math.max(2.8, Math.min(7.8, eyeHeight * 0.44));
      return (
        <>
          <line x1="60" y1={cy} x2="100" y2={cy} strokeWidth="1.8" opacity="0.35" />
          <circle cx="59" cy={cy} r={r} />
          <circle cx="101" cy={cy} r={r} />
        </>
      );
    }
    case 'kiko': {
      const spread = Math.max(3, eyeHeight * 0.52);
      return (
        <>
          <path d={`M51 ${cy} Q59 ${cy - spread} 67 ${cy + 1} Q59 ${cy + spread} 51 ${cy}Z`} />
          <path d={`M93 ${cy + 1} Q101 ${cy - spread} 109 ${cy} Q101 ${cy + spread} 93 ${cy + 1}Z`} />
        </>
      );
    }
    case 'boba':
      return (
        <>
          <rect x="52" y={top} width="14" height={Math.max(4, eyeHeight - 1)} rx="2.5" />
          <rect x="94" y={top} width="14" height={Math.max(4, eyeHeight - 1)} rx="2.5" />
          {eyeHeight >= 10 && <circle cx="56" cy={cy - 2} r="1.6" fill="#131c19" stroke="none" />}
        </>
      );
    case 'sparky':
    default:
      return (
        <>
          <rect x="53" y={top} width="13" height={eyeHeight} rx={Math.min(5, eyeHeight / 2)} />
          <rect x="94" y={top} width="13" height={eyeHeight} rx={Math.min(5, eyeHeight / 2)} />
          {eyeHeight >= 11 && (
            <>
              <line x1="59.5" y1={cy - 3} x2="59.5" y2={cy + 3} stroke="#142229" strokeWidth="1.5" />
              <line x1="100.5" y1={cy - 3} x2="100.5" y2={cy + 3} stroke="#142229" strokeWidth="1.5" />
            </>
          )}
        </>
      );
  }
}

export function StudioCharacter({
  characterId,
  state,
  scale = 1,
  audioLevel = 0,
}: {
  characterId: CharacterId;
  state: CharacterState;
  scale?: number;
  audioLevel?: number;
}) {
  const model = characterCollection.find((c) => c.id === characterId) || characterCollection[0];
  const safeScale = Number.isFinite(scale) ? Math.max(0.4, Math.min(1.5, scale)) : 1;
  const width = Math.round(160 * safeScale);
  const height = Math.round(180 * safeScale);
  const level = Number.isFinite(audioLevel) ? Math.max(0.08, Math.min(1, audioLevel)) : 0.22;
  const speaking = state === 'talking';
  const eyeHeight =
    state === 'sleeping' ? 3 : state === 'thinking' ? 6 : state === 'listening' ? 19 : 14;
  const mouth = speaking ? Math.max(3, Math.min(14, 3 + level * 11)) : 2.5;
  const barMid = Math.max(4, Math.min(14, 3.5 + level * 10.5));
  const barSide = Math.max(3, Math.min(11, 2.5 + level * 7.5));
  const animation =
    state === 'waking'
      ? 'animate-companio-wake'
      : state === 'listening'
        ? 'animate-companio-listen'
        : state === 'thinking'
          ? 'animate-companio-think'
          : state === 'success'
            ? 'animate-companio-celebrate'
            : state === 'sleeping'
              ? ''
              : 'animate-companio-idle';
  const blinkClass = state === 'idle' ? 'companio-blink' : '';

  return (
    <div className="pointer-events-none select-none flex items-center justify-center">
      <svg width={width} height={height} viewBox="0 0 160 180" aria-hidden="true" data-character={model.id} data-optics={model.opticsStyle} data-state={state} className={`studio-character ${animation}`}>
        <image href={`${import.meta.env.BASE_URL}characters/${model.id}.svg`} width="160" height="180" />
        <g
          fill={model.accent}
          stroke={model.accent}
          strokeLinecap="round"
          opacity={state === 'sleeping' ? 0.65 : 1}
        >
          {state === 'success' ? (
            <g fill="none" strokeWidth="3">
              {model.id === 'pixel' || model.id === 'kiko' ? (
                <>
                  <path d="M52 78 L59 69 L66 78" />
                  <path d="M94 78 L101 69 L108 78" />
                </>
              ) : (
                <>
                  <path d="M53 78Q59 65 66 78" />
                  <path d="M94 78Q101 65 107 78" />
                </>
              )}
            </g>
          ) : state === 'confused' ? (
            <>
              <rect x="53" y="66" width="13" height="16" rx={model.id === 'boba' ? 2.5 : 5} />
              <path d="M94 77 L107 71" strokeWidth="3" />
            </>
          ) : (
            <g className={blinkClass}>{renderIdleAndActiveOptics(model.id, eyeHeight, state)}</g>
          )}

          {state === 'thinking' && (
            <rect x="69" y="84" width="22" height="2" rx="1" className="companio-think-scan" opacity="0.85" />
          )}

          {state === 'listening' && (
            <circle cx="80" cy="89" r="3" fill="none" strokeWidth="1.6" opacity="0.7" />
          )}

          {state === 'success' ? (
            <path d="M72 87 Q80 94 88 87" fill="none" strokeWidth="2.2" />
          ) : state === 'confused' ? (
            <path d="M74 90 L86 87.5" fill="none" strokeWidth="2.2" />
          ) : speaking ? (
            <g>
              <rect x="70" y={89 - barSide / 2} width="3" height={barSide} rx="1.5" />
              <rect x="78.5" y={89 - barMid / 2} width="3" height={barMid} rx="1.5" />
              <rect x="87" y={89 - barSide / 2} width="3" height={barSide} rx="1.5" />
            </g>
          ) : (
            <rect x="74" y={89 - mouth / 2} width="12" height={mouth} rx={mouth / 2} />
          )}
        </g>
      </svg>
    </div>
  );
}
