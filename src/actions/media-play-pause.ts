import { action, KeyDownEvent, SingletonAction } from "@elgato/streamdeck";
import { tvClient } from "../tv-client";

@action({ UUID: "com.will-voorhees.lg-tv-control.media-play-pause" })
export class MediaPlayPause extends SingletonAction {
    private _playing = false;

    override async onKeyDown(_ev: KeyDownEvent): Promise<void> {
        if (tvClient.state !== "connected") return;
        try {
            if (this._playing) {
                await tvClient.request("ssap://media.controls/pause");
                this._playing = false;
            } else {
                await tvClient.request("ssap://media.controls/play");
                this._playing = true;
            }
        } catch { /* ignore */ }
    }
}
