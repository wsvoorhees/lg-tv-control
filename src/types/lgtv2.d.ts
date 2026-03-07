declare module "lgtv2" {
    interface LgtvOptions {
        url: string;
        timeout?: number;
        reconnect?: number | false;
        keyFile?: string;
        clientKey?: string;
    }

    interface LgtvInstance {
        request(url: string, callback?: (err: Error | null, res: unknown) => void): void;
        request(url: string, payload: object, callback?: (err: Error | null, res: unknown) => void): void;
        subscribe(url: string, callback: (err: Error | null, res: unknown) => void): void;
        disconnect(): void;
        on(event: "connect", listener: () => void): this;
        on(event: "connecting", listener: () => void): this;
        on(event: "close", listener: () => void): this;
        on(event: "error", listener: (err: Error) => void): this;
        on(event: "prompt", listener: () => void): this;
    }

    function lgtv2(options: LgtvOptions): LgtvInstance;
    export = lgtv2;
}
