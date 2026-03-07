import { action, KeyDownEvent, SingletonAction, WillAppearEvent } from "@elgato/streamdeck";
import { tvClient } from "../tv-client";

type MediaPauseSettings = {
    tvIpAddress?: string;
};

@action({ UUID: "com.will-voorhees.lg-tv-control.media-pause" })
export class MediaPause extends SingletonAction<MediaPauseSettings> {
    override onWillAppear(ev: WillAppearEvent<MediaPauseSettings>): void {
        const { tvIpAddress } = ev.payload.settings;
        if (tvIpAddress) {
            tvClient.connect(tvIpAddress);
        }
    }

    override async onKeyDown(ev: KeyDownEvent<MediaPauseSettings>): Promise<void> {
        const { tvIpAddress } = ev.payload.settings;
        if (!tvIpAddress) {
            ev.action.setTitle("No IP");
            return;
        }
        if (tvClient.state !== "connected") return;
        try { await tvClient.request("ssap://media.controls/pause"); } catch { /* ignore */ }
    }
}
