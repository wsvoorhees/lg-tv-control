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

import { SetInput } from "./set-input.js";

function makeMockAction() {
    return { setTitle: vi.fn() };
}

type SetInputSettings = { inputId?: string; inputLabel?: string };

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
        mockTvClient.waitForConnected.mockRejectedValue(new Error("Not connecting"));
        action = new SetInput();
    });

    describe("onWillAppear", () => {
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

    describe("onDidReceiveSettings", () => {
        it("shows inputLabel as the title when set", () => {
            const ev = makeWillAppearEvent({ inputId: "HDMI_1", inputLabel: "PlayStation" });
            action.onDidReceiveSettings(ev as never);
            expect(ev.action.setTitle).toHaveBeenCalledWith("PlayStation");
        });

        it("falls back to inputId when no inputLabel", () => {
            const ev = makeWillAppearEvent({ inputId: "HDMI_1" });
            action.onDidReceiveSettings(ev as never);
            expect(ev.action.setTitle).toHaveBeenCalledWith("HDMI_1");
        });

        it("falls back to 'Input' when neither inputLabel nor inputId are set", () => {
            const ev = makeWillAppearEvent();
            action.onDidReceiveSettings(ev as never);
            expect(ev.action.setTitle).toHaveBeenCalledWith("Input");
        });
    });

    describe("onKeyDown", () => {
        it("shows 'No input' when no inputId is configured", async () => {
            const ev = makeKeyDownEvent();
            await action.onKeyDown(ev as never);
            expect(ev.action.setTitle).toHaveBeenCalledWith("No input");
            expect(mockTvClient.request).not.toHaveBeenCalled();
        });

        it("restores title to 'Input' after 2 seconds when no inputId", async () => {
            vi.useFakeTimers();
            const ev = makeKeyDownEvent();
            await action.onKeyDown(ev as never);
            vi.advanceTimersByTime(2000);
            expect(ev.action.setTitle).toHaveBeenLastCalledWith("Input");
            vi.useRealTimers();
        });

        it("restores title to inputLabel after 2 seconds when no inputId but inputLabel is set", async () => {
            vi.useFakeTimers();
            const ev = makeKeyDownEvent({ inputLabel: "PlayStation" });
            await action.onKeyDown(ev as never);
            vi.advanceTimersByTime(2000);
            expect(ev.action.setTitle).toHaveBeenLastCalledWith("PlayStation");
            vi.useRealTimers();
        });

        it("shows '...' and calls wakeOnLan and reconnect when disconnected", async () => {
            const ev = makeKeyDownEvent({ inputId: "HDMI_1" });
            await action.onKeyDown(ev as never);
            expect(mockTvClient.wakeOnLan).toHaveBeenCalled();
            expect(mockTvClient.reconnect).toHaveBeenCalled();
            expect(ev.action.setTitle).toHaveBeenCalledWith("...");
            expect(mockTvClient.request).not.toHaveBeenCalled();
        });

        it("shows '!' and restores inputLabel after connection failure when disconnected", async () => {
            vi.useFakeTimers();
            const ev = makeKeyDownEvent({ inputId: "HDMI_1", inputLabel: "PlayStation" });
            await action.onKeyDown(ev as never);
            expect(ev.action.setTitle).toHaveBeenCalledWith("!");
            vi.advanceTimersByTime(2000);
            expect(ev.action.setTitle).toHaveBeenLastCalledWith("PlayStation");
            vi.useRealTimers();
        });

        it("shows '!' and restores inputId after connection failure when disconnected", async () => {
            vi.useFakeTimers();
            const ev = makeKeyDownEvent({ inputId: "HDMI_1" });
            await action.onKeyDown(ev as never);
            expect(ev.action.setTitle).toHaveBeenCalledWith("!");
            vi.advanceTimersByTime(2000);
            expect(ev.action.setTitle).toHaveBeenLastCalledWith("HDMI_1");
            vi.useRealTimers();
        });

        it("shows '...' when connecting, does not call wakeOnLan or reconnect", async () => {
            mockTvClient.state = "connecting";
            const ev = makeKeyDownEvent({ inputId: "HDMI_1" });
            await action.onKeyDown(ev as never);
            expect(mockTvClient.wakeOnLan).not.toHaveBeenCalled();
            expect(mockTvClient.reconnect).not.toHaveBeenCalled();
            expect(ev.action.setTitle).toHaveBeenCalledWith("...");
            expect(mockTvClient.request).not.toHaveBeenCalled();
        });

        it("sends switchInput request and restores title after connecting from disconnected", async () => {
            mockTvClient.waitForConnected.mockResolvedValue(undefined);
            mockTvClient.request.mockResolvedValue(undefined);
            const ev = makeKeyDownEvent({ inputId: "HDMI_1", inputLabel: "PlayStation" });
            await action.onKeyDown(ev as never);
            expect(mockTvClient.wakeOnLan).toHaveBeenCalled();
            expect(mockTvClient.reconnect).toHaveBeenCalled();
            expect(mockTvClient.request).toHaveBeenCalledWith("ssap://tv/switchInput", { inputId: "HDMI_1" });
            expect(ev.action.setTitle).toHaveBeenLastCalledWith("PlayStation");
        });

        it("sends switchInput request when connected", async () => {
            mockTvClient.state = "connected";
            mockTvClient.waitForConnected.mockResolvedValue(undefined);
            mockTvClient.request.mockResolvedValue(undefined);
            const ev = makeKeyDownEvent({ inputId: "HDMI_1" });
            await action.onKeyDown(ev as never);
            expect(mockTvClient.request).toHaveBeenCalledWith("ssap://tv/switchInput", { inputId: "HDMI_1" });
        });

        it("passes the correct inputId in the request payload", async () => {
            mockTvClient.state = "connected";
            mockTvClient.waitForConnected.mockResolvedValue(undefined);
            mockTvClient.request.mockResolvedValue(undefined);
            const ev = makeKeyDownEvent({ inputId: "HDMI_2" });
            await action.onKeyDown(ev as never);
            expect(mockTvClient.request).toHaveBeenCalledWith("ssap://tv/switchInput", { inputId: "HDMI_2" });
        });

        it("shows '!' and restores inputLabel after request failure", async () => {
            vi.useFakeTimers();
            mockTvClient.state = "connected";
            mockTvClient.waitForConnected.mockResolvedValue(undefined);
            mockTvClient.request.mockRejectedValue(new Error("TV error"));
            const ev = makeKeyDownEvent({ inputId: "HDMI_1", inputLabel: "PlayStation" });
            await action.onKeyDown(ev as never);
            expect(ev.action.setTitle).toHaveBeenCalledWith("!");
            vi.advanceTimersByTime(2000);
            expect(ev.action.setTitle).toHaveBeenLastCalledWith("PlayStation");
            vi.useRealTimers();
        });

        it("shows '!' and restores inputId when no inputLabel after request failure", async () => {
            vi.useFakeTimers();
            mockTvClient.state = "connected";
            mockTvClient.waitForConnected.mockResolvedValue(undefined);
            mockTvClient.request.mockRejectedValue(new Error("TV error"));
            const ev = makeKeyDownEvent({ inputId: "HDMI_1" });
            await action.onKeyDown(ev as never);
            expect(ev.action.setTitle).toHaveBeenCalledWith("!");
            vi.advanceTimersByTime(2000);
            expect(ev.action.setTitle).toHaveBeenLastCalledWith("HDMI_1");
            vi.useRealTimers();
        });
    });
});
