import { action, KeyDownEvent, SingletonAction, WillAppearEvent } from "@elgato/streamdeck";
import { tvClient } from "../tv-client";

type VolumeUpSettings = {
    tvIpAddress?: string;
};

@action({ UUID: "com.will-voorhees.lg-tv-control.volume-up" })
export class VolumeUp extends SingletonAction<VolumeUpSettings> {
    override onWillAppear(ev: WillAppearEvent<VolumeUpSettings>): void {
        const { tvIpAddress } = ev.payload.settings;
        if (tvIpAddress) {
            tvClient.connect(tvIpAddress);
        }
    }

    override async onKeyDown(ev: KeyDownEvent<VolumeUpSettings>): Promise<void> {
        const { tvIpAddress } = ev.payload.settings;
        if (!tvIpAddress) {
            ev.action.setTitle("No IP");
            return;
        }
        if (tvClient.state !== "connected") return;
        try { await tvClient.request("ssap://audio/volumeUp"); } catch { /* ignore */ }
    }
}
