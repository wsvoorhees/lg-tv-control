import { describe, it, expect, vi, beforeEach } from "vitest";

// Capture the onSendToPlugin callback registered by plugin.ts
let sendToPluginHandler: ((ev: { payload: unknown }) => Promise<void>) | null = null;

const mockSendToPropertyInspector = vi.fn();

vi.mock("@elgato/streamdeck", () => ({
    default: {
        logger: { setLevel: vi.fn() },
        actions: { registerAction: vi.fn() },
        ui: {
            onSendToPlugin: vi.fn((handler) => { sendToPluginHandler = handler; }),
            sendToPropertyInspector: mockSendToPropertyInspector,
        },
        connect: vi.fn(),
    },
    action: () => (cls: unknown) => cls,
    SingletonAction: class {},
}));

const mockTvClient = {
    state: "connected",
    connect: vi.fn(),
    request: vi.fn(),
    on: vi.fn(),
    removeAllListeners: vi.fn(),
};

vi.mock("./tv-client.js", () => ({ tvClient: mockTvClient }));

const mockScanForTVs = vi.fn();
vi.mock("./tv-scanner.js", () => ({ scanForTVs: mockScanForTVs }));

await import("./plugin.js");

describe("plugin", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("onSendToPlugin", () => {
        describe("scanForTVs", () => {
            it("sends tvScanResults with found TVs on success", async () => {
                mockScanForTVs.mockResolvedValue([{ ip: "192.168.1.1" }]);
                await sendToPluginHandler!({ payload: { event: "scanForTVs" } });
                expect(mockSendToPropertyInspector).toHaveBeenCalledWith({
                    event: "tvScanResults",
                    tvs: [{ ip: "192.168.1.1" }],
                });
            });

            it("sends tvScanResults with empty array on failure", async () => {
                mockScanForTVs.mockRejectedValue(new Error("scan failed"));
                await sendToPluginHandler!({ payload: { event: "scanForTVs" } });
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
                await sendToPluginHandler!({ payload: { event: "getInputList" } });
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
                await sendToPluginHandler!({ payload: { event: "getInputList" } });
                expect(mockSendToPropertyInspector).toHaveBeenCalledWith({
                    event: "inputList",
                    inputs: [],
                });
            });

            it("sends inputList with empty array on failure", async () => {
                mockTvClient.request.mockRejectedValue(new Error("TV error"));
                await sendToPluginHandler!({ payload: { event: "getInputList" } });
                expect(mockSendToPropertyInspector).toHaveBeenCalledWith({
                    event: "inputList",
                    inputs: [],
                });
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
                await sendToPluginHandler!({ payload: { event: "getAppList" } });
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
                await sendToPluginHandler!({ payload: { event: "getAppList" } });
                expect(mockSendToPropertyInspector).toHaveBeenCalledWith({
                    event: "appList",
                    apps: [],
                });
            });

            it("sends appList with empty array on failure", async () => {
                mockTvClient.request.mockRejectedValue(new Error("TV error"));
                await sendToPluginHandler!({ payload: { event: "getAppList" } });
                expect(mockSendToPropertyInspector).toHaveBeenCalledWith({
                    event: "appList",
                    apps: [],
                });
            });
        });

        it("ignores unknown events without sending anything", async () => {
            await sendToPluginHandler!({ payload: { event: "unknownEvent" } });
            expect(mockSendToPropertyInspector).not.toHaveBeenCalled();
        });
    });
});
