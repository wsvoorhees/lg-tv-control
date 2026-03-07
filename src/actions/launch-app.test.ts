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

import { LaunchApp } from "./launch-app.js";

function makeMockAction() {
    return { setTitle: vi.fn() };
}

type LaunchAppSettings = { appId?: string; appLabel?: string };

function makeWillAppearEvent(settings: LaunchAppSettings = {}) {
    return { payload: { settings }, action: makeMockAction() };
}

function makeKeyDownEvent(settings: LaunchAppSettings = {}) {
    return { payload: { settings }, action: makeMockAction() };
}

describe("LaunchApp", () => {
    let action: InstanceType<typeof LaunchApp>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockTvClient.state = "disconnected";
        action = new LaunchApp();
    });

    describe("onWillAppear", () => {
        it("shows appLabel as the title when set", () => {
            const ev = makeWillAppearEvent({ appId: "netflix", appLabel: "Netflix" });
            action.onWillAppear(ev as never);
            expect(ev.action.setTitle).toHaveBeenCalledWith("Netflix");
        });

        it("falls back to appId when no appLabel", () => {
            const ev = makeWillAppearEvent({ appId: "netflix" });
            action.onWillAppear(ev as never);
            expect(ev.action.setTitle).toHaveBeenCalledWith("netflix");
        });

        it("falls back to 'App' when neither appLabel nor appId are set", () => {
            const ev = makeWillAppearEvent();
            action.onWillAppear(ev as never);
            expect(ev.action.setTitle).toHaveBeenCalledWith("App");
        });
    });

    describe("onDidReceiveSettings", () => {
        it("shows appLabel as the title when set", () => {
            const ev = makeWillAppearEvent({ appId: "netflix", appLabel: "Netflix" });
            action.onDidReceiveSettings(ev as never);
            expect(ev.action.setTitle).toHaveBeenCalledWith("Netflix");
        });

        it("falls back to appId when no appLabel", () => {
            const ev = makeWillAppearEvent({ appId: "netflix" });
            action.onDidReceiveSettings(ev as never);
            expect(ev.action.setTitle).toHaveBeenCalledWith("netflix");
        });

        it("falls back to 'App' when neither appLabel nor appId are set", () => {
            const ev = makeWillAppearEvent();
            action.onDidReceiveSettings(ev as never);
            expect(ev.action.setTitle).toHaveBeenCalledWith("App");
        });
    });

    describe("onKeyDown", () => {
        it("shows 'No app' when no appId is configured", async () => {
            const ev = makeKeyDownEvent();
            await action.onKeyDown(ev as never);
            expect(ev.action.setTitle).toHaveBeenCalledWith("No app");
            expect(mockTvClient.request).not.toHaveBeenCalled();
        });

        it("restores title to 'App' after 2 seconds when no appId", async () => {
            vi.useFakeTimers();
            const ev = makeKeyDownEvent();
            await action.onKeyDown(ev as never);
            vi.advanceTimersByTime(2000);
            expect(ev.action.setTitle).toHaveBeenLastCalledWith("App");
            vi.useRealTimers();
        });

        it("restores title to appLabel after 2 seconds when no appId but appLabel is set", async () => {
            vi.useFakeTimers();
            const ev = makeKeyDownEvent({ appLabel: "Netflix" });
            await action.onKeyDown(ev as never);
            vi.advanceTimersByTime(2000);
            expect(ev.action.setTitle).toHaveBeenLastCalledWith("Netflix");
            vi.useRealTimers();
        });

        it("shows '...' when state is connecting", async () => {
            vi.useFakeTimers();
            mockTvClient.state = "connecting";
            const ev = makeKeyDownEvent({ appId: "netflix" });
            await action.onKeyDown(ev as never);
            expect(ev.action.setTitle).toHaveBeenCalledWith("...");
            expect(mockTvClient.request).not.toHaveBeenCalled();
            vi.useRealTimers();
        });

        it("shows '...' when not connected", async () => {
            vi.useFakeTimers();
            mockTvClient.state = "disconnected";
            const ev = makeKeyDownEvent({ appId: "netflix" });
            await action.onKeyDown(ev as never);
            expect(ev.action.setTitle).toHaveBeenCalledWith("...");
            expect(mockTvClient.request).not.toHaveBeenCalled();
            vi.useRealTimers();
        });

        it("restores the appLabel after 2 seconds when not connected", async () => {
            vi.useFakeTimers();
            mockTvClient.state = "disconnected";
            const ev = makeKeyDownEvent({ appId: "netflix", appLabel: "Netflix" });
            await action.onKeyDown(ev as never);
            vi.advanceTimersByTime(2000);
            expect(ev.action.setTitle).toHaveBeenLastCalledWith("Netflix");
            vi.useRealTimers();
        });

        it("restores the appId when no appLabel after 2 seconds", async () => {
            vi.useFakeTimers();
            mockTvClient.state = "disconnected";
            const ev = makeKeyDownEvent({ appId: "netflix" });
            await action.onKeyDown(ev as never);
            vi.advanceTimersByTime(2000);
            expect(ev.action.setTitle).toHaveBeenLastCalledWith("netflix");
            vi.useRealTimers();
        });

        it("sends launch request with appId when connected", async () => {
            mockTvClient.state = "connected";
            mockTvClient.request.mockResolvedValue(undefined);
            const ev = makeKeyDownEvent({ appId: "netflix" });
            await action.onKeyDown(ev as never);
            expect(mockTvClient.request).toHaveBeenCalledWith("ssap://system.launcher/launch", { id: "netflix" });
        });

        it("passes the correct appId in the request payload", async () => {
            mockTvClient.state = "connected";
            mockTvClient.request.mockResolvedValue(undefined);
            const ev = makeKeyDownEvent({ appId: "com.webos.app.hdmi1" });
            await action.onKeyDown(ev as never);
            expect(mockTvClient.request).toHaveBeenCalledWith("ssap://system.launcher/launch", { id: "com.webos.app.hdmi1" });
        });

        it("shows '!' and restores appLabel after request failure", async () => {
            vi.useFakeTimers();
            mockTvClient.state = "connected";
            mockTvClient.request.mockRejectedValue(new Error("TV error"));
            const ev = makeKeyDownEvent({ appId: "netflix", appLabel: "Netflix" });
            await action.onKeyDown(ev as never);
            expect(ev.action.setTitle).toHaveBeenCalledWith("!");
            vi.advanceTimersByTime(2000);
            expect(ev.action.setTitle).toHaveBeenLastCalledWith("Netflix");
            vi.useRealTimers();
        });

        it("shows '!' and restores appId when no appLabel after request failure", async () => {
            vi.useFakeTimers();
            mockTvClient.state = "connected";
            mockTvClient.request.mockRejectedValue(new Error("TV error"));
            const ev = makeKeyDownEvent({ appId: "netflix" });
            await action.onKeyDown(ev as never);
            expect(ev.action.setTitle).toHaveBeenCalledWith("!");
            vi.advanceTimersByTime(2000);
            expect(ev.action.setTitle).toHaveBeenLastCalledWith("netflix");
            vi.useRealTimers();
        });
    });
});
