import { action, KeyDownEvent, SingletonAction, WillAppearEvent, WillDisappearEvent } from "@elgato/streamdeck";
import { tvClient, type ConnectionState } from "../tv-client";

type TogglePowerSettings = {
    tvIpAddress?: string;
};

const STATE_LABELS: Record<ConnectionState, string> = {
    disconnected: "Off",
    connecting: "...",
    connected: "On",
};

@action({ UUID: "com.will-voorhees.lg-tv-control.toggle-power" })
export class TogglePower extends SingletonAction<TogglePowerSettings> {
    private _stateChangeHandler: ((state: ConnectionState) => void) | null = null;

    override onWillAppear(ev: WillAppearEvent<TogglePowerSettings>): void {
        const { tvIpAddress } = ev.payload.settings;
        if (tvIpAddress) {
            tvClient.connect(tvIpAddress);
        }
        ev.action.setTitle(STATE_LABELS[tvClient.state]);

        if (this._stateChangeHandler) {
            tvClient.off("stateChange", this._stateChangeHandler);
        }
        this._stateChangeHandler = (state: ConnectionState) => {
            ev.action.setTitle(STATE_LABELS[state]);
        };
        tvClient.on("stateChange", this._stateChangeHandler);
    }

    override onWillDisappear(_ev: WillDisappearEvent<TogglePowerSettings>): void {
        if (this._stateChangeHandler) {
            tvClient.off("stateChange", this._stateChangeHandler);
            this._stateChangeHandler = null;
        }
    }

    override async onKeyDown(ev: KeyDownEvent<TogglePowerSettings>): Promise<void> {
        const { tvIpAddress } = ev.payload.settings;
        if (!tvIpAddress) {
            ev.action.setTitle("No IP");
            return;
        }

        if (tvClient.state === "connected") {
            try { await tvClient.request("ssap://system/turnOff"); } catch { /* ignore */ }
        } else if (tvClient.state === "disconnected") {
            tvClient.connect(tvIpAddress);
        }
        // If "connecting", do nothing and let the connection complete
    }
}
