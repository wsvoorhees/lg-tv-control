import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ConnectionState } from "../tv-client.js";

const mockTvClient = vi.hoisted(() => ({
    state: "disconnected" as ConnectionState,
    request: vi.fn(),
    wakeOnLan: vi.fn(),
    reconnect: vi.fn(),
    waitForConnected: vi.fn(),
}));

vi.mock("../tv-client.js", () => ({ tvClient: mockTvClient }));

vi.mock("@elgato/streamdeck", () => ({
    action: () => (cls: unknown) => cls,
    SingletonAction: class {},
}));

import { ToggleMute } from "./toggle-mute.js";

describe("ToggleMute", () => {
    let action: InstanceType<typeof ToggleMute>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockTvClient.state = "disconnected";
        mockTvClient.waitForConnected.mockRejectedValue(new Error("Not connecting"));
        action = new ToggleMute();
    });

    describe("onKeyDown", () => {
        it("calls wakeOnLan and reconnect when disconnected, does not send request when connection fails", async () => {
            await action.onKeyDown({} as never);
            expect(mockTvClient.wakeOnLan).toHaveBeenCalled();
            expect(mockTvClient.reconnect).toHaveBeenCalled();
            expect(mockTvClient.request).not.toHaveBeenCalled();
        });

        it("gets mute state then sets the opposite when connected and muted", async () => {
            mockTvClient.state = "connected";
            mockTvClient.waitForConnected.mockResolvedValue(undefined);
            mockTvClient.request
                .mockResolvedValueOnce({ mute: true })
                .mockResolvedValueOnce(undefined);
            await action.onKeyDown({} as never);
            expect(mockTvClient.request).toHaveBeenNthCalledWith(1, "ssap://audio/getMute");
            expect(mockTvClient.request).toHaveBeenNthCalledWith(2, "ssap://audio/setMute", { mute: false });
        });

        it("gets mute state then sets the opposite when connected and unmuted", async () => {
            mockTvClient.state = "connected";
            mockTvClient.waitForConnected.mockResolvedValue(undefined);
            mockTvClient.request
                .mockResolvedValueOnce({ mute: false })
                .mockResolvedValueOnce(undefined);
            await action.onKeyDown({} as never);
            expect(mockTvClient.request).toHaveBeenNthCalledWith(2, "ssap://audio/setMute", { mute: true });
        });

        it("does not call wakeOnLan or reconnect when connecting", async () => {
            mockTvClient.state = "connecting";
            await action.onKeyDown({} as never);
            expect(mockTvClient.wakeOnLan).not.toHaveBeenCalled();
            expect(mockTvClient.reconnect).not.toHaveBeenCalled();
            expect(mockTvClient.request).not.toHaveBeenCalled();
        });

        it("does not throw when request fails", async () => {
            mockTvClient.state = "connected";
            mockTvClient.waitForConnected.mockResolvedValue(undefined);
            mockTvClient.request.mockRejectedValue(new Error("TV error"));
            await expect(action.onKeyDown({} as never)).resolves.toBeUndefined();
        });
    });
});
