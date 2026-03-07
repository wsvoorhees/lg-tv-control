import { action, KeyDownEvent, SingletonAction } from "@elgato/streamdeck";
import { tvClient } from "../tv-client";

@action({ UUID: "com.will-voorhees.lg-tv-control.toggle-mute" })
export class ToggleMute extends SingletonAction {
    override async onKeyDown(_ev: KeyDownEvent): Promise<void> {
        if (tvClient.state !== "connected") return;
        try {
            const res = await tvClient.request("ssap://audio/getMute") as { mute: boolean };
            await tvClient.request("ssap://audio/setMute", { mute: !res.mute });
        } catch { /* ignore */ }
    }
}
