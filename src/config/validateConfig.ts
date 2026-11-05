import type { ExperienceConfig } from './experience.config';

/** True only for an https URL whose origin is in the allowlist (no credentials, no other scheme). */
export function isAllowedNavigationUrl(value: string, allowedOrigins: readonly string[]): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' || url.username || url.password) return false;
  return allowedOrigins.includes(url.origin);
}

/** Returns every problem found; an empty list means the configuration is usable. */
export function validateConfig(config: ExperienceConfig): string[] {
  const errors: string[] = [];
  for (const origin of config.allowedOrigins) {
    if (!/^https:\/\/[a-z0-9.-]+$/i.test(origin)) errors.push(`allowedOrigins: ${origin} is not an https origin`);
  }
  const urls = {
    entryUrl: config.entryUrl,
    gamesPortfolioUrl: config.gamesPortfolioUrl,
    gamesDataUrl: config.gamesDataUrl,
    fallbackUrl: config.fallbackUrl,
  };
  for (const [key, value] of Object.entries(urls)) {
    if (!isAllowedNavigationUrl(value, config.allowedOrigins)) errors.push(`${key}: ${value} is not an allowed https URL`);
  }
  if (config.entryUrl === config.gamesPortfolioUrl) errors.push('gamesPortfolioUrl must differ from entryUrl');

  const t = config.timeline;
  const order: (keyof typeof t)[] = ['reveal', 'awaken', 'worlds', 'message1', 'message2', 'fullPower', 'entry', 'end'];
  for (let i = 0; i < order.length; i++) {
    const key = order[i] as keyof typeof t;
    const value = t[key];
    if (!Number.isFinite(value) || value < 0) errors.push(`timeline.${key} must be a non-negative number`);
    const prevKey = order[i - 1];
    if (prevKey !== undefined && !(value > t[prevKey])) errors.push(`timeline.${key} must come after timeline.${prevKey}`);
  }
  if (t.end < 15 || t.end > 40) errors.push('timeline.end must stay between 15 and 40 seconds');

  const intro = config.intro;
  for (const key of ['loadTimeoutMs', 'dataTimeoutMs', 'fallbackAutoContinueMs', 'calmSeconds', 'maxWorlds'] as const) {
    if (!(intro[key] > 0)) errors.push(`intro.${key} must be positive`);
  }
  if (intro.dataTimeoutMs >= intro.loadTimeoutMs) errors.push('intro.dataTimeoutMs must be shorter than intro.loadTimeoutMs');

  if (!(config.audio.masterVolume >= 0 && config.audio.masterVolume <= 1)) errors.push('audio.masterVolume must be within 0..1');
  for (const [level, p] of Object.entries(config.quality.presets)) {
    if (!(p.maxDpr >= 1 && p.maxDpr <= 3)) errors.push(`quality.${level}.maxDpr must be within 1..3`);
    if (!(p.particles > 0 && p.particles <= 10_000)) errors.push(`quality.${level}.particles out of range`);
  }
  return errors;
}
