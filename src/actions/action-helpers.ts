import { tvClientPool } from "../tv-client-pool";
import type { TvClient } from "../tv-client";

/** Returns the TvClient for the given tvId, or the default client if tvId is not provided. */
export function resolveClient(tvId?: string): TvClient | undefined {
    return (tvId ? tvClientPool.get(tvId) : undefined) ?? tvClientPool.getDefault();
}
