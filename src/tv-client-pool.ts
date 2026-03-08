import { EventEmitter } from "node:events";
import streamDeck from "@elgato/streamdeck";
import { TvClient } from "./tv-client.js";
import type { TvConfig, ConnectionState } from "./types.js";

export class TvClientPool extends EventEmitter {
    private _clients = new Map<string, TvClient>();
    private _stateHandlers = new Map<string, (state: ConnectionState) => void>();
    private _configs: TvConfig[] = [];

    /**
     * Synchronise the pool with a new TV list. Safe to call repeatedly —
     * existing clients are reused, removed TVs are disconnected, new TVs
     * are connected, and changed IPs trigger a reconnect.
     */
    configure(tvs: TvConfig[]): void {
        streamDeck.logger.debug(`[TvClientPool] configure: [${tvs.map(t => t.name).join(", ")}]`);

        // Remove TVs that are no longer in the list.
        const newIds = new Set(tvs.map(t => t.id));
        for (const [id] of this._clients) {
            if (!newIds.has(id)) this._remove(id);
        }

        // Create or reconnect each TV in the new list.
        for (const config of tvs) {
            if (!this._clients.has(config.id)) {
                this._create(config);
            } else {
                // TvClient.connect() is idempotent: same-IP + not-disconnected → early return.
                this._clients.get(config.id)!.connect(config.ip, config.mac);
            }
        }

        this._configs = [...tvs];
    }

    private _create(config: TvConfig): void {
        const client = new TvClient();
        const handler = (state: ConnectionState) => {
            this.emit("stateChange", config.id, state);
        };
        this._clients.set(config.id, client);
        this._stateHandlers.set(config.id, handler);
        client.on("stateChange", handler);
        client.connect(config.ip, config.mac);
    }

    private _remove(id: string): void {
        const client = this._clients.get(id);
        const handler = this._stateHandlers.get(id);
        if (client && handler) {
            client.off("stateChange", handler);
            client.disconnect();
        }
        this._clients.delete(id);
        this._stateHandlers.delete(id);
        this._configs = this._configs.filter(c => c.id !== id);
    }

    /** Return the TvClient for a given TV id, or undefined if not found. */
    get(tvId: string): TvClient | undefined {
        return this._clients.get(tvId);
    }

    /** Return the TvClient for the first configured TV (migration fallback). */
    getDefault(): TvClient | undefined {
        const first = this._configs[0];
        return first ? this._clients.get(first.id) : undefined;
    }

    /** Return the id of the first configured TV, or undefined. */
    getDefaultId(): string | undefined {
        return this._configs[0]?.id;
    }

    /** Snapshot of the current TV config list, in order. */
    getConfigs(): TvConfig[] {
        return [...this._configs];
    }
}

export const tvClientPool = new TvClientPool();
