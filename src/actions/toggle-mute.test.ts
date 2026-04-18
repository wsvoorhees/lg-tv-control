import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ConnectionState } from "../tv-client.js";

const mockTvClient = vi.hoisted(() => ({
    state: "disconnected" as ConnectionState,
    request: vi.fn(),
    wakeOnLan: vi.fn(),
    reconnect: vi.fn(),
    waitForConnected: vi.fn(),
}));

vi.mock("../tv-client-pool.js", () => ({
    tvClientPool: {
        get: vi.fn().mockReturnValue(mockTvClient),
        getDefault: vi.fn().mockReturnValue(mockTvClient),
        getDefaultId: vi.fn().mockReturnValue("default-id"),
        on: vi.fn(),
        off: vi.fn(),
    },
}));

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
            await action.onKeyDown({ payload: { settings: {} } } as never);
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
            await action.onKeyDown({ payload: { settings: {} } } as never);
            expect(mockTvClient.request).toHaveBeenNthCalledWith(1, "ssap://audio/getMute");
            expect(mockTvClient.request).toHaveBeenNthCalledWith(2, "ssap://audio/setMute", { mute: false });
        });

        it("gets mute state then sets the opposite when connected and unmuted", async () => {
            mockTvClient.state = "connected";
            mockTvClient.waitForConnected.mockResolvedValue(undefined);
            mockTvClient.request
                .mockResolvedValueOnce({ mute: false })
                .mockResolvedValueOnce(undefined);
            await action.onKeyDown({ payload: { settings: {} } } as never);
            expect(mockTvClient.request).toHaveBeenNthCalledWith(2, "ssap://audio/setMute", { mute: true });
        });

        it("does not call wakeOnLan or reconnect when connecting", async () => {
            mockTvClient.state = "connecting";
            await action.onKeyDown({ payload: { settings: {} } } as never);
            expect(mockTvClient.wakeOnLan).not.toHaveBeenCalled();
            expect(mockTvClient.reconnect).not.toHaveBeenCalled();
            expect(mockTvClient.request).not.toHaveBeenCalled();
        });

        it("does not throw when request fails", async () => {
            mockTvClient.state = "connected";
            mockTvClient.waitForConnected.mockResolvedValue(undefined);
            mockTvClient.request.mockRejectedValue(new Error("TV error"));
            await expect(action.onKeyDown({ payload: { settings: {} } } as never)).resolves.toBeUndefined();
        });

        it("ignores a second press while a getMute/setMute sequence is in flight", async () => {
            mockTvClient.state = "connected";
            mockTvClient.waitForConnected.mockResolvedValue(undefined);
            // If second press were NOT dropped, it would consume requests 3 and 4
            mockTvClient.request
                .mockResolvedValueOnce({ mute: false }) // first press getMute
                .mockResolvedValueOnce(undefined)       // first press setMute
                .mockResolvedValueOnce({ mute: true })  // second press getMute (must NOT run)
                .mockResolvedValueOnce(undefined);      // second press setMute (must NOT run)

            const first = action.onKeyDown({ payload: { settings: {} } } as never);
            const second = action.onKeyDown({ payload: { settings: {} } } as never); // in-flight, should be dropped
            await Promise.all([first, second]);

            // Only the first press's two requests should have been made
            expect(mockTvClient.request).toHaveBeenCalledTimes(2);
            expect(mockTvClient.request).toHaveBeenNthCalledWith(1, "ssap://audio/getMute");
            expect(mockTvClient.request).toHaveBeenNthCalledWith(2, "ssap://audio/setMute", { mute: true });
        });

        it("ignores a second press that arrives during wakeOnLan when disconnected", async () => {
            let resolveWol!: () => void;
            mockTvClient.wakeOnLan.mockReturnValue(new Promise<void>(r => { resolveWol = r; }));
            mockTvClient.waitForConnected.mockResolvedValue(undefined);
            mockTvClient.request
                .mockResolvedValueOnce({ mute: false })
                .mockResolvedValueOnce(undefined);

            const first = action.onKeyDown({ payload: { settings: {} } } as never);
            // Second press arrives while first is suspended inside wakeOnLan()
            const second = action.onKeyDown({ payload: { settings: {} } } as never);
            resolveWol();
            await Promise.all([first, second]);

            // Only the first press should have sent requests
            expect(mockTvClient.wakeOnLan).toHaveBeenCalledTimes(1);
            expect(mockTvClient.request).toHaveBeenCalledTimes(2);
        });
    });
});
