import { action, KeyDownEvent, SingletonAction } from "@elgato/streamdeck";
import type { BaseTvActionSettings } from "../types";
import { resolveClient, wakeAndReconnect } from "./action-helpers";

@action({ UUID: "com.will-voorhees.smart-tv-control.media-play-pause" })
export class MediaPlayPause extends SingletonAction<BaseTvActionSettings> {
    private _playing = false;

    override async onKeyDown(ev: KeyDownEvent<BaseTvActionSettings>): Promise<void> {
        const client = resolveClient(ev.payload.settings?.tvId);
        if (!client) return;
        await wakeAndReconnect(client);
        const wasPlaying = this._playing;
        this._playing = !wasPlaying;
        try {
            await client.waitForConnected();
            await client.request(wasPlaying ? "ssap://media.controls/pause" : "ssap://media.controls/play");
        } catch {
            this._playing = wasPlaying; // revert on failure
        }
    }
}
