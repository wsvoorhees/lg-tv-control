import lgtv2 from "lgtv2";
import { EventEmitter } from "node:events";

export type ConnectionState = "disconnected" | "connecting" | "connected";

type LgtvInstance = ReturnType<typeof lgtv2>;

export class TvClient extends EventEmitter {
    private client: LgtvInstance | null = null;
    private _state: ConnectionState = "disconnected";
    private _ip: string | null = null;
    private _mac: string | null = null;
    private _connectionId = 0;
    private _connectTimeout: ReturnType<typeof setTimeout> | null = null;
    private _connectAttempts = 0;

    get state(): ConnectionState {
        return this._state;
    }

    connect(ip: string, mac?: string): void {
        if (mac !== undefined) this._mac = mac || null;
        if (this._ip === ip && this._state !== "disconnected") return;

        this.disconnect();
        this._ip = ip;
        const id = this._connectionId;
        this._connectAttempts = 0;
        this._setState("connecting");

        this.client = lgtv2({ url: `ws://${ip}:3000`, reconnect: 5000 });

        this.client.on("connect", () => {
            if (id === this._connectionId) {
                this._connectAttempts = 0;
                this._setState("connected");
            }
        });

        this.client.on("connecting", () => {
            if (id === this._connectionId) this._setState("connecting");
        });

        this.client.on("close", () => {
            if (id === this._connectionId) this._setState("disconnected");
        });

        this.client.on("error", (_err: Error) => {
            if (id === this._connectionId) this._setState("disconnected");
        });
    }

    disconnect(): void {
        this._connectionId++;
        this._clearConnectTimeout();
        if (this.client) {
            this.client.disconnect();
            this.client = null;
        }
        this._ip = null;
        this._setState("disconnected");
    }

    request(url: string, payload?: object): Promise<unknown> {
        return new Promise((resolve, reject) => {
            if (!this.client || this._state !== "connected") {
                reject(new Error("Not connected"));
                return;
            }
            if (payload) {
                this.client.request(url, payload, (err: Error | null, res: unknown) => err ? reject(err) : resolve(res));
            } else {
                this.client.request(url, (err: Error | null, res: unknown) => err ? reject(err) : resolve(res));
            }
        });
    }

    reconnect(): void {
        if (this._ip) this.connect(this._ip);
    }

    waitForConnected(timeoutMs = 15000): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this._state === "connected") { resolve(); return; }
            if (this._state === "disconnected") { reject(new Error("Not connecting")); return; }

            let settled = false;
            const cleanup = () => {
                settled = true;
                clearTimeout(timer);
                this.off("stateChange", onStateChange);
            };
            const onStateChange = (state: ConnectionState) => {
                if (settled) return;
                if (state === "connected") { cleanup(); resolve(); }
                else if (state === "disconnected") { cleanup(); reject(new Error("Connection failed")); }
            };
            const timer = setTimeout(() => {
                if (!settled) { cleanup(); reject(new Error("Connection timeout")); }
            }, timeoutMs);
            this.on("stateChange", onStateChange);
        });
    }

    async wakeOnLan(): Promise<void> {
        if (!this._mac) return;
        try {
            const { wake } = await import("wol") as unknown as { wake: (mac: string) => Promise<boolean> };
            await wake(this._mac);
        } catch { /* ignore */ }
    }

    private _clearConnectTimeout(): void {
        if (this._connectTimeout) {
            clearTimeout(this._connectTimeout);
            this._connectTimeout = null;
        }
    }

    private _setState(state: ConnectionState): void {
        if (this._state === state) return;
        this._state = state;
        this._clearConnectTimeout();
        if (state === "connecting") {
            this._connectAttempts++;
            const id = this._connectionId;
            const attempt = this._connectAttempts;
            this._connectTimeout = setTimeout(() => {
                if (id === this._connectionId && this._state === "connecting") {
                    if (attempt >= 10) this.disconnect();
                    else this._setState("disconnected");
                }
            }, 10000);
        }
        this.emit("stateChange", state);
    }
}

export const tvClient = new TvClient();
