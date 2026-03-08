export type ConnectionState = "disconnected" | "connecting" | "connected";

export type TvConfig = {
    id: string;     // crypto.randomUUID() — stable for the lifetime of the entry
    name: string;   // user-visible label, e.g. "Living Room TV"
    ip: string;
    mac?: string;   // optional Wake-on-LAN MAC address
};

export type GlobalSettings = {
    tvs: TvConfig[];
};

/** Mixin for every action's settings object — identifies which TV to target. */
export type BaseTvActionSettings = {
    tvId?: string;  // references GlobalSettings.tvs[n].id; undefined → first TV
};
