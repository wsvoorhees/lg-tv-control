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

import { VolumeDown } from "./volume-down.js";

describe("VolumeDown", () => {
    let action: InstanceType<typeof VolumeDown>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockTvClient.state = "disconnected";
        mockTvClient.waitForConnected.mockRejectedValue(new Error("Not connecting"));
        action = new VolumeDown();
    });

    describe("onKeyDown", () => {
        it("calls wakeOnLan and reconnect when disconnected, does not send request when connection fails", async () => {
            await action.onKeyDown({} as never);
            expect(mockTvClient.wakeOnLan).toHaveBeenCalled();
            expect(mockTvClient.reconnect).toHaveBeenCalled();
            expect(mockTvClient.request).not.toHaveBeenCalled();
        });

        it("sends volumeDown request after connecting from disconnected", async () => {
            mockTvClient.waitForConnected.mockResolvedValue(undefined);
            mockTvClient.request.mockResolvedValue(undefined);
            await action.onKeyDown({} as never);
            expect(mockTvClient.wakeOnLan).toHaveBeenCalled();
            expect(mockTvClient.reconnect).toHaveBeenCalled();
            expect(mockTvClient.request).toHaveBeenCalledWith("ssap://audio/volumeDown");
        });

        it("sends volumeDown request when connected", async () => {
            mockTvClient.state = "connected";
            mockTvClient.waitForConnected.mockResolvedValue(undefined);
            mockTvClient.request.mockResolvedValue(undefined);
            await action.onKeyDown({} as never);
            expect(mockTvClient.request).toHaveBeenCalledWith("ssap://audio/volumeDown");
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
