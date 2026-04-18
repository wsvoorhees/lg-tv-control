import { action, KeyDownEvent } from "@elgato/streamdeck";
import type { BaseTvActionSettings } from "../types";
import { resolveClient } from "./action-helpers";
import { StatefulTvAction } from "./stateful-tv-action";

@action({ UUID: "com.will-voorhees.lg-tv-control.turn-off" })
export class TurnOff extends StatefulTvAction {
    override async onKeyDown(ev: KeyDownEvent<BaseTvActionSettings>): Promise<void> {
        const client = resolveClient(ev.payload.settings?.tvId);
        if (!client) return;
        // No WOL: no point waking a TV just to turn it off
        if (client.state === "disconnected") client.reconnect();
        try {
            await client.waitForConnected();
            await client.request("ssap://system/turnOff");
        } catch { /* ignore */ }
    }
}
