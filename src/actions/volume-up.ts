import { action, KeyDownEvent, SingletonAction } from "@elgato/streamdeck";
import { tvClient } from "../tv-client";

@action({ UUID: "com.will-voorhees.lg-tv-control.volume-up" })
export class VolumeUp extends SingletonAction {
    override async onKeyDown(_ev: KeyDownEvent): Promise<void> {
        if (tvClient.state === "disconnected") { tvClient.wakeOnLan(); tvClient.reconnect(); }
        try {
            await tvClient.waitForConnected();
            await tvClient.request("ssap://audio/volumeUp");
        } catch { /* ignore */ }
    }
}
