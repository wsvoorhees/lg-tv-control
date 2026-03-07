import lgtv2 from "lgtv2";
import { EventEmitter } from "node:events";

export type ConnectionState = "disconnected" | "connecting" | "connected";

type LgtvInstance = ReturnType<typeof lgtv2>;

class TvClient extends EventEmitter {
    private client: LgtvInstance | null = null;
    private _state: ConnectionState = "disconnected";
    private _ip: string | null = null;

    get state(): ConnectionState {
        return this._state;
    }

    connect(ip: string): void {
        if (this._ip === ip && this._state !== "disconnected") return;

        this.disconnect();
        this._ip = ip;
        this._setState("connecting");

        this.client = lgtv2({ url: `ws://${ip}:3000`, reconnect: 5000 });

        this.client.on("connect", () => {
            this._setState("connected");
        });

        this.client.on("connecting", () => {
            this._setState("connecting");
        });

        this.client.on("close", () => {
            this._setState("disconnected");
        });

        this.client.on("error", (_err: Error) => {
            this._setState("disconnected");
        });
    }

    disconnect(): void {
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

    private _setState(state: ConnectionState): void {
        if (this._state === state) return;
        this._state = state;
        this.emit("stateChange", state);
    }
}

export const tvClient = new TvClient();
