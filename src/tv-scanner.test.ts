import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventEmitter } from "node:events";

// Mock node-ssdp before importing the module under test
const mockClientInstance = new EventEmitter() as EventEmitter & { search: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> };
mockClientInstance.search = vi.fn();
mockClientInstance.stop = vi.fn();

vi.mock("node-ssdp", () => ({
    // Must use a regular function (not arrow) so it can be called with `new`
    Client: vi.fn(function () { return mockClientInstance; }),
}));

vi.mock("@elgato/streamdeck", () => ({
    default: { logger: { info: vi.fn(), error: vi.fn() } },
}));

import { scanForTVs } from "./tv-scanner.js";

describe("scanForTVs", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.unstubAllGlobals();
        mockClientInstance.removeAllListeners();
        mockClientInstance.search = vi.fn();
        mockClientInstance.stop = vi.fn();
    });

    it("resolves with an empty array when no devices respond", async () => {
        vi.useFakeTimers();

        const promise = scanForTVs();
        await vi.advanceTimersByTimeAsync(6000);
        const result = await promise;

        expect(result).toEqual([]);
        expect(mockClientInstance.stop).toHaveBeenCalled();

        vi.useRealTimers();
    });

    it("resolves with discovered TVs after timeout", async () => {
        vi.useFakeTimers();

        const promise = scanForTVs();

        // Simulate a device responding
        mockClientInstance.emit("response", { SERVER: "Linux/4.x webOS/5.0" }, 200, { address: "192.168.1.100" });

        await vi.advanceTimersByTimeAsync(6000);
        const result = await promise;

        expect(result).toHaveLength(1);
        expect(result[0].ip).toBe("192.168.1.100");
        expect(result[0].name).toBe("LG TV");

        vi.useRealTimers();
    });

    it("names a TV when SERVER header contains 'webOS'", async () => {
        vi.useFakeTimers();

        const promise = scanForTVs();
        mockClientInstance.emit("response", { SERVER: "webOS/3.4" }, 200, { address: "10.0.0.5" });
        await vi.advanceTimersByTimeAsync(6000);
        const result = await promise;

        expect(result[0].name).toBe("LG TV");

        vi.useRealTimers();
    });

    it("excludes non-webOS devices from results", async () => {
        vi.useFakeTimers();

        const promise = scanForTVs();
        mockClientInstance.emit("response", { SERVER: "UPnP/1.0 SomeOtherDevice/1.0" }, 200, { address: "10.0.0.6" });
        await vi.advanceTimersByTimeAsync(6000);
        const result = await promise;

        expect(result).toHaveLength(0);

        vi.useRealTimers();
    });

    it("uses friendly name from LOCATION XML when available", async () => {
        vi.useFakeTimers();
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
            text: () => Promise.resolve("<root><device><friendlyName>Living Room TV</friendlyName></device></root>"),
        }));

        const promise = scanForTVs();
        mockClientInstance.emit("response", { SERVER: "webOS/5.0", LOCATION: "http://192.168.1.100:1884/device.xml" }, 200, { address: "192.168.1.100" });
        await vi.advanceTimersByTimeAsync(6000);
        const result = await promise;

        expect(result[0].name).toBe("Living Room TV");

        vi.useRealTimers();
    });

    it("falls back to 'LG TV' when LOCATION fetch fails", async () => {
        vi.useFakeTimers();
        vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network error")));

        const promise = scanForTVs();
        mockClientInstance.emit("response", { SERVER: "webOS/5.0", LOCATION: "http://192.168.1.100:1884/device.xml" }, 200, { address: "192.168.1.100" });
        await vi.advanceTimersByTimeAsync(6000);
        const result = await promise;

        expect(result[0].name).toBe("LG TV");

        vi.useRealTimers();
    });

    it("deduplicates responses from the same IP", async () => {
        vi.useFakeTimers();

        const promise = scanForTVs();
        mockClientInstance.emit("response", { SERVER: "webOS/5.0" }, 200, { address: "192.168.1.50" });
        mockClientInstance.emit("response", { SERVER: "webOS/5.0" }, 200, { address: "192.168.1.50" });
        await vi.advanceTimersByTimeAsync(6000);
        const result = await promise;

        expect(result).toHaveLength(1);

        vi.useRealTimers();
    });

    it("discovers multiple TVs at different IPs", async () => {
        vi.useFakeTimers();

        const promise = scanForTVs();
        mockClientInstance.emit("response", { SERVER: "webOS/5.0" }, 200, { address: "192.168.1.10" });
        mockClientInstance.emit("response", { SERVER: "webOS/5.0" }, 200, { address: "192.168.1.11" });
        await vi.advanceTimersByTimeAsync(6000);
        const result = await promise;

        expect(result).toHaveLength(2);
        expect(result.map(t => t.ip)).toContain("192.168.1.10");
        expect(result.map(t => t.ip)).toContain("192.168.1.11");

        vi.useRealTimers();
    });

    it("falls back to 'LG TV' when friendlyName element is blank", async () => {
        vi.useFakeTimers();
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
            text: () => Promise.resolve("<root><device><friendlyName>   </friendlyName></device></root>"),
        }));

        const promise = scanForTVs();
        mockClientInstance.emit("response", { SERVER: "webOS/5.0", LOCATION: "http://192.168.1.100:1884/device.xml" }, 200, { address: "192.168.1.100" });
        await vi.advanceTimersByTimeAsync(6000);
        const result = await promise;

        expect(result[0].name).toBe("LG TV");

        vi.useRealTimers();
    });

    it("treats an empty LOCATION header as no location and skips fetch", async () => {
        vi.useFakeTimers();
        const fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);

        const promise = scanForTVs();
        mockClientInstance.emit("response", { SERVER: "webOS/5.0", LOCATION: "" }, 200, { address: "192.168.1.100" });
        await vi.advanceTimersByTimeAsync(6000);
        const result = await promise;

        expect(fetchMock).not.toHaveBeenCalled();
        expect(result[0].name).toBe("LG TV");

        vi.useRealTimers();
    });

    it("searches using the LG WebOS SSDP service type", async () => {
        vi.useFakeTimers();

        const promise = scanForTVs();
        await vi.advanceTimersByTimeAsync(6000);
        await promise;

        expect(mockClientInstance.search).toHaveBeenCalledWith("urn:dial-multiscreen-org:service:dial:1");

        vi.useRealTimers();
    });
});
