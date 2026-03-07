import { action, KeyDownEvent, SingletonAction, WillAppearEvent, WillDisappearEvent } from "@elgato/streamdeck";
import { tvClient, type ConnectionState } from "../tv-client";

type PowerOnSettings = {
    tvIpAddress?: string;
};

const STATE_LABELS: Record<ConnectionState, string> = {
    disconnected: "Off",
    connecting: "...",
    connected: "On",
};

@action({ UUID: "com.will-voorhees.lg-tv-control.power-on" })
export class PowerOn extends SingletonAction<PowerOnSettings> {
    override onWillAppear(ev: WillAppearEvent<PowerOnSettings>): void {
        const { tvIpAddress } = ev.payload.settings;
        if (tvIpAddress) {
            tvClient.connect(tvIpAddress);
        }
        ev.action.setTitle(STATE_LABELS[tvClient.state]);

        tvClient.on("stateChange", (state: ConnectionState) => {
            ev.action.setTitle(STATE_LABELS[state]);
        });
    }

    override onWillDisappear(_ev: WillDisappearEvent<PowerOnSettings>): void {
        tvClient.removeAllListeners("stateChange");
    }

    override onKeyDown(ev: KeyDownEvent<PowerOnSettings>): void {
        const { tvIpAddress } = ev.payload.settings;
        if (!tvIpAddress) {
            ev.action.setTitle("No IP");
            return;
        }
        tvClient.connect(tvIpAddress);
    }
}
