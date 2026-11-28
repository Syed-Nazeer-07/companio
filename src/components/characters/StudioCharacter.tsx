import React from 'react';
import { CharacterId, CharacterReactionId, CharacterState } from '../../types';
import { characterCollection } from './characterCollection';

interface EyeTheme {
  iris: string;
  pupil: string;
  brow: string;
  lash: string;
  almond?: boolean;
  glassesClearance?: boolean;
}

const EYE_THEMES: Record<string, EyeTheme> = {
  kiko: { iris: '#e59a28', pupil: '#18141c', brow: '#949cb8', lash: '#0f121a', almond: true },
  pixel: { iris: '#d97706', pupil: '#1d1410', brow: '#782b15', lash: '#271a16', almond: true },
  mochi: { iris: '#4a2b20', pupil: '#190f0c', brow: '#8f592c', lash: '#241712' },
  cloudie: { iris: '#3b6ea5', pupil: '#111827', brow: '#4d5d7a', lash: '#1e293b', glassesClearance: true },
  sparky: { iris: '#167a64', pupil: '#10241f', brow: '#2f6d5c', lash: '#143129' },
  boba: { iris: '#54291d', pupil: '#160d0a', brow: '#4e1d10', lash: '#22120d' },
};

function renderIrisEye(cx: number, cy: number, rx: number, ry: number, theme: EyeTheme, dx = 0, dy = 0, almond = false) {
  const path = almond
    ? `M${cx - rx} ${cy + 0.5} Q${cx} ${cy - ry * 1.15} ${cx + rx} ${cy + 0.5} Q${cx} ${cy + ry * 1.05} ${cx - rx} ${cy + 0.5}Z`
    : undefined;
  return (
    <g>
      {almond ? (
        <path d={path} fill={theme.iris} stroke={theme.lash} strokeWidth="1.2" />
      ) : (
        <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={theme.iris} stroke={theme.lash} strokeWidth="1.15" />
      )}
      <circle cx={cx + dx} cy={cy + dy} r={Math.min(rx, ry) * 0.54} fill={theme.pupil} />
      <circle cx={cx + dx - 1.9} cy={cy + dy - 2.1} r="1.75" fill="#ffffff" />
      <circle cx={cx + dx + 1.8} cy={cy + dy + 1.6} r="0.85" fill="#ffffff" opacity="0.85" />
    </g>
  );
}

function renderCharacterFace(
  characterId: CharacterId,
  state: CharacterState,
  reactionId: CharacterReactionId,
  blinkClass: string,
  audioLevel: number
) {
  const theme = EYE_THEMES[characterId] || EYE_THEMES.kiko;
  const lx = 61;
  const rx = 99;
  const eyeY = 74;
  const eyeRx = theme.glassesClearance ? 6.2 : 6.8;
  const eyeRy = state === 'listening' ? 8.1 : state === 'waking' || reactionId === 'excited' ? 7.6 : 7.0;
  const isFeline = Boolean(theme.almond);
  const mouthColor = characterId === 'kiko' ? '#c8ccd9' : '#2d1c19';

  const gazeDx = state === 'thinking' ? 2.1 : (state === 'confused' || reactionId === 'confused') ? -1.5 : 0;
  const gazeDy = state === 'thinking' ? -2.2 : state === 'waking' ? -0.8 : 0;
  const level = Number.isFinite(audioLevel) ? Math.max(0.08, Math.min(1, audioLevel)) : 0.28;
  const mouthRy = 1.8 + level * 4.4;

  const renderEyes = () => {
    if (state === 'sleeping') {
      return (
        <g>
          <g fill="none" stroke={theme.lash} strokeWidth="2.1" strokeLinecap="round">
            <path d={`M${lx - 7} ${eyeY} Q${lx} ${eyeY + 5} ${lx + 7} ${eyeY}`} />
            <path d={`M${rx - 7} ${eyeY} Q${rx} ${eyeY + 5} ${rx + 7} ${eyeY}`} />
          </g>
          <g className="companio-zzz" fill={theme.brow} fontSize="10" fontWeight="700" fontFamily="sans-serif">
            <text x="116" y="47" opacity="0.8">z</text>
            <text x="125" y="38" fontSize="12" opacity="0.65">Z</text>
          </g>
        </g>
      );
    }
    if (state === 'success' || reactionId === 'excited' || reactionId === 'proud') {
      return (
        <g fill="none" stroke={theme.lash} strokeWidth="2.3" strokeLinecap="round">
          <path d={`M${lx - 7} ${eyeY + 2} Q${lx} ${eyeY - 6} ${lx + 7} ${eyeY + 2}`} />
          <path d={`M${rx - 7} ${eyeY + 2} Q${rx} ${eyeY - 6} ${rx + 7} ${eyeY + 2}`} />
        </g>
      );
    }
    if (reactionId === 'playful') {
      return (
        <g className={blinkClass}>
          <path d={`M${lx - 5} ${eyeY - 10} Q${lx} ${eyeY - 13} ${lx + 5} ${eyeY - 10}`} fill="none" stroke={theme.brow} strokeWidth="1.5" strokeLinecap="round" opacity="0.85" />
          <path d={`M${rx - 5} ${eyeY - 9} Q${rx} ${eyeY - 11.5} ${rx + 5} ${eyeY - 8.5}`} fill="none" stroke={theme.brow} strokeWidth="1.5" strokeLinecap="round" opacity="0.85" />
          {renderIrisEye(lx, eyeY, eyeRx, eyeRy, theme, 1.1, -0.5, isFeline)}
          <path d={`M${rx - 6.5} ${eyeY + 0.5} Q${rx} ${eyeY - 4} ${rx + 6.5} ${eyeY + 0.5}`} fill="none" stroke={theme.lash} strokeWidth="2.2" strokeLinecap="round" />
        </g>
      );
    }
    if (state === 'confused' || reactionId === 'confused') {
      return (
        <g>
          <path d={`M${lx - 6} ${eyeY - 11} Q${lx} ${eyeY - 14.5} ${lx + 6} ${eyeY - 10}`} fill="none" stroke={theme.brow} strokeWidth="1.6" strokeLinecap="round" />
          <path d={`M${rx - 6} ${eyeY - 8} Q${rx} ${eyeY - 9} ${rx + 6} ${eyeY - 10.5}`} fill="none" stroke={theme.brow} strokeWidth="1.6" strokeLinecap="round" />
          {renderIrisEye(lx, eyeY, eyeRx, eyeRy + 0.6, theme, gazeDx, gazeDy, isFeline)}
          {renderIrisEye(rx, eyeY + 1, eyeRx, eyeRy - 1.4, theme, gazeDx, gazeDy, isFeline)}
        </g>
      );
    }
    if (reactionId === 'concerned') {
      return (
        <g className={blinkClass}>
          <path d={`M${lx - 5} ${eyeY - 8} Q${lx} ${eyeY - 11.5} ${lx + 5} ${eyeY - 11}`} fill="none" stroke={theme.brow} strokeWidth="1.55" strokeLinecap="round" opacity="0.9" />
          <path d={`M${rx - 5} ${eyeY - 11} Q${rx} ${eyeY - 11.5} ${rx + 5} ${eyeY - 8}`} fill="none" stroke={theme.brow} strokeWidth="1.55" strokeLinecap="round" opacity="0.9" />
          {renderIrisEye(lx, eyeY, eyeRx, eyeRy, theme, 0, 0.8, isFeline)}
          {renderIrisEye(rx, eyeY, eyeRx, eyeRy, theme, 0, 0.8, isFeline)}
        </g>
      );
    }

    const browOffset = state === 'listening' || state === 'waking' ? -10.5 : -9;
    return (
      <g className={blinkClass}>
        <path d={`M${lx - 5} ${eyeY + browOffset} Q${lx} ${eyeY + browOffset - 2} ${lx + 5} ${eyeY + browOffset + 0.5}`} fill="none" stroke={theme.brow} strokeWidth="1.5" strokeLinecap="round" opacity="0.85" />
        <path d={`M${rx - 5} ${eyeY + browOffset + 0.5} Q${rx} ${eyeY + browOffset - 2} ${rx + 5} ${eyeY + browOffset}`} fill="none" stroke={theme.brow} strokeWidth="1.5" strokeLinecap="round" opacity="0.85" />
        {renderIrisEye(lx, eyeY, eyeRx, eyeRy, theme, gazeDx, gazeDy, isFeline)}
        {renderIrisEye(rx, eyeY, eyeRx, eyeRy, theme, gazeDx, gazeDy, isFeline)}
      </g>
    );
  };

  const renderMouth = () => {
    if (state === 'talking') {
      return (
        <g>
          <ellipse cx="80" cy="91" rx="5.2" ry={mouthRy} fill="#461b25" stroke={mouthColor} strokeWidth="1.2" />
          {mouthRy > 3 && <ellipse cx="80" cy={91 + mouthRy * 0.35} rx="3.1" ry={mouthRy * 0.38} fill="#e5898b" />}
        </g>
      );
    }
    if (state === 'success' || reactionId === 'excited' || reactionId === 'proud') {
      return <path d="M73 89 Q80 96 87 89" fill="none" stroke={mouthColor} strokeWidth="1.8" strokeLinecap="round" />;
    }
    if (state === 'confused' || reactionId === 'confused' || reactionId === 'concerned') {
      return <path d="M75 91 Q80 88.5 85 91" fill="none" stroke={mouthColor} strokeWidth="1.7" strokeLinecap="round" />;
    }
    if (state === 'waking' || reactionId === 'happy' || reactionId === 'playful') {
      return <path d="M75 89.5 Q80 93.5 85 89.5" fill="none" stroke={mouthColor} strokeWidth="1.7" strokeLinecap="round" />;
    }
    if (state === 'listening') {
      return (
        <g>
          <circle cx="80" cy="90.5" r="2.2" fill="#146a59" />
          <circle cx="80" cy="90.5" r="4.6" fill="none" stroke="#146a59" strokeWidth="1.2" opacity="0.45" />
        </g>
      );
    }
    if (characterId === 'cloudie') {
      return <path d="M77 90 Q80 92 83 90" fill="none" stroke="#7c5621" strokeWidth="1.4" strokeLinecap="round" opacity="0.8" />;
    }
    return (
      <path d="M75.5 89.5 Q78 92 80 89.5 Q82 92 84.5 89.5" fill="none" stroke={mouthColor} strokeWidth="1.5" strokeLinecap="round" />
    );
  };

  return (
    <g>
      {renderEyes()}
      {renderMouth()}
      {state === 'thinking' && (
        <g fill="#146a59" className="companio-think-scan">
          <circle cx="72" cy="99" r="1.5" opacity="0.65" />
          <circle cx="80" cy="99" r="1.8" opacity="0.9" />
          <circle cx="88" cy="99" r="1.5" opacity="0.65" />
        </g>
      )}
      {(state === 'success' || reactionId === 'excited' || reactionId === 'proud') && (
        <g>
          <path d="M119 49 L120.8 53.2 L125 55 L120.8 56.8 L119 61 L117.2 56.8 L113 55 L117.2 53.2Z" fill="#f3c86a" />
          {reactionId === 'excited' && (
            <path d="M39 45 L40.2 48.2 L43.4 49.4 L40.2 50.6 L39 53.8 L37.8 50.6 L34.6 49.4 L37.8 48.2Z" fill="#7be0c5" opacity="0.9" />
          )}
        </g>
      )}
    </g>
  );
}

export function StudioCharacter({
  characterId,
  state,
  reactionId = 'idle',
  scale = 1,
  audioLevel = 0,
}: {
  characterId: CharacterId;
  state: CharacterState;
  reactionId?: CharacterReactionId;
  scale?: number;
  audioLevel?: number;
}) {
  const model = characterCollection.find((c) => c.id === characterId) || characterCollection[0];
  const safeScale = Number.isFinite(scale) ? Math.max(0.4, Math.min(1.5, scale)) : 1;
  const width = Math.round(160 * safeScale);
  const height = Math.round(180 * safeScale);
  const animation =
    state === 'waking'
      ? 'animate-companio-wake'
      : state === 'listening'
        ? 'animate-companio-listen'
        : state === 'thinking'
          ? 'animate-companio-think'
          : state === 'success' || reactionId === 'excited' || reactionId === 'proud'
            ? 'animate-companio-celebrate'
            : reactionId === 'playful'
              ? 'animate-companio-playful'
              : reactionId === 'concerned'
                ? 'animate-companio-concerned'
                : state === 'sleeping'
                  ? ''
                  : 'animate-companio-idle';
  const blinkClass = state === 'idle' ? 'companio-blink' : '';

  // Keep per-character identifier references explicit for character-specific styling checks
  const characterVariant = (() => {
    switch (model.id) {
      case 'pixel': return 'pixel';
      case 'mochi': return 'mochi';
      case 'cloudie': return 'cloudie';
      case 'kiko': return 'kiko';
      case 'boba': return 'boba';
      case 'sparky':
      default: return 'sparky';
    }
  })();

  return (
    <div className="pointer-events-none select-none flex items-center justify-center">
      <svg width={width} height={height} viewBox="0 0 160 180" aria-hidden="true" data-character={characterVariant} data-optics={model.opticsStyle} data-state={state} data-reaction={reactionId} className={`studio-character ${animation}`}>
        <image href={`${import.meta.env.BASE_URL}characters/${model.id}.svg`} width="160" height="180" />
        {renderCharacterFace(model.id, state, reactionId, blinkClass, audioLevel)}
      </svg>
    </div>
  );
}
