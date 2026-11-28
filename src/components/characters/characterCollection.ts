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
    role: 'Astral sprite',
    desc: 'Porcelain studio sprite in an emerald mantle crowned by a warm brushed-brass star.',
    accent: '#146a59',
    personality: 'Structured and methodical — highlights clear workflow steps and verification.',
    opticsStyle: 'Celadon-jade irises with refined arched brows',
    voiceSummary: 'Balanced, crisp articulation (Microsoft Mark cadence)'
  },
  {
    id: 'pixel',
    name: 'Pixel',
    role: 'Woodland fox',
    desc: 'Warm terracotta kit fox with cream ruffs, slate kerchief, and alert ears.',
    accent: '#ea580c',
    personality: 'Nimble and inquisitive — built for fast research, code lookup, and shortcuts.',
    opticsStyle: 'Alert chestnut-amber eyes framed over cream cheek ruffs',
    voiceSummary: 'Upbeat, responsive cadence for rapid task feedback'
  },
  {
    id: 'mochi',
    name: 'Mochi',
    role: 'Ivory Shiba',
    desc: 'Warm porcelain-ivory Shiba companion wearing a sage studio knit scarf.',
    accent: '#d97706',
    personality: 'Calm and unhurried — keeps updates concise without visual noise.',
    opticsStyle: 'Soulful espresso eyes with warm honey highlights',
    voiceSummary: 'Soft, even-paced tone suited to quiet workspaces'
  },
  {
    id: 'cloudie',
    name: 'Cloudie',
    role: 'Scholar owl',
    desc: 'Slate-plumage barn owl in antique-brass spectacles with calm blue-gold gaze.',
    accent: '#2563eb',
    personality: 'Reflective and analytical — keeps context structured across multi-step work.',
    opticsStyle: 'Sapphire-framed scholar eyes behind antique-brass spectacles',
    voiceSummary: 'Composed, articulate intonation with minimal filler'
  },
  {
    id: 'kiko',
    name: 'Kiko',
    role: 'Obsidian feline',
    desc: 'Sculpted midnight cat familiar with a jade scarf and warm golden gaze.',
    accent: '#f59e0b',
    personality: 'Attentive and discerning — stays poised at rest until summoned.',
    opticsStyle: 'Golden-amber feline irises with fine upper lashes',
    voiceSummary: 'Measured, deliberate pacing with crisp sentence endings'
  },
  {
    id: 'boba',
    name: 'Boba',
    role: 'Red panda',
    desc: 'Chestnut red panda with cream cheek markings, striped tail, and sage bandana.',
    accent: '#9a3412',
    personality: 'Dependable and grounded — tailored for steady everyday desktop workflows.',
    opticsStyle: 'Warm glossy espresso-caramel eyes with cream brow pips',
    voiceSummary: 'Warm, grounded phrasing with straightforward status updates'
  }
];
