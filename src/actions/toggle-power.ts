import { action, KeyDownEvent, SingletonAction, WillAppearEvent, WillDisappearEvent } from "@elgato/streamdeck";
import { tvClient, type ConnectionState } from "../tv-client";

const STATE_LABELS: Record<ConnectionState, string> = {
    disconnected: "Off",
    connecting: "...",
    connected: "On",
};

@action({ UUID: "com.will-voorhees.lg-tv-control.toggle-power" })
export class TogglePower extends SingletonAction {
    private _stateChangeHandlers = new Map<string, (state: ConnectionState) => void>();

    override onWillAppear(ev: WillAppearEvent): void {
        const id = ev.action.id;
        ev.action.setTitle(STATE_LABELS[tvClient.state]);

        const existing = this._stateChangeHandlers.get(id);
        if (existing) tvClient.off("stateChange", existing);

        const handler = (state: ConnectionState) => {
            ev.action.setTitle(STATE_LABELS[state]);
        };
        this._stateChangeHandlers.set(id, handler);
        tvClient.on("stateChange", handler);
    }

    override onWillDisappear(ev: WillDisappearEvent): void {
        const id = ev.action.id;
        const handler = this._stateChangeHandlers.get(id);
        if (handler) {
            tvClient.off("stateChange", handler);
            this._stateChangeHandlers.delete(id);
        }
    }

    override async onKeyDown(_ev: KeyDownEvent): Promise<void> {
        if (tvClient.state === "connected") {
            try { await tvClient.request("ssap://system/turnOff"); } catch { /* ignore */ }
        } else if (tvClient.state === "disconnected") {
            tvClient.reconnect();
        }
        // If "connecting", do nothing and let the connection complete
    }
}
