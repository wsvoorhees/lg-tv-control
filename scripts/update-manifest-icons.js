/**
 * Updates manifest.json to reference per-action SVG icons.
 */
import { readFileSync, writeFileSync } from "node:fs";

const MANIFEST = "com.will-voorhees.lg-tv-control.sdPlugin/manifest.json";

// Map from action UUID suffix → icon folder name
const ACTION_ICONS = {
    "toggle-power": "toggle-power",
    "power-on": "power-on",
    "turn-off": "turn-off",
    "set-input": "set-input",
    "volume-up": "volume-up",
    "volume-down": "volume-down",
    "toggle-mute": "toggle-mute",
    "media-play": "media-play",
    "media-pause": "media-pause",
    "media-stop": "media-stop",
    "media-rewind": "media-rewind",
    "media-fast-forward": "media-fast-forward",
    "launch-app": "launch-app",
};

const manifest = JSON.parse(readFileSync(MANIFEST, "utf-8"));

for (const action of manifest.Actions) {
    const uuidSuffix = action.UUID.split(".").pop();
    const folder = ACTION_ICONS[uuidSuffix];
    if (!folder) continue;

    action.Icon = `imgs/actions/${folder}/icon`;
    for (const state of action.States) {
        state.Image = `imgs/actions/${folder}/key`;
    }
    console.log(`✓ ${action.Name} → imgs/actions/${folder}/`);
}

writeFileSync(MANIFEST, JSON.stringify(manifest, null, "\t") + "\n");
console.log("\nManifest updated.");
