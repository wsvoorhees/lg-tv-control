import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ConnectionState } from "../tv-client.js";

const { mockTvClient, mockTvClientPool, poolStateChangeListeners } = vi.hoisted(() => {
    const poolStateChangeListeners: ((id: string, state: ConnectionState) => void)[] = [];
    const mockTvClient = {
        state: "disconnected" as ConnectionState,
        reconnect: vi.fn(),
        wakeOnLan: vi.fn(),
        request: vi.fn(),
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

import { TogglePower } from "./toggle-power.js";

function makeWillAppearEvent(id = "action-id", tvId?: string) {
    return { action: { id, setTitle: vi.fn() }, payload: { settings: tvId ? { tvId } : {} } };
}

function makeDidReceiveSettingsEvent(id = "action-id", tvId?: string) {
    return { action: { id, setTitle: vi.fn() }, payload: { settings: tvId ? { tvId } : {} } };
}

describe("TogglePower", () => {
    let action: InstanceType<typeof TogglePower>;

    beforeEach(() => {
        vi.clearAllMocks();
        poolStateChangeListeners.length = 0;
        mockTvClient.state = "disconnected";
        mockTvClientPool.getDefault.mockReturnValue(mockTvClient);
        mockTvClientPool.get.mockReturnValue(mockTvClient);
        mockTvClientPool.getDefaultId.mockReturnValue("default-id");
        mockTvClientPool.on.mockImplementation((event: string, listener: (id: string, state: ConnectionState) => void) => {
            if (event === "stateChange") poolStateChangeListeners.push(listener);
        });
        action = new TogglePower();
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

        it("updates title when stateChange fires for default TV but action has stale tvId", () => {
            // TV was deleted and re-added; action settings still hold the old UUID.
            mockTvClientPool.get.mockImplementation((id: string) => id === "default-id" ? mockTvClient : undefined);
            const ev = makeWillAppearEvent("action-id", "stale-id");
            action.onWillAppear(ev as never);
            // Broadcast fires for "default-id" (the new UUID assigned after re-add).
            poolStateChangeListeners[0]("default-id", "connected");
            expect(ev.action.setTitle).toHaveBeenLastCalledWith("On");
        });

        it("updates title when stateChange fires after getDefaultId was undefined at appearance time", () => {
            mockTvClientPool.getDefaultId.mockReturnValue(undefined); // simulate pre-configure startup
            const ev = makeWillAppearEvent();
            action.onWillAppear(ev as never);
            mockTvClientPool.getDefaultId.mockReturnValue("default-id"); // configure() has now run
            poolStateChangeListeners[0]("default-id", "connected");
            expect(ev.action.setTitle).toHaveBeenLastCalledWith("On");
        });

        it("re-registers listener and updates title when settings change via onDidReceiveSettings", () => {
            const ev = makeWillAppearEvent("action-id");
            action.onWillAppear(ev as never);
            const firstHandler = poolStateChangeListeners[0];

            const ev2 = makeDidReceiveSettingsEvent("action-id", "tv-2");
            mockTvClientPool.get.mockImplementation((id: string) => id === "tv-2" ? { ...mockTvClient, state: "connected" as const } : undefined);
            action.onDidReceiveSettings(ev2 as never);

            expect(mockTvClientPool.off).toHaveBeenCalledWith("stateChange", firstHandler);
            expect(ev2.action.setTitle).toHaveBeenCalledWith("On");
            poolStateChangeListeners[1]("tv-2", "disconnected");
            expect(ev2.action.setTitle).toHaveBeenLastCalledWith("Off");
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
        it("sends turnOff when connected", async () => {
            mockTvClient.state = "connected";
            mockTvClient.request.mockResolvedValue(undefined);
            await action.onKeyDown({ payload: { settings: {} } } as never);
            expect(mockTvClient.request).toHaveBeenCalledWith("ssap://system/turnOff");
            expect(mockTvClient.reconnect).not.toHaveBeenCalled();
        });

        it("calls wakeOnLan and reconnect when disconnected, awaiting wakeOnLan before reconnect", async () => {
            mockTvClient.state = "disconnected";
            const order: string[] = [];
            mockTvClient.wakeOnLan.mockImplementation(() => {
                order.push("wakeOnLan");
                return Promise.resolve();
            });
            mockTvClient.reconnect.mockImplementation(() => { order.push("reconnect"); });
            await action.onKeyDown({ payload: { settings: {} } } as never);
            expect(order).toEqual(["wakeOnLan", "reconnect"]);
            expect(mockTvClient.request).not.toHaveBeenCalled();
        });

        it("does nothing when connecting", async () => {
            mockTvClient.state = "connecting";
            await action.onKeyDown({ payload: { settings: {} } } as never);
            expect(mockTvClient.reconnect).not.toHaveBeenCalled();
            expect(mockTvClient.request).not.toHaveBeenCalled();
        });

        it("does not throw when turnOff request fails", async () => {
            mockTvClient.state = "connected";
            mockTvClient.request.mockRejectedValue(new Error("TV error"));
            await expect(action.onKeyDown({ payload: { settings: {} } } as never)).resolves.toBeUndefined();
        });
    });
});
