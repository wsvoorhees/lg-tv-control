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

let mockLgtvInstance = makeMockLgtvInstance();
const mockLgtv2 = vi.fn(() => mockLgtvInstance);

vi.mock("lgtv2", () => ({ default: mockLgtv2 }));

const { TvClient } = await import("./tv-client.js");

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

        it("sets state to disconnected on close event", () => {
            client.connect("192.168.1.1");
            mockLgtvInstance.emit("connect");
            mockLgtvInstance.emit("close");
            expect(client.state).toBe("disconnected");
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
});
