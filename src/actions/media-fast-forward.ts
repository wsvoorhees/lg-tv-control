import { action, KeyDownEvent, SingletonAction } from "@elgato/streamdeck";
import { tvClient } from "../tv-client";

@action({ UUID: "com.will-voorhees.lg-tv-control.media-fast-forward" })
export class MediaFastForward extends SingletonAction {
    override async onKeyDown(_ev: KeyDownEvent): Promise<void> {
        if (tvClient.state !== "connected") return;
        try { await tvClient.request("ssap://media.controls/fastForward"); } catch { /* ignore */ }
    }
}
