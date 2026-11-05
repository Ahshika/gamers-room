import { describe, expect, it } from 'vitest';
import site from '../../src/config/site.config.json';
import { MANDATORY_TEXT, experienceConfig, type ExperienceConfig } from '../../src/config/experience.config';
import { isAllowedNavigationUrl, validateConfig } from '../../src/config/validateConfig';

const ORIGINS = ['https://ahshika.github.io'];
const clone = (): ExperienceConfig => structuredClone(experienceConfig) as ExperienceConfig;

describe('site config (single source of truth)', () => {
  it('keeps the printed QR destination', () => {
    expect(site.entryUrl).toBe('https://ahshika.github.io/gamers-room/');
    expect(experienceConfig.entryUrl).toBe(site.entryUrl);
  });
  it('sends visitors to the real Games Portfolio', () => {
    expect(experienceConfig.gamesPortfolioUrl).toBe('https://ahshika.github.io/games/');
    expect(experienceConfig.gamesDataUrl).toBe('https://ahshika.github.io/games/data/games.json');
  });
  it('carries the mandatory texts unchanged', () => {
    expect(experienceConfig.text).toMatchObject(MANDATORY_TEXT);
  });
});

describe('isAllowedNavigationUrl', () => {
  it.each([
    ['https://ahshika.github.io/games/', true],
    ['https://ahshika.github.io/', true],
    ['http://ahshika.github.io/games/', false],
    ['https://evil.example/games/', false],
    ['https://ahshika.github.io.evil.example/', false],
    ['https://user:pw@ahshika.github.io/games/', false],
    ['javascript:alert(1)', false],
    ['/games/', false],
    ['', false],
  ])('%s → %s', (url, ok) => {
    expect(isAllowedNavigationUrl(url, ORIGINS)).toBe(ok);
  });
});

describe('validateConfig', () => {
  it('accepts the shipped configuration', () => {
    expect(validateConfig(experienceConfig)).toEqual([]);
  });
  it('rejects a foreign portfolio URL', () => {
    const c = clone();
    c.gamesPortfolioUrl = 'https://example.com/games/';
    expect(validateConfig(c).join()).toMatch(/gamesPortfolioUrl/);
  });
  it('rejects beats out of order', () => {
    const c = clone();
    c.timeline.entry = c.timeline.fullPower - 1;
    expect(validateConfig(c).join()).toMatch(/timeline.entry must come after timeline.fullPower/);
  });
  it('keeps the story at about 20–30 s and rejects extremes', () => {
    expect(experienceConfig.timeline.end).toBeGreaterThanOrEqual(20);
    expect(experienceConfig.timeline.end).toBeLessThanOrEqual(30);
    const c = clone();
    c.timeline.end = 90;
    expect(validateConfig(c).join()).toMatch(/timeline.end/);
  });
  it('requires the data timeout to be shorter than the load cap', () => {
    const c = clone();
    c.intro.dataTimeoutMs = c.intro.loadTimeoutMs;
    expect(validateConfig(c).join()).toMatch(/dataTimeoutMs/);
  });
  it('rejects an out-of-range volume and DPR', () => {
    const c = clone();
    c.audio.masterVolume = 2;
    c.quality.presets.low.maxDpr = 9;
    const errors = validateConfig(c).join();
    expect(errors).toMatch(/masterVolume/);
    expect(errors).toMatch(/maxDpr/);
  });
});
