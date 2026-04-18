import { action, KeyDownEvent, SingletonAction } from "@elgato/streamdeck";
import { tvClient } from "../tv-client";

@action({ UUID: "com.will-voorhees.lg-tv-control.toggle-mute" })
export class ToggleMute extends SingletonAction {
    private _inFlight = false;

    override async onKeyDown(_ev: KeyDownEvent): Promise<void> {
        if (this._inFlight) return;
        this._inFlight = true;
        if (tvClient.state === "disconnected") { await tvClient.wakeOnLan(); tvClient.reconnect(); }
        try {
            await tvClient.waitForConnected();
            const res = await tvClient.request("ssap://audio/getMute") as { mute: boolean };
            await tvClient.request("ssap://audio/setMute", { mute: !res.mute });
        } catch { /* ignore */ }
        finally { this._inFlight = false; }
    }
}
