import { tvClientPool } from "../tv-client-pool";
import type { TvClient } from "../tv-client";

/** Returns the TvClient for the given tvId, or the default client if tvId is not provided. */
export function resolveClient(tvId?: string): TvClient | undefined {
    return (tvId ? tvClientPool.get(tvId) : undefined) ?? tvClientPool.getDefault();
}

/** Sends a WOL packet and starts reconnecting if the client is disconnected. No-op otherwise. */
export async function wakeAndReconnect(client: TvClient): Promise<void> {
    if (client.state !== "disconnected") return;
    await client.wakeOnLan();
    client.reconnect();
}
