import { action, KeyDownEvent, SingletonAction } from "@elgato/streamdeck";
import type { BaseTvActionSettings } from "../types";
import { resolveClient } from "./action-helpers";

@action({ UUID: "com.will-voorhees.lg-tv-control.media-pause" })
export class MediaPause extends SingletonAction<BaseTvActionSettings> {
    override async onKeyDown(ev: KeyDownEvent<BaseTvActionSettings>): Promise<void> {
        const client = resolveClient(ev.payload.settings?.tvId);
        if (!client) return;
        if (client.state === "disconnected") { await client.wakeOnLan(); client.reconnect(); }
        try {
            await client.waitForConnected();
            await client.request("ssap://media.controls/pause");
        } catch { /* ignore */ }
    }
}
