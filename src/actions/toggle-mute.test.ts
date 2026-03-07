import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ConnectionState } from "../tv-client.js";

const mockTvClient = {
    state: "disconnected" as ConnectionState,
    connect: vi.fn(),
    request: vi.fn(),
    on: vi.fn(),
    removeAllListeners: vi.fn(),
};

vi.mock("../tv-client.js", () => ({ tvClient: mockTvClient }));

vi.mock("@elgato/streamdeck", () => ({
    action: () => (cls: unknown) => cls,
    SingletonAction: class {},
}));

const { ToggleMute } = await import("./toggle-mute.js");

function makeMockAction() {
    return { setTitle: vi.fn() };
}

function makeWillAppearEvent(settings: { tvIpAddress?: string } = {}) {
    return { payload: { settings }, action: makeMockAction() };
}

function makeKeyDownEvent(settings: { tvIpAddress?: string } = {}) {
    return { payload: { settings }, action: makeMockAction() };
}

describe("ToggleMute", () => {
    let action: InstanceType<typeof ToggleMute>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockTvClient.state = "disconnected";
        action = new ToggleMute();
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
    });

    describe("onKeyDown", () => {
        it("shows 'No IP' when no IP is configured", async () => {
            const ev = makeKeyDownEvent();
            await action.onKeyDown(ev as never);
            expect(ev.action.setTitle).toHaveBeenCalledWith("No IP");
            expect(mockTvClient.request).not.toHaveBeenCalled();
        });

        it("does nothing when not connected", async () => {
            mockTvClient.state = "disconnected";
            const ev = makeKeyDownEvent({ tvIpAddress: "192.168.1.1" });
            await action.onKeyDown(ev as never);
            expect(mockTvClient.request).not.toHaveBeenCalled();
        });

        it("gets mute state then sets the opposite when connected and muted", async () => {
            mockTvClient.state = "connected";
            mockTvClient.request
                .mockResolvedValueOnce({ mute: true })
                .mockResolvedValueOnce(undefined);
            const ev = makeKeyDownEvent({ tvIpAddress: "192.168.1.1" });
            await action.onKeyDown(ev as never);
            expect(mockTvClient.request).toHaveBeenNthCalledWith(1, "ssap://audio/getMute");
            expect(mockTvClient.request).toHaveBeenNthCalledWith(2, "ssap://audio/setMute", { mute: false });
        });

        it("gets mute state then sets the opposite when connected and unmuted", async () => {
            mockTvClient.state = "connected";
            mockTvClient.request
                .mockResolvedValueOnce({ mute: false })
                .mockResolvedValueOnce(undefined);
            const ev = makeKeyDownEvent({ tvIpAddress: "192.168.1.1" });
            await action.onKeyDown(ev as never);
            expect(mockTvClient.request).toHaveBeenNthCalledWith(2, "ssap://audio/setMute", { mute: true });
        });

        it("does nothing when connecting", async () => {
            mockTvClient.state = "connecting";
            const ev = makeKeyDownEvent({ tvIpAddress: "192.168.1.1" });
            await action.onKeyDown(ev as never);
            expect(mockTvClient.request).not.toHaveBeenCalled();
        });

        it("does not throw when request fails", async () => {
            mockTvClient.state = "connected";
            mockTvClient.request.mockRejectedValue(new Error("TV error"));
            const ev = makeKeyDownEvent({ tvIpAddress: "192.168.1.1" });
            await expect(action.onKeyDown(ev as never)).resolves.toBeUndefined();
        });
    });
});
