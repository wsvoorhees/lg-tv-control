import { SingletonAction, WillAppearEvent, WillDisappearEvent, DidReceiveSettingsEvent } from "@elgato/streamdeck";
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
        this._register(ev.action, ev.payload.settings?.tvId);
    }

    override onDidReceiveSettings(ev: DidReceiveSettingsEvent<BaseTvActionSettings>): void {
        this._register(ev.action, ev.payload.settings?.tvId);
    }

    override onWillDisappear(ev: WillDisappearEvent): void {
        const actionId = ev.action.id;
        const handler = this._handlers.get(actionId);
        if (handler) {
            tvClientPool.off("stateChange", handler);
            this._handlers.delete(actionId);
        }
    }

    private _register(action: { id: string; setTitle(t: string): void }, tvId: string | undefined): void {
        const actionId = action.id;
        const client = resolveClient(tvId);
        action.setTitle(STATE_LABELS[client?.state ?? "disconnected"]);

        const existing = this._handlers.get(actionId);
        if (existing) tvClientPool.off("stateChange", existing);

        // Resolve targetId dynamically so stateChange events are matched correctly
        // even if getDefaultId() was not yet available when the handler was registered
        // (onWillAppear fires before tvClientPool.configure() runs at startup).
        const handler = (changedId: string, state: ConnectionState) => {
            // Use tvId if it still resolves to a known TV; otherwise fall back to the
            // default TV (handles stale UUIDs left in settings after a TV is removed/re-added).
            const effectiveId = (tvId && tvClientPool.get(tvId)) ? tvId : tvClientPool.getDefaultId();
            if (changedId === effectiveId) {
                action.setTitle(STATE_LABELS[state]);
            }
        };
        this._handlers.set(actionId, handler);
        tvClientPool.on("stateChange", handler);
    }
}
