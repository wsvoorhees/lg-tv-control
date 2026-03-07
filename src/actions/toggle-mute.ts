import { action, KeyDownEvent, SingletonAction, WillAppearEvent } from "@elgato/streamdeck";
import { tvClient } from "../tv-client";

type ToggleMuteSettings = {
    tvIpAddress?: string;
};

@action({ UUID: "com.will-voorhees.lg-tv-control.toggle-mute" })
export class ToggleMute extends SingletonAction<ToggleMuteSettings> {
    override onWillAppear(ev: WillAppearEvent<ToggleMuteSettings>): void {
        const { tvIpAddress } = ev.payload.settings;
        if (tvIpAddress) {
            tvClient.connect(tvIpAddress);
        }
    }

    override async onKeyDown(ev: KeyDownEvent<ToggleMuteSettings>): Promise<void> {
        const { tvIpAddress } = ev.payload.settings;
        if (!tvIpAddress) {
            ev.action.setTitle("No IP");
            return;
        }
        if (tvClient.state !== "connected") return;
        try {
            const res = await tvClient.request("ssap://audio/getMute") as { mute: boolean };
            await tvClient.request("ssap://audio/setMute", { mute: !res.mute });
        } catch { /* ignore */ }
    }
}
