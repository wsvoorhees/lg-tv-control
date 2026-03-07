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

const { MediaRewind } = await import("./media-rewind.js");

function makeMockAction() {
    return { setTitle: vi.fn() };
}

function makeWillAppearEvent(settings: { tvIpAddress?: string } = {}) {
    return { payload: { settings }, action: makeMockAction() };
}

function makeKeyDownEvent(settings: { tvIpAddress?: string } = {}) {
    return { payload: { settings }, action: makeMockAction() };
}

describe("MediaRewind", () => {
    let action: InstanceType<typeof MediaRewind>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockTvClient.state = "disconnected";
        action = new MediaRewind();
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

        it("sends rewind request when connected", async () => {
            mockTvClient.state = "connected";
            mockTvClient.request.mockResolvedValue(undefined);
            const ev = makeKeyDownEvent({ tvIpAddress: "192.168.1.1" });
            await action.onKeyDown(ev as never);
            expect(mockTvClient.request).toHaveBeenCalledWith("ssap://media.controls/rewind");
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
