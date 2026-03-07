import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ConnectionState } from "../tv-client.js";

const mockTvClient = {
    state: "disconnected" as ConnectionState,
    request: vi.fn(),
};

vi.mock("../tv-client.js", () => ({ tvClient: mockTvClient }));

vi.mock("@elgato/streamdeck", () => ({
    action: () => (cls: unknown) => cls,
    SingletonAction: class {},
}));

const { ToggleMute } = await import("./toggle-mute.js");

describe("ToggleMute", () => {
    let action: InstanceType<typeof ToggleMute>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockTvClient.state = "disconnected";
        action = new ToggleMute();
    });

    describe("onKeyDown", () => {
        it("does nothing when not connected", async () => {
            mockTvClient.state = "disconnected";
            await action.onKeyDown({} as never);
            expect(mockTvClient.request).not.toHaveBeenCalled();
        });

        it("gets mute state then sets the opposite when connected and muted", async () => {
            mockTvClient.state = "connected";
            mockTvClient.request
                .mockResolvedValueOnce({ mute: true })
                .mockResolvedValueOnce(undefined);
            await action.onKeyDown({} as never);
            expect(mockTvClient.request).toHaveBeenNthCalledWith(1, "ssap://audio/getMute");
            expect(mockTvClient.request).toHaveBeenNthCalledWith(2, "ssap://audio/setMute", { mute: false });
        });

        it("gets mute state then sets the opposite when connected and unmuted", async () => {
            mockTvClient.state = "connected";
            mockTvClient.request
                .mockResolvedValueOnce({ mute: false })
                .mockResolvedValueOnce(undefined);
            await action.onKeyDown({} as never);
            expect(mockTvClient.request).toHaveBeenNthCalledWith(2, "ssap://audio/setMute", { mute: true });
        });

        it("does nothing when connecting", async () => {
            mockTvClient.state = "connecting";
            await action.onKeyDown({} as never);
            expect(mockTvClient.request).not.toHaveBeenCalled();
        });

        it("does not throw when request fails", async () => {
            mockTvClient.state = "connected";
            mockTvClient.request.mockRejectedValue(new Error("TV error"));
            await expect(action.onKeyDown({} as never)).resolves.toBeUndefined();
        });
    });
});
