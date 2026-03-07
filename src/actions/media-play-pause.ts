import { action, KeyDownEvent, SingletonAction } from "@elgato/streamdeck";
import { tvClient } from "../tv-client";

@action({ UUID: "com.will-voorhees.lg-tv-control.media-play-pause" })
export class MediaPlayPause extends SingletonAction {
    private _playing = false;

    override async onKeyDown(_ev: KeyDownEvent): Promise<void> {
        if (tvClient.state !== "connected") return;
        const wasPlaying = this._playing;
        this._playing = !wasPlaying;
        try {
            await tvClient.request(wasPlaying ? "ssap://media.controls/pause" : "ssap://media.controls/play");
        } catch {
            this._playing = wasPlaying; // revert on failure
        }
    }
}
