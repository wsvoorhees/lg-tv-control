import { Client, SsdpHeaders } from "node-ssdp";
import type { RemoteInfo } from "dgram";

export type DiscoveredTV = {
    ip: string;
    name?: string;
};

const LG_WEBOS_ST = "urn:dial-multiscreen-org:service:dial:1";
const SCAN_TIMEOUT_MS = 6000;

export function scanForTVs(): Promise<DiscoveredTV[]> {
    return new Promise((resolve) => {
        const client = new Client();
        const found = new Map<string, DiscoveredTV>();

        client.on("response", (headers: SsdpHeaders, _statusCode: number, rinfo: RemoteInfo) => {
            const ip = rinfo.address;
            if (!found.has(ip)) {
                const server = String(headers["SERVER"] ?? headers["server"] ?? "");
                const name = server.includes("webOS") ? "LG TV" : undefined;
                found.set(ip, { ip, name });
            }
        });

        client.search(LG_WEBOS_ST);

        setTimeout(() => {
            client.stop();
            resolve(Array.from(found.values()));
        }, SCAN_TIMEOUT_MS);
    });
}
