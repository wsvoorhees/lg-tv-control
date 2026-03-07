import { action, KeyDownEvent, SingletonAction, WillAppearEvent } from "@elgato/streamdeck";
import { tvClient } from "../tv-client";

type MediaRewindSettings = {
    tvIpAddress?: string;
};

@action({ UUID: "com.will-voorhees.lg-tv-control.media-rewind" })
export class MediaRewind extends SingletonAction<MediaRewindSettings> {
    override onWillAppear(ev: WillAppearEvent<MediaRewindSettings>): void {
        const { tvIpAddress } = ev.payload.settings;
        if (tvIpAddress) {
            tvClient.connect(tvIpAddress);
        }
    }

    override async onKeyDown(ev: KeyDownEvent<MediaRewindSettings>): Promise<void> {
        const { tvIpAddress } = ev.payload.settings;
        if (!tvIpAddress) {
            ev.action.setTitle("No IP");
            return;
        }
        if (tvClient.state !== "connected") return;
        try { await tvClient.request("ssap://media.controls/rewind"); } catch { /* ignore */ }
    }
}
