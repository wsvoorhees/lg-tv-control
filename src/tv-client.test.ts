import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventEmitter } from "node:events";

// Create a mock lgtv2 instance factory
function makeMockLgtvInstance() {
    const emitter = new EventEmitter() as EventEmitter & {
        disconnect: ReturnType<typeof vi.fn>;
        request: ReturnType<typeof vi.fn>;
    };
    emitter.disconnect = vi.fn();
    emitter.request = vi.fn();
    return emitter;
}

const { mockLgtv2, mockWake } = vi.hoisted(() => ({ mockLgtv2: vi.fn(), mockWake: vi.fn() }));

vi.mock("lgtv2", () => ({ default: mockLgtv2 }));
vi.mock("wol", () => ({ wake: mockWake }));

import { TvClient } from "./tv-client.js";

let mockLgtvInstance = makeMockLgtvInstance();

describe("TvClient", () => {
    let client: InstanceType<typeof TvClient>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockLgtvInstance = makeMockLgtvInstance();
        mockLgtv2.mockReturnValue(mockLgtvInstance);
        client = new TvClient();
    });

    describe("initial state", () => {
        it("starts disconnected", () => {
            expect(client.state).toBe("disconnected");
        });
    });

    describe("connect()", () => {
        it("sets state to connecting immediately", () => {
            client.connect("192.168.1.1");
            expect(client.state).toBe("connecting");
        });

        it("emits stateChange with 'connecting'", () => {
            const listener = vi.fn();
            client.on("stateChange", listener);
            client.connect("192.168.1.1");
            expect(listener).toHaveBeenCalledWith("connecting");
        });

        it("sets state to connected when lgtv2 emits connect", () => {
            client.connect("192.168.1.1");
            mockLgtvInstance.emit("connect");
            expect(client.state).toBe("connected");
        });

        it("emits stateChange with 'connected' on connect event", () => {
            const listener = vi.fn();
            client.on("stateChange", listener);
            client.connect("192.168.1.1");
            mockLgtvInstance.emit("connect");
            expect(listener).toHaveBeenCalledWith("connected");
        });

        it("sets state to disconnected on close event when previously connected", () => {
            client.connect("192.168.1.1");
            mockLgtvInstance.emit("connect");
            mockLgtvInstance.emit("close");
            expect(client.state).toBe("disconnected");
        });

        it("does not oscillate through disconnected on close during initial connect retry", () => {
            // lgtv2 fires close→connecting pairs during retry; state must stay "connecting"
            // to avoid the button flashing "Off" every 5 s
            const listener = vi.fn();
            client.on("stateChange", listener);
            client.connect("192.168.1.1");
            listener.mockClear();
            mockLgtvInstance.emit("close");
            expect(client.state).toBe("connecting");
            expect(listener).not.toHaveBeenCalled();
        });

        it("sets state to disconnected on error event", () => {
            client.connect("192.168.1.1");
            mockLgtvInstance.emit("error", new Error("connection refused"));
            expect(client.state).toBe("disconnected");
        });

        it("does not reconnect if already connecting to the same IP", () => {
            client.connect("192.168.1.1");
            client.connect("192.168.1.1");
            expect(mockLgtv2).toHaveBeenCalledTimes(1);
        });

        it("reconnects if connecting to a different IP", () => {
            client.connect("192.168.1.1");
            mockLgtvInstance.emit("connect");
            client.connect("192.168.1.2");
            expect(mockLgtv2).toHaveBeenCalledTimes(2);
        });

        it("ignores stale 'connect' event from old lgtv2 instance after reconnect", () => {
            const firstInstance = mockLgtvInstance;
            client.connect("192.168.1.1");

            const secondInstance = makeMockLgtvInstance();
            mockLgtv2.mockReturnValue(secondInstance);
            client.connect("192.168.1.2");
            expect(client.state).toBe("connecting");

            firstInstance.emit("connect");
            expect(client.state).toBe("connecting");

            secondInstance.emit("connect");
            expect(client.state).toBe("connected");
        });

        it("resets state to connecting when lgtv2 emits a connecting event while connected", () => {
            client.connect("192.168.1.1");
            mockLgtvInstance.emit("connect");
            expect(client.state).toBe("connected");

            mockLgtvInstance.emit("connecting");
            expect(client.state).toBe("connecting");
        });

        it("ignores stale 'connecting' event from old lgtv2 instance after reconnect", () => {
            const firstInstance = mockLgtvInstance;
            client.connect("192.168.1.1");
            firstInstance.emit("connect");

            const secondInstance = makeMockLgtvInstance();
            mockLgtv2.mockReturnValue(secondInstance);
            client.connect("192.168.1.2");
            secondInstance.emit("connect");

            firstInstance.emit("connecting");
            expect(client.state).toBe("connected");
        });

        it("ignores stale 'error' event from old lgtv2 instance after reconnect", () => {
            const firstInstance = mockLgtvInstance;
            client.connect("192.168.1.1");

            const secondInstance = makeMockLgtvInstance();
            mockLgtv2.mockReturnValue(secondInstance);
            client.connect("192.168.1.2");
            secondInstance.emit("connect");

            firstInstance.emit("error", new Error("stale error"));
            expect(client.state).toBe("connected");
        });

        it("ignores stale 'close' event from old lgtv2 instance after reconnect", () => {
            const firstInstance = mockLgtvInstance;
            client.connect("192.168.1.1");
            firstInstance.emit("connect");

            const secondInstance = makeMockLgtvInstance();
            mockLgtv2.mockReturnValue(secondInstance);
            client.connect("192.168.1.2");
            secondInstance.emit("connect");

            firstInstance.emit("close");
            expect(client.state).toBe("connected");
        });
    });

    describe("disconnect()", () => {
        it("calls disconnect on the underlying client", () => {
            client.connect("192.168.1.1");
            const instance = mockLgtvInstance;
            client.disconnect();
            expect(instance.disconnect).toHaveBeenCalled();
        });

        it("sets state to disconnected", () => {
            client.connect("192.168.1.1");
            mockLgtvInstance.emit("connect");
            client.disconnect();
            expect(client.state).toBe("disconnected");
        });

        it("emits stateChange with 'disconnected' when previously connecting", () => {
            const listener = vi.fn();
            client.on("stateChange", listener);
            client.connect("192.168.1.1");
            listener.mockClear();
            client.disconnect();
            expect(listener).toHaveBeenCalledWith("disconnected");
        });

        it("does not throw when called before any connection", () => {
            expect(() => client.disconnect()).not.toThrow();
            expect(client.state).toBe("disconnected");
        });

        it("ignores stale events from the lgtv2 instance after disconnect()", () => {
            const instance = mockLgtvInstance;
            client.connect("192.168.1.1");
            client.disconnect();

            instance.emit("connect");
            expect(client.state).toBe("disconnected");
        });
    });

    describe("request()", () => {
        it("rejects if not connected", async () => {
            await expect(client.request("ssap://tv/getExternalInputList")).rejects.toThrow("Not connected");
        });

        it("resolves with the response when connected", async () => {
            client.connect("192.168.1.1");
            mockLgtvInstance.emit("connect");

            mockLgtvInstance.request.mockImplementation((_url: string, cb: (err: null, res: unknown) => void) => {
                cb(null, { devices: [] });
            });

            const result = await client.request("ssap://tv/getExternalInputList");
            expect(result).toEqual({ devices: [] });
        });

        it("rejects when the lgtv2 callback returns an error", async () => {
            client.connect("192.168.1.1");
            mockLgtvInstance.emit("connect");

            mockLgtvInstance.request.mockImplementation((_url: string, cb: (err: Error, res: null) => void) => {
                cb(new Error("TV error"), null);
            });

            await expect(client.request("ssap://tv/getExternalInputList")).rejects.toThrow("TV error");
        });

        it("rejects when the lgtv2 callback returns an error with a payload", async () => {
            client.connect("192.168.1.1");
            mockLgtvInstance.emit("connect");

            mockLgtvInstance.request.mockImplementation((_url: string, _payload: object, cb: (err: Error, res: null) => void) => {
                cb(new Error("TV error"), null);
            });

            await expect(client.request("ssap://tv/switchInput", { inputId: "HDMI_1" })).rejects.toThrow("TV error");
        });

        it("passes payload when provided", async () => {
            client.connect("192.168.1.1");
            mockLgtvInstance.emit("connect");

            mockLgtvInstance.request.mockImplementation((_url: string, _payload: object, cb: (err: null, res: unknown) => void) => {
                cb(null, { ok: true });
            });

            const result = await client.request("ssap://tv/switchInput", { inputId: "HDMI_1" });
            expect(mockLgtvInstance.request).toHaveBeenCalledWith(
                "ssap://tv/switchInput",
                { inputId: "HDMI_1" },
                expect.any(Function)
            );
            expect(result).toEqual({ ok: true });
        });
    });

    describe("reconnect()", () => {
        it("does nothing when no IP has ever been set", () => {
            client.reconnect();
            expect(mockLgtv2).not.toHaveBeenCalled();
        });

        it("reconnects using the stored IP after a connection drop", () => {
            client.connect("192.168.1.1");
            // Simulate a successful connection followed by a drop
            mockLgtvInstance.emit("connect");
            mockLgtvInstance.emit("close");
            expect(client.state).toBe("disconnected");

            const secondInstance = makeMockLgtvInstance();
            mockLgtv2.mockReturnValue(secondInstance);

            client.reconnect();
            expect(mockLgtv2).toHaveBeenCalledTimes(2);
            expect(mockLgtv2).toHaveBeenLastCalledWith(expect.objectContaining({ url: "ws://192.168.1.1:3000" }));
        });

        it("is a no-op when already connecting to the same IP", () => {
            client.connect("192.168.1.1");
            // state is "connecting", same IP — connect() guard returns early
            client.reconnect();
            expect(mockLgtv2).toHaveBeenCalledTimes(1);
        });
    });

    describe("waitForConnected()", () => {
        it("resolves immediately when already connected", async () => {
            client.connect("192.168.1.1");
            mockLgtvInstance.emit("connect");
            await expect(client.waitForConnected()).resolves.toBeUndefined();
        });

        it("rejects immediately when disconnected and not connecting", async () => {
            await expect(client.waitForConnected()).rejects.toThrow("Not connecting");
        });

        it("resolves when state transitions to connected", async () => {
            client.connect("192.168.1.1");
            const promise = client.waitForConnected();
            mockLgtvInstance.emit("connect");
            await expect(promise).resolves.toBeUndefined();
        });

        it("rejects with 'Connection aborted' when disconnect() is called while waiting", async () => {
            client.connect("192.168.1.1");
            const promise = client.waitForConnected();
            client.disconnect();
            await expect(promise).rejects.toThrow("Connection aborted");
        });

        it("does not reject on transient disconnect during a lgtv2 retry cycle", async () => {
            client.connect("192.168.1.1");
            const promise = client.waitForConnected();
            // Simulate lgtv2 retry: close (same connectionId) → reconnecting → connected
            mockLgtvInstance.emit("close");
            mockLgtvInstance.emit("connecting");
            mockLgtvInstance.emit("connect");
            await expect(promise).resolves.toBeUndefined();
        });

        it("rejects on timeout", async () => {
            vi.useFakeTimers();
            client.connect("192.168.1.1");
            const promise = client.waitForConnected(5000);
            vi.advanceTimersByTime(5000);
            await expect(promise).rejects.toThrow("Connection timeout");
            vi.useRealTimers();
        });
    });

    describe("connect timeout", () => {
        it("emits 'disconnected' after 10s if still connecting (before max attempts)", () => {
            vi.useFakeTimers();
            const listener = vi.fn();
            client.on("stateChange", listener);
            client.connect("192.168.1.1");
            listener.mockClear();
            vi.advanceTimersByTime(10000);
            expect(client.state).toBe("disconnected");
            expect(listener).toHaveBeenCalledWith("disconnected");
            vi.useRealTimers();
        });
    });

    describe("wakeOnLan()", () => {
        it("does nothing when no MAC address is configured", async () => {
            await client.wakeOnLan();
            expect(mockWake).not.toHaveBeenCalled();
        });

        it("calls wake() with the MAC address", async () => {
            mockWake.mockResolvedValue(true);
            client.connect("192.168.1.1", "AA:BB:CC:DD:EE:FF");
            await client.wakeOnLan();
            expect(mockWake).toHaveBeenCalledWith("AA:BB:CC:DD:EE:FF");
        });

        it("does not throw when wake() fails", async () => {
            mockWake.mockRejectedValue(new Error("WOL failed"));
            client.connect("192.168.1.1", "AA:BB:CC:DD:EE:FF");
            await expect(client.wakeOnLan()).resolves.toBeUndefined();
        });
    });
});
