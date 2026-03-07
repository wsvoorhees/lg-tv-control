import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ConnectionState } from "../tv-client.js";

// Capture the stateChange listener registered by the action
let stateChangeListener: ((state: ConnectionState) => void) | null = null;

const mockTvClient = {
    state: "disconnected" as ConnectionState,
    connect: vi.fn(),
    request: vi.fn(),
    on: vi.fn((event: string, listener: (state: ConnectionState) => void) => {
        if (event === "stateChange") stateChangeListener = listener;
    }),
    off: vi.fn(),
    removeAllListeners: vi.fn(),
};

vi.mock("../tv-client.js", () => ({ tvClient: mockTvClient }));

vi.mock("@elgato/streamdeck", () => ({
    action: () => (cls: unknown) => cls,
    SingletonAction: class {},
}));

const { ToggleTv } = await import("./toggle-tv.js");

function makeMockAction() {
    return { setTitle: vi.fn() };
}

function makeWillAppearEvent(settings: { tvIpAddress?: string } = {}) {
    return { payload: { settings }, action: makeMockAction() };
}

function makeKeyDownEvent(settings: { tvIpAddress?: string } = {}) {
    return { payload: { settings }, action: makeMockAction() };
}

describe("ToggleTv", () => {
    let action: InstanceType<typeof ToggleTv>;

    beforeEach(() => {
        vi.clearAllMocks();
        stateChangeListener = null;
        mockTvClient.state = "disconnected";
        action = new ToggleTv();
    });

    describe("onWillAppear", () => {
        it("connects to the TV when an IP is configured", () => {
            action.onWillAppear(makeWillAppearEvent({ tvIpAddress: "192.168.1.1" }) as never);
            expect(mockTvClient.connect).toHaveBeenCalledWith("192.168.1.1");
        });

        it("does not connect when no IP is configured", () => {
            action.onWillAppear(makeWillAppearEvent() as never);
            expect(mockTvClient.connect).not.toHaveBeenCalled();
        });

        it("sets title to 'Off' when disconnected", () => {
            mockTvClient.state = "disconnected";
            const ev = makeWillAppearEvent({ tvIpAddress: "192.168.1.1" });
            action.onWillAppear(ev as never);
            expect(ev.action.setTitle).toHaveBeenCalledWith("Off");
        });

        it("sets title to '...' when connecting", () => {
            mockTvClient.state = "connecting";
            const ev = makeWillAppearEvent({ tvIpAddress: "192.168.1.1" });
            action.onWillAppear(ev as never);
            expect(ev.action.setTitle).toHaveBeenCalledWith("...");
        });

        it("sets title to 'On' when connected", () => {
            mockTvClient.state = "connected";
            const ev = makeWillAppearEvent({ tvIpAddress: "192.168.1.1" });
            action.onWillAppear(ev as never);
            expect(ev.action.setTitle).toHaveBeenCalledWith("On");
        });

        it("updates title when state changes after appearing", () => {
            const ev = makeWillAppearEvent({ tvIpAddress: "192.168.1.1" });
            action.onWillAppear(ev as never);
            stateChangeListener!("connected");
            expect(ev.action.setTitle).toHaveBeenLastCalledWith("On");
        });

        it("replaces old listener when onWillAppear is called again", () => {
            action.onWillAppear(makeWillAppearEvent({ tvIpAddress: "192.168.1.1" }) as never);
            const firstListener = stateChangeListener;
            action.onWillAppear(makeWillAppearEvent({ tvIpAddress: "192.168.1.1" }) as never);
            expect(mockTvClient.off).toHaveBeenCalledWith("stateChange", firstListener);
        });
    });

    describe("onWillDisappear", () => {
        it("removes only its own stateChange listener", () => {
            action.onWillAppear(makeWillAppearEvent({ tvIpAddress: "192.168.1.1" }) as never);
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
        it("shows 'No IP' when no IP is configured", async () => {
            const ev = makeKeyDownEvent();
            await action.onKeyDown(ev as never);
            expect(ev.action.setTitle).toHaveBeenCalledWith("No IP");
        });

        it("sends turnOff when connected", async () => {
            mockTvClient.state = "connected";
            mockTvClient.request.mockResolvedValue(undefined);
            const ev = makeKeyDownEvent({ tvIpAddress: "192.168.1.1" });
            await action.onKeyDown(ev as never);
            expect(mockTvClient.request).toHaveBeenCalledWith("ssap://system/turnOff");
            expect(mockTvClient.connect).not.toHaveBeenCalled();
        });

        it("connects when disconnected", async () => {
            mockTvClient.state = "disconnected";
            const ev = makeKeyDownEvent({ tvIpAddress: "192.168.1.1" });
            await action.onKeyDown(ev as never);
            expect(mockTvClient.connect).toHaveBeenCalledWith("192.168.1.1");
            expect(mockTvClient.request).not.toHaveBeenCalled();
        });

        it("does nothing when connecting", async () => {
            mockTvClient.state = "connecting";
            const ev = makeKeyDownEvent({ tvIpAddress: "192.168.1.1" });
            await action.onKeyDown(ev as never);
            expect(mockTvClient.connect).not.toHaveBeenCalled();
            expect(mockTvClient.request).not.toHaveBeenCalled();
        });
    });
});
