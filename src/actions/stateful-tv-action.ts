import { SingletonAction, WillAppearEvent, WillDisappearEvent } from "@elgato/streamdeck";
import { tvClient, type ConnectionState } from "../tv-client";

export const STATE_LABELS: Record<ConnectionState, string> = {
    disconnected: "Off",
    connecting: "...",
    connected: "On",
};

/**
 * Base class for actions that display TV connection state on their title.
 * Manages per-instance stateChange listeners keyed by action ID, supporting
 * multiple simultaneously visible instances of the same action.
 */
export abstract class StatefulTvAction extends SingletonAction {
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
}
