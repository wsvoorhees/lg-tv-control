# LG TV Control — Stream Deck Plugin

**Version 0.8-beta**

A Stream Deck plugin for controlling LG WebOS TVs over your local network using the SSAP (Simple Service Access Protocol) WebSocket API.

## Features

| Action | Description |
|--------|-------------|
| Toggle Power | Toggles the TV on or off |
| Power On | Wakes the TV from standby |
| Power Off | Turns the TV off |
| Set Input | Switches to a specific HDMI/input source |
| Volume Up | Increases volume |
| Volume Down | Decreases volume |
| Toggle Mute | Mutes or unmutes audio |
| Play | Sends the play command |
| Pause | Sends the pause command |
| Stop | Sends the stop command |
| Rewind | Sends the rewind command |
| Fast Forward | Sends the fast forward command |
| Launch App | Launches a specific app (e.g. Netflix, YouTube) |

## Requirements

- Elgato Stream Deck software 6.9 or later
- LG WebOS TV on the same local network
- Windows 10+ or macOS 12+

## Setup

### First-time pairing

1. Add any LG TV Control action to your Stream Deck.
2. Open the action's property inspector.
3. Either enter your TV's IP address manually, or use **Scan for TVs** to discover TVs on your network and select one from the dropdown.
4. Click **Connect**. Your TV will display a pairing prompt — accept it on screen.
5. The connection indicator in the property inspector will turn green when connected.

The pairing key is saved by the TV client and reused automatically on future connections.

### Input and app selection

The **Set Input** and **Launch App** actions have their own property inspector where you can pick from inputs or installed apps fetched live from the connected TV.

## Architecture

```
src/
  plugin.ts          — Entry point; registers actions, handles PI messages
  tv-client.ts       — TvClient singleton (EventEmitter) wrapping lgtv2
  tv-scanner.ts      — SSDP-based TV discovery on the local network
  actions/           — 13 individual action handlers
com.will-voorhees.lg-tv-control.sdPlugin/
  manifest.json      — Stream Deck plugin manifest
  ui/                — Property inspector HTML and JavaScript
  imgs/              — SVG icons for all actions
```

**Connection flow:** The user enters a TV IP and clicks Connect in the property inspector. This sends a `connect` event to the plugin backend, which calls `TvClient.connect(ip)`. The `lgtv2` library handles the WebSocket handshake and SSAP pairing. State changes (`disconnected` → `connecting` → `connected`) are pushed back to the property inspector in real time via `sendToPropertyInspector`.

**TV discovery:** The Scan for TVs button triggers an SSDP M-SEARCH for `urn:dial-multiscreen-org:service:dial:1`. Responding devices are enriched by fetching their UPnP device XML to extract the friendly name. Results are returned after a 6-second scan window.

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Watch and auto-reload plugin
npm run watch

# Run tests
npm test
```

### Linking to Stream Deck (first time)

```bash
npx streamdeck link
```

This creates a symlink from the Stream Deck plugins directory to the local `.sdPlugin` folder so changes are picked up without copying files.

### Viewing logs

```powershell
Get-ChildItem "$env:APPDATA\Elgato\StreamDeck\logs\com.will-voorhees.lg-tv-control*.log" | Sort-Object LastWriteTime -Descending | Select-Object -First 1 | ForEach-Object { Get-Content $_.FullName -Wait -Tail 50 }
```

## Dependencies

- [`@elgato/streamdeck`](https://www.npmjs.com/package/@elgato/streamdeck) — Stream Deck SDK v3
- [`lgtv2`](https://www.npmjs.com/package/lgtv2) — LG WebOS SSAP WebSocket client
- [`node-ssdp`](https://www.npmjs.com/package/node-ssdp) — SSDP discovery client

## License

MIT
