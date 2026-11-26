import { CharacterId } from '../../types';

export interface CompanionProfile {
  id: CharacterId;
  name: string;
  role: string;
  desc: string;
  accent: string;
  personality: string;
  opticsStyle: string;
  voiceSummary: string;
}

export const characterCollection: CompanionProfile[] = [
  {
    id: 'sparky',
    name: 'Sparky',
    role: 'Precision robot',
    desc: 'Brushed titanium, a panoramic visor and measured movement.',
    accent: '#9df5da',
    personality: 'Crisp, structured and methodical — highlights clear task steps and verification status.',
    opticsStyle: 'Calibrated twin precision lenses with vertical iris apertures',
    voiceSummary: 'Neutral, articulate cadence with quick acknowledgement cues'
  },
  {
    id: 'pixel',
    name: 'Pixel',
    role: 'Cybernetic fox',
    desc: 'Angular copper armor and an alert, compact silhouette.',
    accent: '#ffdb9c',
    personality: 'Nimble and curious — tuned for fast search, coding shortcuts and sharp focus.',
    opticsStyle: 'Tactical inward-angled wedge optics in warm amber',
    voiceSummary: 'Upbeat, responsive pitch for rapid command feedback'
  },
  {
    id: 'mochi',
    name: 'Mochi',
    role: 'Ceramic rover',
    desc: 'Porcelain shell, low center of gravity and quiet movement.',
    accent: '#c7e3fd',
    personality: 'Calm and unhurried — keeps notifications understated and uncluttered.',
    opticsStyle: 'Rounded porcelain capsules with balanced ice-blue aperture fill',
    voiceSummary: 'Soft, even-paced tone suited to quiet workspaces'
  },
  {
    id: 'cloudie',
    name: 'Cloudie',
    role: 'Hover drone',
    desc: 'Suspended graphite and pearl modules with a restrained light band.',
    accent: '#b9caff',
    personality: 'Observant and analytical — keeps context lightweight while multitasking across apps.',
    opticsStyle: 'Panoramic telemetry bridge linking dual circular optical nodes',
    voiceSummary: 'Clean, composed intonation with minimal conversational filler'
  },
  {
    id: 'kiko',
    name: 'Kiko',
    role: 'Obsidian feline',
    desc: 'A dark sculpted feline with amber optical expressions.',
    accent: '#ffc77e',
    personality: 'Attentive and selective — stays low-profile until summoned cleanly.',
    opticsStyle: 'Sculpted feline almond optics with expressive inner brow tilt',
    voiceSummary: 'Measured, deliberate pacing with crisp sentence endings'
  },
  {
    id: 'boba',
    name: 'Boba',
    role: 'Utility droid',
    desc: 'Industrial olive chassis and a practical, stable stance.',
    accent: '#d4eda7',
    personality: 'Dependable and direct — built around repeatable local automation workflows.',
    opticsStyle: 'Industrial rectilinear diagnostic lenses in sage chartreuse',
    voiceSummary: 'Grounded, direct phrasing with concise step confirmations'
  }
];
