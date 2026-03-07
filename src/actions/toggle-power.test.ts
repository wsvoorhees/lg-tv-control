import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ConnectionState } from "../tv-client.js";

let stateChangeListener: ((state: ConnectionState) => void) | null = null;

const mockTvClient = {
    state: "disconnected" as ConnectionState,
    reconnect: vi.fn(),
    request: vi.fn(),
    on: vi.fn((event: string, listener: (state: ConnectionState) => void) => {
        if (event === "stateChange") stateChangeListener = listener;
    }),
    off: vi.fn(),
};

vi.mock("../tv-client.js", () => ({ tvClient: mockTvClient }));

vi.mock("@elgato/streamdeck", () => ({
    action: () => (cls: unknown) => cls,
    SingletonAction: class {},
}));

const { TogglePower } = await import("./toggle-power.js");

function makeMockAction() {
    return { setTitle: vi.fn() };
}

function makeWillAppearEvent() {
    return { action: makeMockAction() };
}

describe("TogglePower", () => {
    let action: InstanceType<typeof TogglePower>;

    beforeEach(() => {
        vi.clearAllMocks();
        stateChangeListener = null;
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
            stateChangeListener!("connected");
            expect(ev.action.setTitle).toHaveBeenLastCalledWith("On");
        });

        it("replaces old listener when onWillAppear is called again", () => {
            action.onWillAppear(makeWillAppearEvent() as never);
            const firstListener = stateChangeListener;
            action.onWillAppear(makeWillAppearEvent() as never);
            expect(mockTvClient.off).toHaveBeenCalledWith("stateChange", firstListener);
        });
    });

    describe("onWillDisappear", () => {
        it("removes only its own stateChange listener", () => {
            action.onWillAppear(makeWillAppearEvent() as never);
            const listener = stateChangeListener;
            action.onWillDisappear({} as never);
            expect(mockTvClient.off).toHaveBeenCalledWith("stateChange", listener);
        });

        it("does nothing if no listener was registered", () => {
            action.onWillDisappear({} as never);
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

        it("calls reconnect when disconnected", async () => {
            mockTvClient.state = "disconnected";
            await action.onKeyDown({} as never);
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
