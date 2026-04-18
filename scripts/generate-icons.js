/**
 * Generates SVG icons for all Stream Deck actions.
 * Run with: node scripts/generate-icons.js
 *
 * Each action gets an icon.svg (action list sidebar) and key.svg (key face).
 * Both use 72x72 viewBox; the SDK scales the icon one down automatically.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT = "com.will-voorhees.smart-tv-control.sdPlugin/imgs/actions";

// Background matching the Stream Deck dark navy style
const BG = `<rect width="72" height="72" rx="8" fill="#1d2133"/>`;

// Reusable SVG fragment helpers
const white = (content) => content; // all paths are white by default

function svg(content) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 72">\n${BG}\n${content}\n</svg>\n`;
}

// ── Icon definitions ─────────────────────────────────────────────────────────

const icons = {
    // Two circular arrows (clockwise cycle) + vertical line
    // Center (36,36), r=22. Each arc covers ~150° (short clockwise arc, large-arc=0 sweep=1).
    // Arc 1: bearing 345°→135° (upper-right quadrant), arrowhead at lower-right end
    //   Start (345°): (30.3, 14.7)  End (135°): (51.6, 51.6)  tangent=(cos135°,sin135°)=(-0.707,0.707)
    // Arc 2: bearing 165°→315° (lower-left quadrant), arrowhead at upper-left end
    //   Start (165°): (41.7, 57.2)  End (315°): (20.4, 20.4)  tangent=(cos315°,sin315°)=(0.707,-0.707)
    "toggle-power": svg(`
  <path d="M30.3,14.7 A22,22 0 0 1 51.6,51.6" fill="none" stroke="white" stroke-width="5" stroke-linecap="round"/>
  <polygon points="51.6,51.6 60.1,48.7 54.5,43.1" fill="white"/>
  <path d="M41.7,57.2 A22,22 0 0 1 20.4,20.4" fill="none" stroke="white" stroke-width="5" stroke-linecap="round"/>
  <polygon points="20.4,20.4 11.9,23.3 17.5,28.9" fill="white"/>
  <line x1="36" y1="24" x2="36" y2="48" stroke="white" stroke-width="5" stroke-linecap="round"/>`),

    // Power circle (full) + vertical line — "on"
    "power-on": svg(`
  <line x1="36" y1="10" x2="36" y2="28" stroke="white" stroke-width="5" stroke-linecap="round"/>
  <circle cx="36" cy="40" r="18" fill="none" stroke="white" stroke-width="5"/>`),

    // Circle with X — "off"
    "turn-off": svg(`
  <circle cx="36" cy="36" r="20" fill="none" stroke="white" stroke-width="5"/>
  <line x1="24" y1="24" x2="48" y2="48" stroke="white" stroke-width="5" stroke-linecap="round"/>
  <line x1="48" y1="24" x2="24" y2="48" stroke="white" stroke-width="5" stroke-linecap="round"/>`),

    // Arrow pointing into a rectangle — set input
    "set-input": svg(`
  <rect x="38" y="16" width="22" height="40" rx="3" fill="none" stroke="white" stroke-width="4"/>
  <line x1="8" y1="36" x2="32" y2="36" stroke="white" stroke-width="4" stroke-linecap="round"/>
  <polyline points="23,27 32,36 23,45" fill="none" stroke="white" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`),

    // Speaker + upward arrow
    "volume-up": svg(`
  <path d="M10,27 L10,45 L21,45 L33,57 L33,15 L21,27 Z" fill="white"/>
  <line x1="52" y1="46" x2="52" y2="26" stroke="white" stroke-width="4" stroke-linecap="round"/>
  <polyline points="44,34 52,26 60,34" fill="none" stroke="white" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`),

    // Speaker + downward arrow
    "volume-down": svg(`
  <path d="M10,27 L10,45 L21,45 L33,57 L33,15 L21,27 Z" fill="white"/>
  <line x1="52" y1="26" x2="52" y2="46" stroke="white" stroke-width="4" stroke-linecap="round"/>
  <polyline points="44,38 52,46 60,38" fill="none" stroke="white" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`),

    // Speaker + X
    "toggle-mute": svg(`
  <path d="M10,27 L10,45 L21,45 L33,57 L33,15 L21,27 Z" fill="white"/>
  <line x1="43" y1="24" x2="63" y2="48" stroke="white" stroke-width="4" stroke-linecap="round"/>
  <line x1="63" y1="24" x2="43" y2="48" stroke="white" stroke-width="4" stroke-linecap="round"/>`),

    // Right-pointing triangle — play
    "media-play": svg(`
  <polygon points="18,12 18,60 58,36" fill="white"/>`),

    // Two vertical bars — pause
    "media-pause": svg(`
  <rect x="12" y="12" width="17" height="48" rx="3" fill="white"/>
  <rect x="43" y="12" width="17" height="48" rx="3" fill="white"/>`),

    // One vertical bar + right-pointing triangle — play/pause toggle
    "media-play-pause": svg(`
  <rect x="10" y="12" width="14" height="48" rx="3" fill="white"/>
  <polygon points="30,12 30,60 62,36" fill="white"/>`),

    // Filled square — stop
    "media-stop": svg(`
  <rect x="12" y="12" width="48" height="48" rx="5" fill="white"/>`),

    // Two left-pointing triangles — rewind
    "media-rewind": svg(`
  <polygon points="56,14 36,36 56,58" fill="white"/>
  <polygon points="34,14 14,36 34,58" fill="white"/>`),

    // Two right-pointing triangles — fast forward
    "media-fast-forward": svg(`
  <polygon points="16,14 36,36 16,58" fill="white"/>
  <polygon points="38,14 58,36 38,58" fill="white"/>`),

    // 3×3 grid of circles — apps/launch
    "launch-app": svg(`
  <circle cx="18" cy="18" r="7" fill="white"/>
  <circle cx="36" cy="18" r="7" fill="white"/>
  <circle cx="54" cy="18" r="7" fill="white"/>
  <circle cx="18" cy="36" r="7" fill="white"/>
  <circle cx="36" cy="36" r="7" fill="white"/>
  <circle cx="54" cy="36" r="7" fill="white"/>
  <circle cx="18" cy="54" r="7" fill="white"/>
  <circle cx="36" cy="54" r="7" fill="white"/>
  <circle cx="54" cy="54" r="7" fill="white"/>`),
};

// ── Write files ───────────────────────────────────────────────────────────────

for (const [name, content] of Object.entries(icons)) {
    const dir = join(OUT, name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "icon.svg"), content);
    writeFileSync(join(dir, "key.svg"), content);
    console.log(`✓ ${name}`);
}

console.log("\nDone — icons written to", OUT);
