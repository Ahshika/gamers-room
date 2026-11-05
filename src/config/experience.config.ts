import site from './site.config.json';

export type QualityLevel = 'low' | 'medium' | 'high';

export interface QualityPreset {
  maxDpr: number;
  antialias: boolean;
  particles: number;
  fragments: number;
  monoliths: number;
}

/** Start times (seconds) of the storyboard scenes, docs/STORYBOARD.md. */
export interface TimelineBeats {
  reveal: number;
  awaken: number;
  worlds: number;
  message1: number;
  message2: number;
  fullPower: number;
  entry: number;
  end: number;
}

export interface ExperienceConfig {
  entryUrl: string;
  gamesPortfolioUrl: string;
  gamesDataUrl: string;
  fallbackUrl: string;
  allowedOrigins: readonly string[];
  intro: {
    enabled: boolean;
    skipEnabled: boolean;
    /** Hard cap for the loading screen; past it the visitor gets the fallback. */
    loadTimeoutMs: number;
    /** Games data request timeout; the intro still plays (without realms) when it fails. */
    dataTimeoutMs: number;
    /** On the fallback screen, the portfolio opens by itself after this delay. */
    fallbackAutoContinueMs: number;
    /** Reduced motion: still, active portal with the messages for this long, then the hand-off. */
    calmSeconds: number;
    /** At most this many worlds behind the portal. */
    maxWorlds: number;
  };
  timeline: TimelineBeats;
  audio: { defaultMuted: boolean; masterVolume: number };
  quality: { default: 'auto' | QualityLevel; presets: Record<QualityLevel, QualityPreset> };
  text: {
    title: string;
    tagline: string;
    loading: string;
    message1: string;
    message2: string;
    fallback: string;
  };
}

export const MANDATORY_TEXT = {
  title: 'THE GAMEVERSE',
  tagline: 'ENTER THE REALMS. DISCOVER THE GAMES.',
  loading: 'INITIALIZING THE GAMEVERSE...',
  message1: 'EVERY WORLD HAS A STORY.',
  message2: 'EVERY GAME IS A NEW ADVENTURE.',
} as const;

export const experienceConfig: ExperienceConfig = {
  entryUrl: site.entryUrl,
  gamesPortfolioUrl: site.gamesPortfolioUrl,
  gamesDataUrl: site.gamesDataUrl,
  fallbackUrl: site.fallbackUrl,
  allowedOrigins: site.allowedOrigins,
  intro: {
    enabled: true,
    skipEnabled: true,
    loadTimeoutMs: 12_000,
    dataTimeoutMs: 6_000,
    fallbackAutoContinueMs: 5_000,
    calmSeconds: 6,
    maxWorlds: 8,
  },
  timeline: {
    reveal: 0,
    awaken: 4.5,
    worlds: 9.5,
    message1: 15.5,
    message2: 17.2,
    fullPower: 19,
    entry: 21,
    end: 24,
  },
  audio: { defaultMuted: true, masterVolume: 0.5 },
  quality: {
    default: 'auto',
    presets: {
      low: { maxDpr: 1.25, antialias: false, particles: 500, fragments: 8, monoliths: 8 },
      medium: { maxDpr: 1.75, antialias: true, particles: 1200, fragments: 14, monoliths: 12 },
      high: { maxDpr: 2, antialias: true, particles: 2400, fragments: 20, monoliths: 16 },
    },
  },
  text: {
    ...MANDATORY_TEXT,
    fallback: 'The 3D gateway could not start on this device. The games are one tap away.',
  },
};
