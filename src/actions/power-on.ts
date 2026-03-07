import { action, KeyDownEvent, SingletonAction, WillAppearEvent, WillDisappearEvent } from "@elgato/streamdeck";
import { tvClient, type ConnectionState } from "../tv-client";

const STATE_LABELS: Record<ConnectionState, string> = {
    disconnected: "Off",
    connecting: "...",
    connected: "On",
};

@action({ UUID: "com.will-voorhees.lg-tv-control.power-on" })
export class PowerOn extends SingletonAction {
    private _stateChangeHandler: ((state: ConnectionState) => void) | null = null;

    override onWillAppear(ev: WillAppearEvent): void {
        ev.action.setTitle(STATE_LABELS[tvClient.state]);

        if (this._stateChangeHandler) {
            tvClient.off("stateChange", this._stateChangeHandler);
        }
        this._stateChangeHandler = (state: ConnectionState) => {
            ev.action.setTitle(STATE_LABELS[state]);
        };
        tvClient.on("stateChange", this._stateChangeHandler);
    }

    override onWillDisappear(_ev: WillDisappearEvent): void {
        if (this._stateChangeHandler) {
            tvClient.off("stateChange", this._stateChangeHandler);
            this._stateChangeHandler = null;
        }
    }

    override onKeyDown(_ev: KeyDownEvent): void {
        tvClient.reconnect();
    }
}
