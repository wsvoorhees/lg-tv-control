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

import { MediaPlayPause } from "./media-play-pause.js";

describe("MediaPlayPause", () => {
    let action: InstanceType<typeof MediaPlayPause>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockTvClient.state = "disconnected";
        mockTvClient.waitForConnected.mockRejectedValue(new Error("Not connecting"));
        action = new MediaPlayPause();
    });

    describe("onKeyDown", () => {
        it("calls wakeOnLan and reconnect when disconnected, does not send request when connection fails", async () => {
            await action.onKeyDown({} as never);
            expect(mockTvClient.wakeOnLan).toHaveBeenCalled();
            expect(mockTvClient.reconnect).toHaveBeenCalled();
            expect(mockTvClient.request).not.toHaveBeenCalled();
        });

        it("does not call wakeOnLan or reconnect when connecting", async () => {
            mockTvClient.state = "connecting";
            await action.onKeyDown({} as never);
            expect(mockTvClient.wakeOnLan).not.toHaveBeenCalled();
            expect(mockTvClient.reconnect).not.toHaveBeenCalled();
            expect(mockTvClient.request).not.toHaveBeenCalled();
        });

        it("sends play on first press when connected", async () => {
            mockTvClient.state = "connected";
            mockTvClient.waitForConnected.mockResolvedValue(undefined);
            mockTvClient.request.mockResolvedValue(undefined);
            await action.onKeyDown({} as never);
            expect(mockTvClient.request).toHaveBeenCalledWith("ssap://media.controls/play");
        });

        it("sends pause on second press (after play)", async () => {
            mockTvClient.state = "connected";
            mockTvClient.waitForConnected.mockResolvedValue(undefined);
            mockTvClient.request.mockResolvedValue(undefined);
            await action.onKeyDown({} as never); // play
            await action.onKeyDown({} as never); // pause
            expect(mockTvClient.request).toHaveBeenNthCalledWith(1, "ssap://media.controls/play");
            expect(mockTvClient.request).toHaveBeenNthCalledWith(2, "ssap://media.controls/pause");
        });

        it("toggles back to play on third press", async () => {
            mockTvClient.state = "connected";
            mockTvClient.waitForConnected.mockResolvedValue(undefined);
            mockTvClient.request.mockResolvedValue(undefined);
            await action.onKeyDown({} as never); // play
            await action.onKeyDown({} as never); // pause
            await action.onKeyDown({} as never); // play
            expect(mockTvClient.request).toHaveBeenNthCalledWith(3, "ssap://media.controls/play");
        });

        it("does not advance state when request fails", async () => {
            mockTvClient.state = "connected";
            mockTvClient.waitForConnected.mockResolvedValue(undefined);
            mockTvClient.request.mockRejectedValue(new Error("TV error"));
            await action.onKeyDown({} as never);
            // state should not have flipped — next press should still try play
            mockTvClient.request.mockResolvedValue(undefined);
            await action.onKeyDown({} as never);
            expect(mockTvClient.request).toHaveBeenLastCalledWith("ssap://media.controls/play");
        });

        it("does not throw when request fails", async () => {
            mockTvClient.state = "connected";
            mockTvClient.waitForConnected.mockResolvedValue(undefined);
            mockTvClient.request.mockRejectedValue(new Error("TV error"));
            await expect(action.onKeyDown({} as never)).resolves.toBeUndefined();
        });
    });
});
