import { action, KeyDownEvent, SingletonAction } from "@elgato/streamdeck";
import type { BaseTvActionSettings } from "../types";
import { resolveClient, wakeAndReconnect } from "./action-helpers";

@action({ UUID: "com.will-voorhees.smart-tv-control.toggle-mute" })
export class ToggleMute extends SingletonAction<BaseTvActionSettings> {
    private _inFlight = false;

    override async onKeyDown(ev: KeyDownEvent<BaseTvActionSettings>): Promise<void> {
        const client = resolveClient(ev.payload.settings?.tvId);
        if (!client) return;
        if (this._inFlight) return;
        this._inFlight = true;
        await wakeAndReconnect(client);
        try {
            await client.waitForConnected();
            const res = await client.request("ssap://audio/getMute") as { mute: boolean };
            await client.request("ssap://audio/setMute", { mute: !res.mute });
        } catch { /* ignore */ }
        finally { this._inFlight = false; }
    }
}
