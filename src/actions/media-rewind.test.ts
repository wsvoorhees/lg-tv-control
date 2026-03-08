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

import { MediaRewind } from "./media-rewind.js";

describe("MediaRewind", () => {
    let action: InstanceType<typeof MediaRewind>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockTvClient.state = "disconnected";
        mockTvClient.waitForConnected.mockRejectedValue(new Error("Not connecting"));
        action = new MediaRewind();
    });

    describe("onKeyDown", () => {
        it("calls wakeOnLan and reconnect when disconnected, does not send request when connection fails", async () => {
            await action.onKeyDown({} as never);
            expect(mockTvClient.wakeOnLan).toHaveBeenCalled();
            expect(mockTvClient.reconnect).toHaveBeenCalled();
            expect(mockTvClient.request).not.toHaveBeenCalled();
        });

        it("sends rewind request after connecting from disconnected", async () => {
            mockTvClient.waitForConnected.mockResolvedValue(undefined);
            mockTvClient.request.mockResolvedValue(undefined);
            await action.onKeyDown({} as never);
            expect(mockTvClient.wakeOnLan).toHaveBeenCalled();
            expect(mockTvClient.reconnect).toHaveBeenCalled();
            expect(mockTvClient.request).toHaveBeenCalledWith("ssap://media.controls/rewind");
        });

        it("sends rewind request when connected", async () => {
            mockTvClient.state = "connected";
            mockTvClient.waitForConnected.mockResolvedValue(undefined);
            mockTvClient.request.mockResolvedValue(undefined);
            await action.onKeyDown({} as never);
            expect(mockTvClient.request).toHaveBeenCalledWith("ssap://media.controls/rewind");
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
