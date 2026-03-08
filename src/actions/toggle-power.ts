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
            await client.wakeOnLan();
            client.reconnect();
        }
        // If "connecting", do nothing
    }
}
