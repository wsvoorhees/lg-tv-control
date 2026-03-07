import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSendToPropertyInspector, mockTvClient, mockScanForTVs, handlers } = vi.hoisted(() => ({
    mockSendToPropertyInspector: vi.fn(),
    mockTvClient: {
        state: "connected",
        connect: vi.fn(),
        disconnect: vi.fn(),
        request: vi.fn(),
        on: vi.fn(),
    },
    mockScanForTVs: vi.fn(),
    // Container for handlers captured by plugin.ts at load time
    handlers: {
        sendToPlugin: null as ((ev: { payload: unknown }) => Promise<void>) | null,
        globalSettings: null as ((ev: { settings: Record<string, unknown> }) => void) | null,
    },
}));

vi.mock("@elgato/streamdeck", () => ({
    default: {
        logger: { setLevel: vi.fn(), info: vi.fn(), error: vi.fn() },
        actions: { registerAction: vi.fn() },
        ui: {
            onSendToPlugin: vi.fn((handler) => { handlers.sendToPlugin = handler; }),
            sendToPropertyInspector: mockSendToPropertyInspector,
        },
        connect: vi.fn().mockResolvedValue(undefined),
        settings: {
            onDidReceiveGlobalSettings: vi.fn((handler) => { handlers.globalSettings = handler; }),
            getGlobalSettings: vi.fn(),
        },
    },
    action: () => (cls: unknown) => cls,
    SingletonAction: class {},
}));

vi.mock("./tv-client.js", () => ({ tvClient: mockTvClient }));
vi.mock("./tv-scanner.js", () => ({ scanForTVs: mockScanForTVs }));

import "./plugin.js";

describe("plugin", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockTvClient.state = "connected";
    });

    describe("onDidReceiveGlobalSettings", () => {
        it("calls tvClient.connect() with the IP when tvIpAddress is set", () => {
            handlers.globalSettings!({ settings: { tvIpAddress: "192.168.1.1" } });
            expect(mockTvClient.connect).toHaveBeenCalledWith("192.168.1.1");
            expect(mockTvClient.disconnect).not.toHaveBeenCalled();
        });

        it("calls tvClient.disconnect() when tvIpAddress is absent", () => {
            handlers.globalSettings!({ settings: {} });
            expect(mockTvClient.disconnect).toHaveBeenCalled();
            expect(mockTvClient.connect).not.toHaveBeenCalled();
        });

        it("calls tvClient.disconnect() when tvIpAddress is empty string", () => {
            handlers.globalSettings!({ settings: { tvIpAddress: "" } });
            expect(mockTvClient.disconnect).toHaveBeenCalled();
            expect(mockTvClient.connect).not.toHaveBeenCalled();
        });
    });

    describe("onSendToPlugin", () => {
        describe("scanForTVs", () => {
            it("sends tvScanResults with found TVs on success", async () => {
                mockScanForTVs.mockResolvedValue([{ ip: "192.168.1.1" }]);
                await handlers.sendToPlugin!({ payload: { event: "scanForTVs" } });
                expect(mockSendToPropertyInspector).toHaveBeenCalledWith({
                    event: "tvScanResults",
                    tvs: [{ ip: "192.168.1.1" }],
                });
            });

            it("sends tvScanResults with empty array on failure", async () => {
                mockScanForTVs.mockRejectedValue(new Error("scan failed"));
                await handlers.sendToPlugin!({ payload: { event: "scanForTVs" } });
                expect(mockSendToPropertyInspector).toHaveBeenCalledWith({
                    event: "tvScanResults",
                    tvs: [],
                });
            });
        });

        describe("getInputList", () => {
            it("sends inputList with mapped inputs on success", async () => {
                mockTvClient.request.mockResolvedValue({
                    devices: [
                        { id: "HDMI_1", label: "PlayStation 5" },
                        { id: "HDMI_2", label: "Xbox" },
                    ],
                });
                await handlers.sendToPlugin!({ payload: { event: "getInputList" } });
                expect(mockSendToPropertyInspector).toHaveBeenCalledWith({
                    event: "inputList",
                    inputs: [
                        { id: "HDMI_1", label: "PlayStation 5" },
                        { id: "HDMI_2", label: "Xbox" },
                    ],
                });
            });

            it("sends inputList with empty array when response has no devices", async () => {
                mockTvClient.request.mockResolvedValue({});
                await handlers.sendToPlugin!({ payload: { event: "getInputList" } });
                expect(mockSendToPropertyInspector).toHaveBeenCalledWith({
                    event: "inputList",
                    inputs: [],
                });
            });

            it("sends inputList with empty array on failure", async () => {
                mockTvClient.request.mockRejectedValue(new Error("TV error"));
                await handlers.sendToPlugin!({ payload: { event: "getInputList" } });
                expect(mockSendToPropertyInspector).toHaveBeenCalledWith({
                    event: "inputList",
                    inputs: [],
                });
            });

            it("sends inputList with error flag when TV not connected", async () => {
                mockTvClient.state = "disconnected";
                await handlers.sendToPlugin!({ payload: { event: "getInputList" } });
                expect(mockSendToPropertyInspector).toHaveBeenCalledWith({
                    event: "inputList",
                    inputs: [],
                    error: "not_connected",
                });
                expect(mockTvClient.request).not.toHaveBeenCalled();
            });
        });

        describe("getAppList", () => {
            it("sends appList mapping app title to label on success", async () => {
                mockTvClient.request.mockResolvedValue({
                    apps: [
                        { id: "netflix", title: "Netflix" },
                        { id: "youtube", title: "YouTube" },
                    ],
                });
                await handlers.sendToPlugin!({ payload: { event: "getAppList" } });
                expect(mockSendToPropertyInspector).toHaveBeenCalledWith({
                    event: "appList",
                    apps: [
                        { id: "netflix", label: "Netflix" },
                        { id: "youtube", label: "YouTube" },
                    ],
                });
            });

            it("sends appList with empty array when response has no apps", async () => {
                mockTvClient.request.mockResolvedValue({});
                await handlers.sendToPlugin!({ payload: { event: "getAppList" } });
                expect(mockSendToPropertyInspector).toHaveBeenCalledWith({
                    event: "appList",
                    apps: [],
                });
            });

            it("sends appList with empty array on failure", async () => {
                mockTvClient.request.mockRejectedValue(new Error("TV error"));
                await handlers.sendToPlugin!({ payload: { event: "getAppList" } });
                expect(mockSendToPropertyInspector).toHaveBeenCalledWith({
                    event: "appList",
                    apps: [],
                });
            });

            it("sends appList with error flag when TV not connected", async () => {
                mockTvClient.state = "disconnected";
                await handlers.sendToPlugin!({ payload: { event: "getAppList" } });
                expect(mockSendToPropertyInspector).toHaveBeenCalledWith({
                    event: "appList",
                    apps: [],
                    error: "not_connected",
                });
                expect(mockTvClient.request).not.toHaveBeenCalled();
            });
        });

        it("ignores unknown events without sending anything", async () => {
            await handlers.sendToPlugin!({ payload: { event: "unknownEvent" } });
            expect(mockSendToPropertyInspector).not.toHaveBeenCalled();
        });
    });
});
