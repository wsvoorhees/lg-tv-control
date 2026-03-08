import { action, KeyDownEvent, SingletonAction } from "@elgato/streamdeck";
import { tvClient } from "../tv-client";

@action({ UUID: "com.will-voorhees.lg-tv-control.media-rewind" })
export class MediaRewind extends SingletonAction {
    override async onKeyDown(_ev: KeyDownEvent): Promise<void> {
        if (tvClient.state === "disconnected") { tvClient.wakeOnLan(); tvClient.reconnect(); }
        try {
            await tvClient.waitForConnected();
            await tvClient.request("ssap://media.controls/rewind");
        } catch { /* ignore */ }
    }
}
