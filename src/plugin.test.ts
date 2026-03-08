import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { mockSendToPropertyInspector, mockGetGlobalSettings, mockSetGlobalSettings, mockTvClientPool, mockDefaultClient, mockScanForTVs, handlers } = vi.hoisted(() => {
    // Defined separately so on() can capture stateChange via closure
    const handlers = {
        sendToPlugin: null as ((ev: { payload: unknown }) => Promise<void>) | null,
        stateChange: null as ((id: string, state: string) => Promise<void>) | null,
        globalSettings: null as ((ev: { settings: unknown }) => void) | null,
    };

    const mockDefaultClient = {
        state: "connected" as string,
        request: vi.fn(),
    };

    return {
        mockSendToPropertyInspector: vi.fn(),
        mockGetGlobalSettings: vi.fn().mockResolvedValue({ tvs: [] }),
        mockSetGlobalSettings: vi.fn().mockResolvedValue(undefined),
        mockDefaultClient,
        mockTvClientPool: {
            on: vi.fn((event: string, handler: (id: string, state: string) => Promise<void>) => {
                if (event === "stateChange") handlers.stateChange = handler;
            }),
            configure: vi.fn(),
            get: vi.fn().mockReturnValue(mockDefaultClient),
            getDefault: vi.fn().mockReturnValue(mockDefaultClient),
            getDefaultId: vi.fn().mockReturnValue(undefined),
            getConfigs: vi.fn().mockReturnValue([]),
        },
        mockScanForTVs: vi.fn(),
        handlers,
    };
});

vi.mock("@elgato/streamdeck", () => ({
    default: {
        logger: { setLevel: vi.fn(), debug: vi.fn(), info: vi.fn(), error: vi.fn() },
        actions: { registerAction: vi.fn() },
        ui: {
            onSendToPlugin: vi.fn((handler) => { handlers.sendToPlugin = handler; }),
            sendToPropertyInspector: mockSendToPropertyInspector,
        },
        connect: vi.fn().mockResolvedValue(undefined),
        settings: {
            getGlobalSettings: mockGetGlobalSettings,
            setGlobalSettings: mockSetGlobalSettings,
            onDidReceiveGlobalSettings: vi.fn((handler) => { handlers.globalSettings = handler; }),
        },
    },
    action: () => (cls: unknown) => cls,
    SingletonAction: class {},
}));

vi.mock("./tv-client-pool.js", () => ({ tvClientPool: mockTvClientPool }));
vi.mock("./tv-scanner.js", () => ({ scanForTVs: mockScanForTVs }));

import "./plugin.js";

describe("startup", () => {
    afterEach(() => {
        vi.resetModules();
    });

    it("calls tvClientPool.configure() with tvs from global settings", async () => {
        const localConfigure = vi.fn();
        vi.resetModules();
        vi.doMock("./tv-client-pool.js", () => ({
            tvClientPool: {
                on: vi.fn(),
                configure: localConfigure,
                get: vi.fn(),
                getDefault: vi.fn(),
                getDefaultId: vi.fn(),
                getConfigs: vi.fn().mockReturnValue([]),
            },
        }));
        vi.doMock("@elgato/streamdeck", () => ({
            default: {
                logger: { setLevel: vi.fn(), debug: vi.fn(), info: vi.fn(), error: vi.fn() },
                actions: { registerAction: vi.fn() },
                ui: { onSendToPlugin: vi.fn(), sendToPropertyInspector: vi.fn() },
                connect: vi.fn().mockResolvedValue(undefined),
                settings: {
                    getGlobalSettings: vi.fn().mockResolvedValue({
                        tvs: [{ id: "id-1", name: "Living Room", ip: "192.168.1.5", mac: "AA:BB:CC:DD:EE:FF" }],
                    }),
                    setGlobalSettings: vi.fn(),
                    onDidReceiveGlobalSettings: vi.fn(),
                },
            },
            action: () => (cls: unknown) => cls,
            SingletonAction: class {},
        }));
        vi.doMock("./tv-scanner.js", () => ({ scanForTVs: vi.fn() }));

        await import("./plugin.js");
        // Flush microtasks: connect().then() + await getGlobalSettings()
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(localConfigure).toHaveBeenCalledWith([
            { id: "id-1", name: "Living Room", ip: "192.168.1.5", mac: "AA:BB:CC:DD:EE:FF" },
        ]);
    });

    it("migrates old tvIpAddress format and calls configure() with the migrated TV list", async () => {
        const localConfigure = vi.fn();
        const localSetGlobalSettings = vi.fn();
        vi.resetModules();
        vi.doMock("./tv-client-pool.js", () => ({
            tvClientPool: {
                on: vi.fn(),
                configure: localConfigure,
                get: vi.fn(),
                getDefault: vi.fn(),
                getDefaultId: vi.fn(),
                getConfigs: vi.fn().mockReturnValue([]),
            },
        }));
        vi.doMock("@elgato/streamdeck", () => ({
            default: {
                logger: { setLevel: vi.fn(), debug: vi.fn(), info: vi.fn(), error: vi.fn() },
                actions: { registerAction: vi.fn() },
                ui: { onSendToPlugin: vi.fn(), sendToPropertyInspector: vi.fn() },
                connect: vi.fn().mockResolvedValue(undefined),
                settings: {
                    getGlobalSettings: vi.fn().mockResolvedValue({
                        tvIpAddress: "192.168.1.5",
                        tvMacAddress: "AA:BB:CC:DD:EE:FF",
                    }),
                    setGlobalSettings: localSetGlobalSettings,
                    onDidReceiveGlobalSettings: vi.fn(),
                },
            },
            action: () => (cls: unknown) => cls,
            SingletonAction: class {},
        }));
        vi.doMock("./tv-scanner.js", () => ({ scanForTVs: vi.fn() }));

        await import("./plugin.js");
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(localConfigure).toHaveBeenCalledWith(
            expect.arrayContaining([
                expect.objectContaining({ ip: "192.168.1.5", mac: "AA:BB:CC:DD:EE:FF", name: "LG TV" }),
            ])
        );
        // Migrated settings should be persisted
        expect(localSetGlobalSettings).toHaveBeenCalledWith(
            expect.objectContaining({ tvs: expect.arrayContaining([expect.objectContaining({ ip: "192.168.1.5" })]) })
        );
    });

    it("calls configure([]) when no settings are stored", async () => {
        // The top-level import ran with getGlobalSettings returning { tvs: [] }
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(mockTvClientPool.configure).toHaveBeenCalledWith([]);
    });
});

describe("plugin", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockDefaultClient.state = "connected";
        mockGetGlobalSettings.mockResolvedValue({ tvs: [] });
        mockSetGlobalSettings.mockResolvedValue(undefined);
        mockTvClientPool.getDefault.mockReturnValue(mockDefaultClient);
        mockTvClientPool.get.mockReturnValue(mockDefaultClient);
        mockTvClientPool.getConfigs.mockReturnValue([]);
    });

    describe("onDidReceiveGlobalSettings", () => {
        it("calls tvClientPool.configure() with new tvs", () => {
            const tvs = [{ id: "id-1", name: "TV", ip: "192.168.1.99", mac: "11:22:33:44:55:66" }];
            handlers.globalSettings!({ settings: { tvs } });
            expect(mockTvClientPool.configure).toHaveBeenCalledWith(tvs);
        });

        it("calls tvClientPool.configure([]) when tvs is absent", () => {
            handlers.globalSettings!({ settings: {} });
            expect(mockTvClientPool.configure).toHaveBeenCalledWith([]);
        });
    });

    describe("stateChange listener", () => {
        it("sends connectionState with id and state to the PI when TV state changes", async () => {
            await handlers.stateChange!("id-a", "connected");
            expect(mockSendToPropertyInspector).toHaveBeenCalledWith({
                event: "connectionState",
                id: "id-a",
                state: "connected",
            });
        });

        it("does not throw when sendToPropertyInspector fails (PI not open)", async () => {
            mockSendToPropertyInspector.mockRejectedValueOnce(new Error("PI not open"));
            await expect(handlers.stateChange!("id-a", "connected")).resolves.toBeUndefined();
        });
    });

    describe("onSendToPlugin", () => {
        describe("getTvList", () => {
            it("sends tvList with configs and current connection state", async () => {
                const configs = [
                    { id: "id-a", name: "Living Room", ip: "192.168.1.10" },
                    { id: "id-b", name: "Bedroom", ip: "192.168.1.11" },
                ];
                mockTvClientPool.getConfigs.mockReturnValue(configs);
                mockTvClientPool.get.mockImplementation((id: string) => ({
                    state: id === "id-a" ? "connected" : "disconnected",
                }));
                await handlers.sendToPlugin!({ payload: { event: "getTvList" } });
                expect(mockSendToPropertyInspector).toHaveBeenCalledWith({
                    event: "tvList",
                    tvs: [
                        { id: "id-a", name: "Living Room", ip: "192.168.1.10", state: "connected" },
                        { id: "id-b", name: "Bedroom", ip: "192.168.1.11", state: "disconnected" },
                    ],
                });
            });

            it("sends tvList with empty array when no TVs configured", async () => {
                mockTvClientPool.getConfigs.mockReturnValue([]);
                await handlers.sendToPlugin!({ payload: { event: "getTvList" } });
                expect(mockSendToPropertyInspector).toHaveBeenCalledWith({ event: "tvList", tvs: [] });
            });
        });

        describe("addTv", () => {
            it("appends a new TV entry, calls configure(), and sends tvList to PI", async () => {
                mockGetGlobalSettings.mockResolvedValue({ tvs: [] });
                mockTvClientPool.getConfigs.mockReturnValue([
                    { id: "new-id", name: "New TV", ip: "192.168.1.20", mac: "AA:BB:CC:DD:EE:FF" },
                ]);
                await handlers.sendToPlugin!({ payload: { event: "addTv", ip: "192.168.1.20", mac: "AA:BB:CC:DD:EE:FF", name: "New TV" } });
                expect(mockTvClientPool.configure).toHaveBeenCalledWith(
                    expect.arrayContaining([
                        expect.objectContaining({ ip: "192.168.1.20", mac: "AA:BB:CC:DD:EE:FF", name: "New TV" }),
                    ])
                );
                expect(mockSendToPropertyInspector).toHaveBeenCalledWith(
                    expect.objectContaining({ event: "tvList" })
                );
            });

            it("ignores addTv with no ip", async () => {
                await handlers.sendToPlugin!({ payload: { event: "addTv" } });
                expect(mockTvClientPool.configure).not.toHaveBeenCalled();
                expect(mockSendToPropertyInspector).not.toHaveBeenCalled();
            });
        });

        describe("updateTv", () => {
            it("updates an existing TV, calls configure(), and sends tvList to PI", async () => {
                const existing = [{ id: "id-a", name: "Living Room", ip: "192.168.1.10" }];
                mockGetGlobalSettings.mockResolvedValue({ tvs: existing });
                mockTvClientPool.getConfigs.mockReturnValue([{ id: "id-a", name: "New Name", ip: "192.168.1.99" }]);
                await handlers.sendToPlugin!({ payload: { event: "updateTv", id: "id-a", ip: "192.168.1.99", name: "New Name" } });
                expect(mockTvClientPool.configure).toHaveBeenCalledWith([
                    expect.objectContaining({ id: "id-a", ip: "192.168.1.99", name: "New Name" }),
                ]);
                expect(mockSendToPropertyInspector).toHaveBeenCalledWith(
                    expect.objectContaining({ event: "tvList" })
                );
            });

            it("ignores updateTv with no id", async () => {
                await handlers.sendToPlugin!({ payload: { event: "updateTv", ip: "1.2.3.4" } });
                expect(mockTvClientPool.configure).not.toHaveBeenCalled();
                expect(mockSendToPropertyInspector).not.toHaveBeenCalled();
            });
        });

        describe("removeTv", () => {
            it("removes the specified TV, calls configure(), and sends tvList to PI", async () => {
                const existing = [
                    { id: "id-a", name: "Living Room", ip: "192.168.1.10" },
                    { id: "id-b", name: "Bedroom", ip: "192.168.1.11" },
                ];
                mockGetGlobalSettings.mockResolvedValue({ tvs: existing });
                mockTvClientPool.getConfigs.mockReturnValue([{ id: "id-b", name: "Bedroom", ip: "192.168.1.11" }]);
                await handlers.sendToPlugin!({ payload: { event: "removeTv", id: "id-a" } });
                expect(mockTvClientPool.configure).toHaveBeenCalledWith([
                    { id: "id-b", name: "Bedroom", ip: "192.168.1.11" },
                ]);
                expect(mockSendToPropertyInspector).toHaveBeenCalledWith(
                    expect.objectContaining({ event: "tvList" })
                );
            });

            it("ignores removeTv with no id", async () => {
                await handlers.sendToPlugin!({ payload: { event: "removeTv" } });
                expect(mockTvClientPool.configure).not.toHaveBeenCalled();
                expect(mockSendToPropertyInspector).not.toHaveBeenCalled();
            });
        });

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
                mockDefaultClient.request.mockResolvedValue({
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

            it("uses the specified tvId client when provided", async () => {
                const specificClient = { state: "connected", request: vi.fn().mockResolvedValue({ devices: [] }) };
                mockTvClientPool.get.mockReturnValue(specificClient);
                await handlers.sendToPlugin!({ payload: { event: "getInputList", tvId: "id-b" } });
                expect(mockTvClientPool.get).toHaveBeenCalledWith("id-b");
                expect(specificClient.request).toHaveBeenCalled();
            });

            it("falls back to default client when tvId is not provided", async () => {
                mockDefaultClient.request.mockResolvedValue({ devices: [] });
                await handlers.sendToPlugin!({ payload: { event: "getInputList" } });
                expect(mockTvClientPool.getDefault).toHaveBeenCalled();
            });

            it("sends inputList with empty array when response has no devices", async () => {
                mockDefaultClient.request.mockResolvedValue({});
                await handlers.sendToPlugin!({ payload: { event: "getInputList" } });
                expect(mockSendToPropertyInspector).toHaveBeenCalledWith({
                    event: "inputList",
                    inputs: [],
                });
            });

            it("sends inputList with empty array on failure", async () => {
                mockDefaultClient.request.mockRejectedValue(new Error("TV error"));
                await handlers.sendToPlugin!({ payload: { event: "getInputList" } });
                expect(mockSendToPropertyInspector).toHaveBeenCalledWith({
                    event: "inputList",
                    inputs: [],
                });
            });

            it("sends inputList with error flag when TV not connected", async () => {
                mockDefaultClient.state = "disconnected";
                await handlers.sendToPlugin!({ payload: { event: "getInputList" } });
                expect(mockSendToPropertyInspector).toHaveBeenCalledWith({
                    event: "inputList",
                    inputs: [],
                    error: "not_connected",
                });
                expect(mockDefaultClient.request).not.toHaveBeenCalled();
            });

            it("sends inputList with error flag when no TV is configured", async () => {
                mockTvClientPool.getDefault.mockReturnValue(undefined);
                await handlers.sendToPlugin!({ payload: { event: "getInputList" } });
                expect(mockSendToPropertyInspector).toHaveBeenCalledWith({
                    event: "inputList",
                    inputs: [],
                    error: "not_connected",
                });
            });
        });

        describe("getAppList", () => {
            it("sends appList mapping app title to label on success", async () => {
                mockDefaultClient.request.mockResolvedValue({
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

            it("uses the specified tvId client when provided", async () => {
                const specificClient = { state: "connected", request: vi.fn().mockResolvedValue({ apps: [] }) };
                mockTvClientPool.get.mockReturnValue(specificClient);
                await handlers.sendToPlugin!({ payload: { event: "getAppList", tvId: "id-b" } });
                expect(mockTvClientPool.get).toHaveBeenCalledWith("id-b");
                expect(specificClient.request).toHaveBeenCalled();
            });

            it("sends appList with empty array when response has no apps", async () => {
                mockDefaultClient.request.mockResolvedValue({});
                await handlers.sendToPlugin!({ payload: { event: "getAppList" } });
                expect(mockSendToPropertyInspector).toHaveBeenCalledWith({
                    event: "appList",
                    apps: [],
                });
            });

            it("sends appList with empty array on failure", async () => {
                mockDefaultClient.request.mockRejectedValue(new Error("TV error"));
                await handlers.sendToPlugin!({ payload: { event: "getAppList" } });
                expect(mockSendToPropertyInspector).toHaveBeenCalledWith({
                    event: "appList",
                    apps: [],
                });
            });

            it("sends appList with error flag when TV not connected", async () => {
                mockDefaultClient.state = "disconnected";
                await handlers.sendToPlugin!({ payload: { event: "getAppList" } });
                expect(mockSendToPropertyInspector).toHaveBeenCalledWith({
                    event: "appList",
                    apps: [],
                    error: "not_connected",
                });
                expect(mockDefaultClient.request).not.toHaveBeenCalled();
            });

            it("sends appList with error flag when no TV is configured", async () => {
                mockTvClientPool.getDefault.mockReturnValue(undefined);
                await handlers.sendToPlugin!({ payload: { event: "getAppList" } });
                expect(mockSendToPropertyInspector).toHaveBeenCalledWith({
                    event: "appList",
                    apps: [],
                    error: "not_connected",
                });
            });
        });

        it("ignores unknown events without sending anything", async () => {
            await handlers.sendToPlugin!({ payload: { event: "unknownEvent" } });
            expect(mockSendToPropertyInspector).not.toHaveBeenCalled();
        });
    });

    describe("migrateSettings", () => {
        it("returns the input as-is when tvs array is already present", async () => {
            const { migrateSettings } = await import("./plugin.js");
            const input = { tvs: [{ id: "id-1", name: "TV", ip: "1.2.3.4" }] };
            expect(migrateSettings(input)).toBe(input);
        });

        it("returns empty tvs when old format has no tvIpAddress", async () => {
            const { migrateSettings } = await import("./plugin.js");
            expect(migrateSettings({})).toEqual({ tvs: [] });
        });

        it("converts old tvIpAddress/tvMacAddress format to tvs array", async () => {
            const { migrateSettings } = await import("./plugin.js");
            const result = migrateSettings({ tvIpAddress: "1.2.3.4", tvMacAddress: "AA:BB:CC", tvName: "My TV" });
            expect(result.tvs).toHaveLength(1);
            expect(result.tvs[0]).toMatchObject({ ip: "1.2.3.4", mac: "AA:BB:CC", name: "My TV" });
            expect(typeof result.tvs[0].id).toBe("string");
        });

        it("uses 'LG TV' as name when tvName is absent", async () => {
            const { migrateSettings } = await import("./plugin.js");
            const result = migrateSettings({ tvIpAddress: "1.2.3.4" });
            expect(result.tvs[0].name).toBe("LG TV");
        });

        it("omits mac when tvMacAddress is absent", async () => {
            const { migrateSettings } = await import("./plugin.js");
            const result = migrateSettings({ tvIpAddress: "1.2.3.4" });
            expect(result.tvs[0].mac).toBeUndefined();
        });
    });
});
