import { SingletonAction, WillAppearEvent, WillDisappearEvent } from "@elgato/streamdeck";
import { tvClientPool } from "../tv-client-pool";
import type { ConnectionState } from "../tv-client";
import type { BaseTvActionSettings } from "../types";
import { resolveClient } from "./action-helpers";

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
export abstract class StatefulTvAction extends SingletonAction<BaseTvActionSettings> {
    private _handlers = new Map<string, (id: string, state: ConnectionState) => void>();

    override onWillAppear(ev: WillAppearEvent<BaseTvActionSettings>): void {
        const actionId = ev.action.id;
        const { tvId } = ev.payload.settings;
        const client = resolveClient(tvId);
        ev.action.setTitle(STATE_LABELS[client?.state ?? "disconnected"]);

        const existing = this._handlers.get(actionId);
        if (existing) tvClientPool.off("stateChange", existing);

        const targetId = tvId ?? tvClientPool.getDefaultId();
        const handler = (changedId: string, state: ConnectionState) => {
            if (changedId === targetId) {
                ev.action.setTitle(STATE_LABELS[state]);
            }
        };
        this._handlers.set(actionId, handler);
        tvClientPool.on("stateChange", handler);
    }

    override onWillDisappear(ev: WillDisappearEvent): void {
        const actionId = ev.action.id;
        const handler = this._handlers.get(actionId);
        if (handler) {
            tvClientPool.off("stateChange", handler);
            this._handlers.delete(actionId);
        }
    }
}
