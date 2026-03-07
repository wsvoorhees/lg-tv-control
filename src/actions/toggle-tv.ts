import { action, KeyDownEvent, SingletonAction, WillAppearEvent, WillDisappearEvent } from "@elgato/streamdeck";
import { tvClient, type ConnectionState } from "../tv-client";

type ToggleTvSettings = {
    tvIpAddress?: string;
};

const STATE_LABELS: Record<ConnectionState, string> = {
    disconnected: "Off",
    connecting: "...",
    connected: "On",
};

@action({ UUID: "com.will-voorhees.lg-tv-control.toggle-tv" })
export class ToggleTv extends SingletonAction<ToggleTvSettings> {
    override onWillAppear(ev: WillAppearEvent<ToggleTvSettings>): void {
        const { tvIpAddress } = ev.payload.settings;
        if (tvIpAddress) {
            tvClient.connect(tvIpAddress);
        }
        ev.action.setTitle(STATE_LABELS[tvClient.state]);

        tvClient.on("stateChange", (state: ConnectionState) => {
            ev.action.setTitle(STATE_LABELS[state]);
        });
    }

    override onWillDisappear(_ev: WillDisappearEvent<ToggleTvSettings>): void {
        tvClient.removeAllListeners("stateChange");
    }

    override async onKeyDown(ev: KeyDownEvent<ToggleTvSettings>): Promise<void> {
        const { tvIpAddress } = ev.payload.settings;
        if (!tvIpAddress) {
            ev.action.setTitle("No IP");
            return;
        }

        if (tvClient.state === "connected") {
            await tvClient.request("ssap://system/turnOff");
        } else if (tvClient.state === "disconnected") {
            tvClient.connect(tvIpAddress);
        }
        // If "connecting", do nothing and let the connection complete
    }
}
