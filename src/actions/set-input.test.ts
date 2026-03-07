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

const { SetInput } = await import("./set-input.js");

function makeMockAction() {
    return { setTitle: vi.fn() };
}

type SetInputSettings = { tvIpAddress?: string; inputId?: string; inputLabel?: string };

function makeWillAppearEvent(settings: SetInputSettings = {}) {
    return { payload: { settings }, action: makeMockAction() };
}

function makeKeyDownEvent(settings: SetInputSettings = {}) {
    return { payload: { settings }, action: makeMockAction() };
}

describe("SetInput", () => {
    let action: InstanceType<typeof SetInput>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockTvClient.state = "disconnected";
        action = new SetInput();
    });

    describe("onWillAppear", () => {
        it("connects to the TV when an IP is configured", () => {
            action.onWillAppear(makeWillAppearEvent({ tvIpAddress: "192.168.1.1", inputId: "HDMI_1" }) as never);
            expect(mockTvClient.connect).toHaveBeenCalledWith("192.168.1.1");
        });

        it("does not connect when no IP is configured", () => {
            action.onWillAppear(makeWillAppearEvent({ inputId: "HDMI_1" }) as never);
            expect(mockTvClient.connect).not.toHaveBeenCalled();
        });

        it("shows inputLabel as the title when set", () => {
            const ev = makeWillAppearEvent({ inputId: "HDMI_1", inputLabel: "PlayStation" });
            action.onWillAppear(ev as never);
            expect(ev.action.setTitle).toHaveBeenCalledWith("PlayStation");
        });

        it("falls back to inputId when no inputLabel", () => {
            const ev = makeWillAppearEvent({ inputId: "HDMI_1" });
            action.onWillAppear(ev as never);
            expect(ev.action.setTitle).toHaveBeenCalledWith("HDMI_1");
        });

        it("falls back to 'Input' when neither inputLabel nor inputId are set", () => {
            const ev = makeWillAppearEvent();
            action.onWillAppear(ev as never);
            expect(ev.action.setTitle).toHaveBeenCalledWith("Input");
        });
    });

    describe("onKeyDown", () => {
        it("shows 'No input' when no inputId is configured", async () => {
            const ev = makeKeyDownEvent({ tvIpAddress: "192.168.1.1" });
            await action.onKeyDown(ev as never);
            expect(ev.action.setTitle).toHaveBeenCalledWith("No input");
            expect(mockTvClient.request).not.toHaveBeenCalled();
        });

        it("connects to TV before switching input if not already connecting", async () => {
            mockTvClient.state = "disconnected";
            const ev = makeKeyDownEvent({ tvIpAddress: "192.168.1.1", inputId: "HDMI_1" });
            await action.onKeyDown(ev as never);
            expect(mockTvClient.connect).toHaveBeenCalledWith("192.168.1.1");
        });

        it("shows '...' when not connected after attempting connect", async () => {
            vi.useFakeTimers();
            mockTvClient.state = "disconnected";
            const ev = makeKeyDownEvent({ tvIpAddress: "192.168.1.1", inputId: "HDMI_1" });
            await action.onKeyDown(ev as never);
            expect(ev.action.setTitle).toHaveBeenCalledWith("...");
            expect(mockTvClient.request).not.toHaveBeenCalled();
            vi.useRealTimers();
        });

        it("restores the input label after 2 seconds when not connected", async () => {
            vi.useFakeTimers();
            mockTvClient.state = "disconnected";
            const ev = makeKeyDownEvent({ tvIpAddress: "192.168.1.1", inputId: "HDMI_1", inputLabel: "PlayStation" });
            await action.onKeyDown(ev as never);
            vi.advanceTimersByTime(2000);
            expect(ev.action.setTitle).toHaveBeenLastCalledWith("PlayStation");
            vi.useRealTimers();
        });

        it("restores the inputId when no inputLabel after 2 seconds", async () => {
            vi.useFakeTimers();
            mockTvClient.state = "disconnected";
            const ev = makeKeyDownEvent({ tvIpAddress: "192.168.1.1", inputId: "HDMI_1" });
            await action.onKeyDown(ev as never);
            vi.advanceTimersByTime(2000);
            expect(ev.action.setTitle).toHaveBeenLastCalledWith("HDMI_1");
            vi.useRealTimers();
        });

        it("sends switchInput request when connected", async () => {
            mockTvClient.state = "connected";
            mockTvClient.request.mockResolvedValue(undefined);
            const ev = makeKeyDownEvent({ tvIpAddress: "192.168.1.1", inputId: "HDMI_1" });
            await action.onKeyDown(ev as never);
            expect(mockTvClient.request).toHaveBeenCalledWith("ssap://tv/switchInput", { inputId: "HDMI_1" });
        });

        it("passes the correct inputId in the request payload", async () => {
            mockTvClient.state = "connected";
            mockTvClient.request.mockResolvedValue(undefined);
            const ev = makeKeyDownEvent({ tvIpAddress: "192.168.1.1", inputId: "HDMI_2" });
            await action.onKeyDown(ev as never);
            expect(mockTvClient.request).toHaveBeenCalledWith("ssap://tv/switchInput", { inputId: "HDMI_2" });
        });
    });
});
