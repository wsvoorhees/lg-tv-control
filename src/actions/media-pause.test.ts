import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ConnectionState } from "../tv-client.js";

const mockTvClient = vi.hoisted(() => ({
    state: "disconnected" as ConnectionState,
    request: vi.fn(),
}));

vi.mock("../tv-client.js", () => ({ tvClient: mockTvClient }));

vi.mock("@elgato/streamdeck", () => ({
    action: () => (cls: unknown) => cls,
    SingletonAction: class {},
}));

import { MediaPause } from "./media-pause.js";

describe("MediaPause", () => {
    let action: InstanceType<typeof MediaPause>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockTvClient.state = "disconnected";
        action = new MediaPause();
    });

    describe("onKeyDown", () => {
        it("does nothing when not connected", async () => {
            mockTvClient.state = "disconnected";
            await action.onKeyDown({} as never);
            expect(mockTvClient.request).not.toHaveBeenCalled();
        });

        it("sends pause request when connected", async () => {
            mockTvClient.state = "connected";
            mockTvClient.request.mockResolvedValue(undefined);
            await action.onKeyDown({} as never);
            expect(mockTvClient.request).toHaveBeenCalledWith("ssap://media.controls/pause");
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
