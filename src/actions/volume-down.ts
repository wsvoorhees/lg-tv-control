import { action, KeyDownEvent, SingletonAction } from "@elgato/streamdeck";
import type { BaseTvActionSettings } from "../types";
import { resolveClient, wakeAndReconnect } from "./action-helpers";

@action({ UUID: "com.will-voorhees.lg-tv-control.volume-down" })
export class VolumeDown extends SingletonAction<BaseTvActionSettings> {
    override async onKeyDown(ev: KeyDownEvent<BaseTvActionSettings>): Promise<void> {
        const client = resolveClient(ev.payload.settings?.tvId);
        if (!client) return;
        await wakeAndReconnect(client);
        try {
            await client.waitForConnected();
            await client.request("ssap://audio/volumeDown");
        } catch { /* ignore */ }
    }
}
