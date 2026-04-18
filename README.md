# LG TV Control — Stream Deck Plugin

**Version 0.10.0.0**

A Stream Deck plugin for controlling LG WebOS TVs over your local network using the SSAP (Simple Service Access Protocol) WebSocket API. Supports multiple TVs simultaneously — each action can be assigned to a different TV.

## Features

| Action | Description |
|--------|-------------|
| Toggle Power | Toggles the TV on or off (Wake-on-LAN when off) |
| Power On | Wakes the TV from standby via Wake-on-LAN |
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

### Adding a TV

1. Open the **TV Connections** section in any action's property inspector.
2. Click **Add TV** and enter the TV's name and IP address. The MAC address is required for Wake-on-LAN (power on). You can auto-fill it by scanning for TVs first.
3. Click **Connect** next to the TV entry. Your TV will display a pairing prompt — accept it on screen.
4. The connection dot next to the TV name turns green when connected.

### Scanning for TVs

Click **Scan for TVs** to discover LG WebOS TVs on your local network. Discovered TVs appear in a dropdown. Selecting one pre-fills the name, IP, and MAC address fields.

### Assigning a TV to an action

Each action's property inspector has a **TV** picker. Select which configured TV that action should control. Actions default to the first configured TV if no selection is made.

### Input and app selection

The **Set Input** and **Launch App** actions fetch available inputs and installed apps live from the connected TV. Select from the dropdown after connecting.

## What's New in 0.10.0.0

- **Multi-TV support** — configure any number of TVs; each action independently targets a specific TV
- **TV Connections panel** — shared property inspector section for adding, editing, connecting, and disconnecting TVs
- **Network TV scanner** — SSDP-based discovery with automatic MAC address lookup via ARP
- **Wake-on-LAN** — Toggle Power and Power On send a WoL magic packet before reconnecting
- **Smarter reconnect logic** — connection retries cycle cleanly without flashing incorrect button states
- **Toggle Power title fix** — button correctly shows On/Off reflecting live connection state

## Architecture

```
src/
  plugin.ts           — Entry point; registers actions, handles PI messages
  tv-client.ts        — TvClient (EventEmitter) wrapping lgtv2; owns connection lifecycle
  tv-client-pool.ts   — TvClientPool; manages multiple TvClient instances keyed by UUID
  tv-scanner.ts       — SSDP-based TV discovery with ARP MAC address enrichment
  types.ts            — Shared types (TvConfig, ConnectionState, BaseTvActionSettings)
  actions/            — 13 individual action handlers + shared base classes
com.will-voorhees.lg-tv-control.sdPlugin/
  manifest.json       — Stream Deck plugin manifest
  ui/                 — Property inspector HTML and JavaScript (tv-selector.js shared component)
  imgs/               — SVG icons for all actions
```

**Connection flow:** TVs are configured via the property inspector and stored in global settings. On load, `TvClientPool.configure()` creates a `TvClient` per TV and begins connecting. State changes (`disconnected` → `connecting` → `connected`) are propagated via EventEmitter and reflected on button titles in real time.

**TV discovery:** The Scan for TVs button triggers an SSDP M-SEARCH for `urn:dial-multiscreen-org:service:dial:1`. Responding devices are enriched by fetching their UPnP device XML (friendly name) and running `arp` to resolve their MAC address. Results are returned after a 6-second scan window.

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
- [`wol`](https://www.npmjs.com/package/wol) — Wake-on-LAN magic packet sender

## License

MIT
