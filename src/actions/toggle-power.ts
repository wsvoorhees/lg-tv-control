import { action, KeyDownEvent } from "@elgato/streamdeck";
import type { BaseTvActionSettings } from "../types";
import { resolveClient } from "./action-helpers";
import { StatefulTvAction } from "./stateful-tv-action";

@action({ UUID: "com.will-voorhees.lg-tv-control.toggle-power" })
export class TogglePower extends StatefulTvAction {
    override async onKeyDown(ev: KeyDownEvent<BaseTvActionSettings>): Promise<void> {
        const client = resolveClient(ev.payload.settings?.tvId);
        if (!client) return;
        if (client.state === "connected") {
            try { await client.request("ssap://system/turnOff"); } catch { /* ignore */ }
        } else if (client.state === "disconnected") {
            // Inlined rather than wakeAndReconnect(): the connected branch above means
            // this isn't a simple "if disconnected" guard — the state check is load-bearing
            await client.wakeOnLan();
            client.reconnect();
        }
        // If "connecting", do nothing
    }
}
