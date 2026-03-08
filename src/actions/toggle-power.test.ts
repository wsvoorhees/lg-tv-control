import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ConnectionState } from "../tv-client.js";

const { mockTvClient, stateChangeListeners } = vi.hoisted(() => {
    const stateChangeListeners: ((state: ConnectionState) => void)[] = [];
    const mockTvClient = {
        state: "disconnected" as ConnectionState,
        reconnect: vi.fn(),
        wakeOnLan: vi.fn(),
        request: vi.fn(),
        on: vi.fn((event: string, listener: (state: ConnectionState) => void) => {
            if (event === "stateChange") stateChangeListeners.push(listener);
        }),
        off: vi.fn(),
    };
    return { mockTvClient, stateChangeListeners };
});

vi.mock("../tv-client.js", () => ({ tvClient: mockTvClient }));

vi.mock("@elgato/streamdeck", () => ({
    action: () => (cls: unknown) => cls,
    SingletonAction: class {},
}));

import { TogglePower } from "./toggle-power.js";

function makeWillAppearEvent(id = "action-id") {
    return { action: { id, setTitle: vi.fn() } };
}

describe("TogglePower", () => {
    let action: InstanceType<typeof TogglePower>;

    beforeEach(() => {
        vi.clearAllMocks();
        stateChangeListeners.length = 0;
        mockTvClient.state = "disconnected";
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
            stateChangeListeners[0]("connected");
            expect(ev.action.setTitle).toHaveBeenLastCalledWith("On");
        });

        it("replaces old listener when onWillAppear is called again for same instance", () => {
            action.onWillAppear(makeWillAppearEvent("same-id") as never);
            const firstListener = stateChangeListeners[0];
            action.onWillAppear(makeWillAppearEvent("same-id") as never);
            expect(mockTvClient.off).toHaveBeenCalledWith("stateChange", firstListener);
        });

        it("tracks separate listeners for multiple visible instances", () => {
            const ev1 = makeWillAppearEvent("id-1");
            const ev2 = makeWillAppearEvent("id-2");
            action.onWillAppear(ev1 as never);
            action.onWillAppear(ev2 as never);
            expect(mockTvClient.off).not.toHaveBeenCalled();
            stateChangeListeners.forEach(l => l("connected"));
            expect(ev1.action.setTitle).toHaveBeenLastCalledWith("On");
            expect(ev2.action.setTitle).toHaveBeenLastCalledWith("On");
        });
    });

    describe("onWillDisappear", () => {
        it("removes only its own stateChange listener", () => {
            action.onWillAppear(makeWillAppearEvent("action-id") as never);
            const listener = stateChangeListeners[0];
            action.onWillDisappear({ action: { id: "action-id" } } as never);
            expect(mockTvClient.off).toHaveBeenCalledWith("stateChange", listener);
        });

        it("does nothing if no listener was registered for the given id", () => {
            action.onWillDisappear({ action: { id: "unknown-id" } } as never);
            expect(mockTvClient.off).not.toHaveBeenCalled();
        });
    });

    describe("onKeyDown", () => {
        it("sends turnOff when connected", async () => {
            mockTvClient.state = "connected";
            mockTvClient.request.mockResolvedValue(undefined);
            await action.onKeyDown({} as never);
            expect(mockTvClient.request).toHaveBeenCalledWith("ssap://system/turnOff");
            expect(mockTvClient.reconnect).not.toHaveBeenCalled();
        });

        it("calls wakeOnLan and reconnect when disconnected", async () => {
            mockTvClient.state = "disconnected";
            await action.onKeyDown({} as never);
            expect(mockTvClient.wakeOnLan).toHaveBeenCalled();
            expect(mockTvClient.reconnect).toHaveBeenCalled();
            expect(mockTvClient.request).not.toHaveBeenCalled();
        });

        it("does nothing when connecting", async () => {
            mockTvClient.state = "connecting";
            await action.onKeyDown({} as never);
            expect(mockTvClient.reconnect).not.toHaveBeenCalled();
            expect(mockTvClient.request).not.toHaveBeenCalled();
        });

        it("does not throw when turnOff request fails", async () => {
            mockTvClient.state = "connected";
            mockTvClient.request.mockRejectedValue(new Error("TV error"));
            await expect(action.onKeyDown({} as never)).resolves.toBeUndefined();
        });
    });
});
