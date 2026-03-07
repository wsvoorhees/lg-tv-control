import { action, KeyDownEvent, SingletonAction, WillAppearEvent, WillDisappearEvent } from "@elgato/streamdeck";
import { tvClient, type ConnectionState } from "../tv-client";

type TurnOffSettings = {
    tvIpAddress?: string;
};

const STATE_LABELS: Record<ConnectionState, string> = {
    disconnected: "Off",
    connecting: "...",
    connected: "On",
};

@action({ UUID: "com.will-voorhees.lg-tv-control.turn-off" })
export class TurnOff extends SingletonAction<TurnOffSettings> {
    private _stateChangeHandler: ((state: ConnectionState) => void) | null = null;

    override onWillAppear(ev: WillAppearEvent<TurnOffSettings>): void {
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

    override onWillDisappear(_ev: WillDisappearEvent<TurnOffSettings>): void {
        if (this._stateChangeHandler) {
            tvClient.off("stateChange", this._stateChangeHandler);
            this._stateChangeHandler = null;
        }
    }

    override async onKeyDown(ev: KeyDownEvent<TurnOffSettings>): Promise<void> {
        const { tvIpAddress } = ev.payload.settings;
        if (!tvIpAddress) {
            ev.action.setTitle("No IP");
            return;
        }
        if (tvClient.state !== "connected") return;
        await tvClient.request("ssap://system/turnOff");
    }
}
