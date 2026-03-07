import { action, KeyDownEvent, SingletonAction, WillAppearEvent } from "@elgato/streamdeck";
import { tvClient } from "../tv-client";

type MediaFastForwardSettings = {
    tvIpAddress?: string;
};

@action({ UUID: "com.will-voorhees.lg-tv-control.media-fast-forward" })
export class MediaFastForward extends SingletonAction<MediaFastForwardSettings> {
    override onWillAppear(ev: WillAppearEvent<MediaFastForwardSettings>): void {
        const { tvIpAddress } = ev.payload.settings;
        if (tvIpAddress) {
            tvClient.connect(tvIpAddress);
        }
    }

    override async onKeyDown(ev: KeyDownEvent<MediaFastForwardSettings>): Promise<void> {
        const { tvIpAddress } = ev.payload.settings;
        if (!tvIpAddress) {
            ev.action.setTitle("No IP");
            return;
        }
        if (tvClient.state !== "connected") return;
        try { await tvClient.request("ssap://media.controls/fastForward"); } catch { /* ignore */ }
    }
}
