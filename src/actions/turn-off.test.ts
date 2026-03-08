import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ConnectionState } from "../tv-client.js";

const { mockTvClient, mockTvClientPool, poolStateChangeListeners } = vi.hoisted(() => {
    const poolStateChangeListeners: ((id: string, state: ConnectionState) => void)[] = [];
    const mockTvClient = {
        state: "disconnected" as ConnectionState,
        request: vi.fn(),
        wakeOnLan: vi.fn(),
        reconnect: vi.fn(),
        waitForConnected: vi.fn(),
        on: vi.fn(),
        off: vi.fn(),
    };
    const mockTvClientPool = {
        get: vi.fn().mockReturnValue(mockTvClient),
        getDefault: vi.fn().mockReturnValue(mockTvClient),
        getDefaultId: vi.fn().mockReturnValue("default-id"),
        on: vi.fn((event: string, listener: (id: string, state: ConnectionState) => void) => {
            if (event === "stateChange") poolStateChangeListeners.push(listener);
        }),
        off: vi.fn(),
    };
    return { mockTvClient, mockTvClientPool, poolStateChangeListeners };
});

vi.mock("../tv-client-pool.js", () => ({ tvClientPool: mockTvClientPool }));

vi.mock("@elgato/streamdeck", () => ({
    action: () => (cls: unknown) => cls,
    SingletonAction: class {},
}));

import { TurnOff } from "./turn-off.js";

function makeWillAppearEvent(id = "action-id") {
    return { action: { id, setTitle: vi.fn() }, payload: { settings: {} } };
}

describe("TurnOff", () => {
    let action: InstanceType<typeof TurnOff>;

    beforeEach(() => {
        vi.clearAllMocks();
        poolStateChangeListeners.length = 0;
        mockTvClient.state = "disconnected";
        mockTvClient.waitForConnected.mockRejectedValue(new Error("Not connecting"));
        mockTvClientPool.getDefault.mockReturnValue(mockTvClient);
        mockTvClientPool.get.mockReturnValue(mockTvClient);
        mockTvClientPool.getDefaultId.mockReturnValue("default-id");
        mockTvClientPool.on.mockImplementation((event: string, listener: (id: string, state: ConnectionState) => void) => {
            if (event === "stateChange") poolStateChangeListeners.push(listener);
        });
        action = new TurnOff();
    });

    describe("onWillAppear", () => {
        it("sets title to 'Off' when disconnected", () => {
            mockTvClient.state = "disconnected";
            const ev = makeWillAppearEvent();
            action.onWillAppear(ev as never);
            expect(ev.action.setTitle).toHaveBeenCalledWith("Off");
        });

        it("sets title to '...' when connecting", () => {
            mockTvClient.state = "connecting";
            const ev = makeWillAppearEvent();
            action.onWillAppear(ev as never);
            expect(ev.action.setTitle).toHaveBeenCalledWith("...");
        });

        it("sets title to 'On' when connected", () => {
            mockTvClient.state = "connected";
            const ev = makeWillAppearEvent();
            action.onWillAppear(ev as never);
            expect(ev.action.setTitle).toHaveBeenCalledWith("On");
        });

        it("updates title when state changes after appearing", () => {
            const ev = makeWillAppearEvent();
            action.onWillAppear(ev as never);
            poolStateChangeListeners[0]("default-id", "connected");
            expect(ev.action.setTitle).toHaveBeenLastCalledWith("On");
        });

        it("replaces old listener when onWillAppear is called again for same instance", () => {
            action.onWillAppear(makeWillAppearEvent("same-id") as never);
            const firstHandler = poolStateChangeListeners[0];
            action.onWillAppear(makeWillAppearEvent("same-id") as never);
            expect(mockTvClientPool.off).toHaveBeenCalledWith("stateChange", firstHandler);
        });

        it("tracks separate listeners for multiple visible instances", () => {
            const ev1 = makeWillAppearEvent("id-1");
            const ev2 = makeWillAppearEvent("id-2");
            action.onWillAppear(ev1 as never);
            action.onWillAppear(ev2 as never);
            expect(mockTvClientPool.off).not.toHaveBeenCalled();
            poolStateChangeListeners.forEach(l => l("default-id", "connected"));
            expect(ev1.action.setTitle).toHaveBeenLastCalledWith("On");
            expect(ev2.action.setTitle).toHaveBeenLastCalledWith("On");
        });
    });

    describe("onWillDisappear", () => {
        it("removes only its own stateChange listener", () => {
            action.onWillAppear(makeWillAppearEvent("action-id") as never);
            const listener = poolStateChangeListeners[0];
            action.onWillDisappear({ action: { id: "action-id" } } as never);
            expect(mockTvClientPool.off).toHaveBeenCalledWith("stateChange", listener);
        });

        it("does nothing if no listener was registered for the given id", () => {
            action.onWillDisappear({ action: { id: "unknown-id" } } as never);
            expect(mockTvClientPool.off).not.toHaveBeenCalled();
        });
    });

    describe("onKeyDown", () => {
        it("calls reconnect but not wakeOnLan when disconnected, does not send request when connection fails", async () => {
            await action.onKeyDown({ payload: { settings: {} } } as never);
            expect(mockTvClient.wakeOnLan).not.toHaveBeenCalled();
            expect(mockTvClient.reconnect).toHaveBeenCalled();
            expect(mockTvClient.request).not.toHaveBeenCalled();
        });

        it("does not call wakeOnLan or reconnect when connecting", async () => {
            mockTvClient.state = "connecting";
            await action.onKeyDown({ payload: { settings: {} } } as never);
            expect(mockTvClient.wakeOnLan).not.toHaveBeenCalled();
            expect(mockTvClient.reconnect).not.toHaveBeenCalled();
            expect(mockTvClient.request).not.toHaveBeenCalled();
        });

        it("sends turnOff request when connected", async () => {
            mockTvClient.state = "connected";
            mockTvClient.waitForConnected.mockResolvedValue(undefined);
            mockTvClient.request.mockResolvedValue(undefined);
            await action.onKeyDown({ payload: { settings: {} } } as never);
            expect(mockTvClient.request).toHaveBeenCalledWith("ssap://system/turnOff");
        });

        it("does not throw when request fails", async () => {
            mockTvClient.state = "connected";
            mockTvClient.waitForConnected.mockResolvedValue(undefined);
            mockTvClient.request.mockRejectedValue(new Error("TV error"));
            await expect(action.onKeyDown({ payload: { settings: {} } } as never)).resolves.toBeUndefined();
        });
    });
});
