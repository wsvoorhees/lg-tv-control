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

// Import after mocking
const { scanForTVs } = await import("./tv-scanner.js");

describe("scanForTVs", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockClientInstance.removeAllListeners();
        mockClientInstance.search = vi.fn();
        mockClientInstance.stop = vi.fn();
    });

    it("resolves with an empty array when no devices respond", async () => {
        vi.useFakeTimers();

        const promise = scanForTVs();
        vi.advanceTimersByTime(6000);
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

        vi.advanceTimersByTime(6000);
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
        vi.advanceTimersByTime(6000);
        const result = await promise;

        expect(result[0].name).toBe("LG TV");

        vi.useRealTimers();
    });

    it("does not set a name for non-webOS devices", async () => {
        vi.useFakeTimers();

        const promise = scanForTVs();
        mockClientInstance.emit("response", { SERVER: "UPnP/1.0 SomeOtherDevice/1.0" }, 200, { address: "10.0.0.6" });
        vi.advanceTimersByTime(6000);
        const result = await promise;

        expect(result[0].name).toBeUndefined();

        vi.useRealTimers();
    });

    it("deduplicates responses from the same IP", async () => {
        vi.useFakeTimers();

        const promise = scanForTVs();
        mockClientInstance.emit("response", { SERVER: "webOS/5.0" }, 200, { address: "192.168.1.50" });
        mockClientInstance.emit("response", { SERVER: "webOS/5.0" }, 200, { address: "192.168.1.50" });
        vi.advanceTimersByTime(6000);
        const result = await promise;

        expect(result).toHaveLength(1);

        vi.useRealTimers();
    });

    it("discovers multiple TVs at different IPs", async () => {
        vi.useFakeTimers();

        const promise = scanForTVs();
        mockClientInstance.emit("response", { SERVER: "webOS/5.0" }, 200, { address: "192.168.1.10" });
        mockClientInstance.emit("response", { SERVER: "webOS/5.0" }, 200, { address: "192.168.1.11" });
        vi.advanceTimersByTime(6000);
        const result = await promise;

        expect(result).toHaveLength(2);
        expect(result.map(t => t.ip)).toContain("192.168.1.10");
        expect(result.map(t => t.ip)).toContain("192.168.1.11");

        vi.useRealTimers();
    });

    it("searches using the LG WebOS SSDP service type", async () => {
        vi.useFakeTimers();

        const promise = scanForTVs();
        vi.advanceTimersByTime(6000);
        await promise;

        expect(mockClientInstance.search).toHaveBeenCalledWith("urn:dial-multiscreen-org:service:dial:1");

        vi.useRealTimers();
    });
});
