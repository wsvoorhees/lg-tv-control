import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventEmitter } from "node:events";

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
vi.mock("@elgato/streamdeck", () => ({
    default: { logger: { setLevel: vi.fn(), debug: vi.fn(), info: vi.fn(), error: vi.fn() } },
}));

import { TvClientPool } from "./tv-client-pool.js";

const TV_A: import("./types.js").TvConfig = { id: "id-a", name: "Living Room", ip: "192.168.1.10", mac: "AA:BB:CC:DD:EE:01" };
const TV_B: import("./types.js").TvConfig = { id: "id-b", name: "Bedroom", ip: "192.168.1.11" };

describe("TvClientPool", () => {
    let pool: TvClientPool;
    let mockInstanceA: ReturnType<typeof makeMockLgtvInstance>;
    let mockInstanceB: ReturnType<typeof makeMockLgtvInstance>;

    beforeEach(() => {
        // resetAllMocks clears both call history AND queued return values,
        // preventing mockReturnValueOnce entries from bleeding across tests.
        vi.resetAllMocks();
        mockInstanceA = makeMockLgtvInstance();
        mockInstanceB = makeMockLgtvInstance();
        // First configure() call creates TV_A's client, second creates TV_B's.
        mockLgtv2
            .mockReturnValueOnce(mockInstanceA)
            .mockReturnValueOnce(mockInstanceB);
        pool = new TvClientPool();
    });

    describe("configure()", () => {
        it("starts empty — get() and getDefault() return undefined", () => {
            expect(pool.get("id-a")).toBeUndefined();
            expect(pool.getDefault()).toBeUndefined();
            expect(pool.getDefaultId()).toBeUndefined();
            expect(pool.getConfigs()).toEqual([]);
        });

        it("creates a client and connects when a TV is added", () => {
            pool.configure([TV_A]);
            expect(mockLgtv2).toHaveBeenCalledWith(expect.objectContaining({ url: "ws://192.168.1.10:3000" }));
            expect(pool.get("id-a")).toBeDefined();
        });

        it("returns the correct client via get()", () => {
            pool.configure([TV_A, TV_B]);
            expect(pool.get("id-a")).toBeDefined();
            expect(pool.get("id-b")).toBeDefined();
            expect(pool.get("id-unknown")).toBeUndefined();
        });

        it("getDefault() returns the first TV's client", () => {
            pool.configure([TV_A, TV_B]);
            const def = pool.getDefault();
            mockInstanceA.emit("connect");
            expect(def!.state).toBe("connected");
        });

        it("getDefaultId() returns the first TV's id", () => {
            pool.configure([TV_A, TV_B]);
            expect(pool.getDefaultId()).toBe("id-a");
        });

        it("getConfigs() returns a copy of the TV list in order", () => {
            pool.configure([TV_A, TV_B]);
            const configs = pool.getConfigs();
            expect(configs).toEqual([TV_A, TV_B]);
            // Mutating the returned array does not affect the pool.
            configs.push({ id: "id-c", name: "X", ip: "1.2.3.4" });
            expect(pool.getConfigs()).toHaveLength(2);
        });

        it("does not create a second lgtv2 instance when configure() is called again with the same TV", () => {
            pool.configure([TV_A]);
            mockInstanceA.emit("connect");
            pool.configure([TV_A]);
            expect(mockLgtv2).toHaveBeenCalledTimes(1);
        });

        it("reconnects when a TV's IP changes", () => {
            pool.configure([TV_A]);
            mockInstanceA.emit("connect");

            // mockInstanceB is next in the queue (set up in beforeEach)
            const updatedA = { ...TV_A, ip: "192.168.1.99" };
            pool.configure([updatedA]);

            // The existing client reuses the same TvClient object but disconnect()+reconnect() creates a new lgtv2 instance.
            expect(mockLgtv2).toHaveBeenCalledTimes(2);
            expect(mockLgtv2).toHaveBeenLastCalledWith(expect.objectContaining({ url: "ws://192.168.1.99:3000" }));
        });

        it("disconnects and removes clients for TVs no longer in the list", () => {
            pool.configure([TV_A, TV_B]);
            mockInstanceA.emit("connect");

            pool.configure([TV_B]);

            expect(mockInstanceA.disconnect).toHaveBeenCalled();
            expect(pool.get("id-a")).toBeUndefined();
            expect(pool.getConfigs()).toEqual([TV_B]);
        });

        it("configure([]) disconnects all TVs", () => {
            pool.configure([TV_A, TV_B]);
            pool.configure([]);
            expect(mockInstanceA.disconnect).toHaveBeenCalled();
            expect(pool.getDefault()).toBeUndefined();
        });

        it("preserves order from the config array", () => {
            pool.configure([TV_B, TV_A]);
            expect(pool.getConfigs()[0]).toEqual(TV_B);
            expect(pool.getDefaultId()).toBe("id-b");
        });
    });

    describe("stateChange events", () => {
        it("emits stateChange(id, state) when a client's state changes", () => {
            pool.configure([TV_A]);
            const listener = vi.fn();
            pool.on("stateChange", listener);
            mockInstanceA.emit("connect");
            expect(listener).toHaveBeenCalledWith("id-a", "connected");
        });

        it("emits stateChange for the correct TV id when multiple TVs are configured", () => {
            pool.configure([TV_A, TV_B]);
            const listener = vi.fn();
            pool.on("stateChange", listener);
            mockInstanceB.emit("connect");
            expect(listener).toHaveBeenCalledWith("id-b", "connected");
            expect(listener).not.toHaveBeenCalledWith("id-a", expect.anything());
        });

        it("broadcasts current state for all TVs immediately after configure()", () => {
            const listener = vi.fn();
            pool.on("stateChange", listener);
            pool.configure([TV_A]);
            // configure() emits "connecting" from the client startup AND the post-configure broadcast.
            // Both should report "connecting"; we verify at least one emission per TV.
            expect(listener).toHaveBeenCalledWith("id-a", "connecting");
        });

        it("does not emit stateChange from a removed TV after removal", () => {
            pool.configure([TV_A]);
            pool.configure([]);
            const listener = vi.fn();
            pool.on("stateChange", listener);
            mockInstanceA.emit("connect");
            expect(listener).not.toHaveBeenCalled();
        });
    });

    describe("client state accessibility", () => {
        it("get(id).state starts as 'connecting' after configure", () => {
            pool.configure([TV_A]);
            expect(pool.get("id-a")!.state).toBe("connecting");
        });

        it("get(id).state becomes 'connected' after lgtv2 emits connect", () => {
            pool.configure([TV_A]);
            mockInstanceA.emit("connect");
            expect(pool.get("id-a")!.state).toBe("connected");
        });

        it("get(id).state becomes 'disconnected' after connection drops", () => {
            pool.configure([TV_A]);
            mockInstanceA.emit("connect");
            mockInstanceA.emit("close");
            expect(pool.get("id-a")!.state).toBe("disconnected");
        });
    });
});
