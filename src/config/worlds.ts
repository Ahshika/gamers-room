/**
 * Worlds behind the portal for games that have real material for them (docs/PROJECT_AUDIT.md §3.1).
 * Every entry must be backed by the game's own data: its label appears in the game's `points` text
 * in games.json (checked by tests/unit/realms.test.ts), and the image is a real screenshot from the
 * game's repository. Games without an entry here still get a realm, built from games.json only.
 */
export type WorldMotif = 'logic' | 'memory' | 'pattern' | 'spatial' | 'word';

export interface WorldDefinition {
  id: string;
  label: string;
  motif: WorldMotif;
  /** Colour of this world (degrees); each world also has its own motif, not just a colour. */
  hue: number;
  /** Path under the site base; a real, cropped screenshot of the game. */
  image: string;
}

export const GAME_WORLDS: Readonly<Record<string, readonly WorldDefinition[]>> = {
  // One-Brain/docs/screenshots/{logic,memory,pattern,spatial,word}.png, cropped to the puzzle area
  'one-brain': [
    { id: 'logic', label: 'Logic', motif: 'logic', hue: 36, image: 'media/worlds/one-brain/logic.webp' },
    { id: 'memory', label: 'Memory', motif: 'memory', hue: 268, image: 'media/worlds/one-brain/memory.webp' },
    { id: 'pattern', label: 'Pattern', motif: 'pattern', hue: 190, image: 'media/worlds/one-brain/pattern.webp' },
    { id: 'spatial', label: 'Spatial', motif: 'spatial', hue: 150, image: 'media/worlds/one-brain/spatial.webp' },
    { id: 'word', label: 'Word', motif: 'word', hue: 330, image: 'media/worlds/one-brain/word.webp' },
  ],
};
