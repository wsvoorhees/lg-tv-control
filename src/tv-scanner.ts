import { Client, SsdpHeaders } from "node-ssdp";
import type { RemoteInfo } from "dgram";
import streamDeck from "@elgato/streamdeck";

export type DiscoveredTV = {
    ip: string;
    name?: string;
};

type TVCandidate = {
    ip: string;
    isWebOS: boolean;
    locationUrl?: string;
};

const LG_WEBOS_ST = "urn:dial-multiscreen-org:service:dial:1";
const SCAN_TIMEOUT_MS = 6000;

async function fetchFriendlyName(locationUrl: string): Promise<string | undefined> {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 1500);
        const res = await fetch(locationUrl, { signal: controller.signal });
        clearTimeout(timeout);
        const xml = await res.text();
        const match = xml.match(/<friendlyName>([^<]+)<\/friendlyName>/i);
        return match?.[1]?.trim() || undefined;
    } catch {
        return undefined;
    }
}

export function scanForTVs(): Promise<DiscoveredTV[]> {
    return new Promise((resolve) => {
        const client = new Client();
        const found = new Map<string, TVCandidate>();

        client.on("response", (headers: SsdpHeaders, _statusCode: number, rinfo: RemoteInfo) => {
            const ip = rinfo.address;
            streamDeck.logger.info("SSDP response", { ip, headers });
            if (!found.has(ip)) {
                const server = String(headers["SERVER"] ?? headers["server"] ?? "");
                const location = String(headers["LOCATION"] ?? headers["location"] ?? "");
                found.set(ip, {
                    ip,
                    isWebOS: server.includes("webOS"),
                    locationUrl: location || undefined,
                });
            }
        });

        client.search(LG_WEBOS_ST);

        setTimeout(async () => {
            client.stop();
            const webOSCandidates = Array.from(found.values()).filter(c => c.isWebOS);
            const tvs = await Promise.all(
                webOSCandidates.map(async ({ ip, locationUrl }) => {
                    const friendlyName = locationUrl ? await fetchFriendlyName(locationUrl) : undefined;
                    return { ip, name: friendlyName ?? "LG TV" };
                })
            );
            streamDeck.logger.info("SSDP scan complete", { tvs });
            resolve(tvs);
        }, SCAN_TIMEOUT_MS);
    });
}
