import { randomUUID } from "node:crypto";
import streamDeck from "@elgato/streamdeck";

import { PowerOn } from "./actions/power-on";
import { SetInput } from "./actions/set-input";
import { TurnOff } from "./actions/turn-off";
import { TogglePower } from "./actions/toggle-power";
import { VolumeUp } from "./actions/volume-up";
import { VolumeDown } from "./actions/volume-down";
import { ToggleMute } from "./actions/toggle-mute";
import { MediaPlay } from "./actions/media-play";
import { MediaPause } from "./actions/media-pause";
import { MediaPlayPause } from "./actions/media-play-pause";
import { MediaStop } from "./actions/media-stop";
import { MediaRewind } from "./actions/media-rewind";
import { MediaFastForward } from "./actions/media-fast-forward";
import { LaunchApp } from "./actions/launch-app";
import { tvClientPool } from "./tv-client-pool";
import { scanForTVs } from "./tv-scanner";
import type { GlobalSettings, TvConfig } from "./types";

streamDeck.logger.setLevel("info");

// Register actions.
streamDeck.actions.registerAction(new PowerOn());
streamDeck.actions.registerAction(new SetInput());
streamDeck.actions.registerAction(new TurnOff());
streamDeck.actions.registerAction(new TogglePower());
streamDeck.actions.registerAction(new VolumeUp());
streamDeck.actions.registerAction(new VolumeDown());
streamDeck.actions.registerAction(new ToggleMute());
streamDeck.actions.registerAction(new MediaPlay());
streamDeck.actions.registerAction(new MediaPause());
streamDeck.actions.registerAction(new MediaPlayPause());
streamDeck.actions.registerAction(new MediaStop());
streamDeck.actions.registerAction(new MediaRewind());
streamDeck.actions.registerAction(new MediaFastForward());
streamDeck.actions.registerAction(new LaunchApp());

// Push TV connection state changes to the property inspector.
tvClientPool.on("stateChange", async (id: string, state: string) => {
    try {
        await streamDeck.ui.sendToPropertyInspector({ event: "connectionState", id, state });
    } catch { /* PI may not be open */ }
});

/** Migrates old single-TV settings to the new multi-TV format. Exported for testing. */
export function migrateSettings(raw: Record<string, unknown>): GlobalSettings {
    if (Array.isArray((raw as { tvs?: unknown }).tvs)) return raw as GlobalSettings;
    const tvs: TvConfig[] = [];
    if (typeof raw.tvIpAddress === "string" && raw.tvIpAddress) {
        tvs.push({
            id: randomUUID(),
            name: typeof raw.tvName === "string" && raw.tvName ? raw.tvName : "LG TV",
            ip: raw.tvIpAddress,
            mac: typeof raw.tvMacAddress === "string" && raw.tvMacAddress ? raw.tvMacAddress : undefined,
        });
    }
    return { tvs };
}

async function sendTvList(): Promise<void> {
    const configs = tvClientPool.getConfigs();
    const tvs = configs.map(cfg => ({ ...cfg, state: tvClientPool.get(cfg.id)?.state ?? "disconnected" }));
    try {
        await streamDeck.ui.sendToPropertyInspector({ event: "tvList", tvs });
    } catch { /* PI may not be open */ }
}

// Push TV list whenever the property inspector opens (the PI's own getTvList fires too early).
streamDeck.ui.onDidAppear(() => sendTvList());

// Handle messages from the property inspector.
streamDeck.ui.onSendToPlugin(async (ev) => {
    const payload = ev.payload as { event?: string } & Record<string, unknown>;
    streamDeck.logger.debug(`[plugin] PI → plugin: ${payload.event}`);

    if (payload.event === "getTvList") {
        await sendTvList();
        return;
    }

    if (payload.event === "addTv") {
        const { ip, mac, name } = payload as { ip?: string; mac?: string; name?: string };
        if (!ip) return;
        const settings = await streamDeck.settings.getGlobalSettings<GlobalSettings>();
        const tvs: TvConfig[] = [
            ...(settings.tvs ?? []),
            { id: randomUUID(), name: name ?? "LG TV", ip, mac: mac || undefined },
        ];
        await streamDeck.settings.setGlobalSettings({ tvs });
        tvClientPool.configure(tvs);
        await sendTvList();
        return;
    }

    if (payload.event === "updateTv") {
        const { id, ip, mac, name } = payload as { id?: string; ip?: string; mac?: string; name?: string };
        if (!id) return;
        const settings = await streamDeck.settings.getGlobalSettings<GlobalSettings>();
        const tvs = (settings.tvs ?? []).map(t =>
            t.id === id
                ? {
                    ...t,
                    ...(ip !== undefined && { ip }),
                    ...(name !== undefined && { name }),
                    mac: mac !== undefined ? (mac || undefined) : t.mac,
                }
                : t
        );
        await streamDeck.settings.setGlobalSettings({ tvs });
        tvClientPool.configure(tvs);
        await sendTvList();
        return;
    }

    if (payload.event === "removeTv") {
        const { id } = payload as { id?: string };
        if (!id) return;
        const settings = await streamDeck.settings.getGlobalSettings<GlobalSettings>();
        const tvs = (settings.tvs ?? []).filter(t => t.id !== id);
        await streamDeck.settings.setGlobalSettings({ tvs });
        tvClientPool.configure(tvs);
        await sendTvList();
        return;
    }

    if (payload.event === "scanForTVs") {
        streamDeck.logger.info("TV scan started");
        try {
            const tvs = await scanForTVs();
            streamDeck.logger.info("TV scan complete", tvs);
            await streamDeck.ui.sendToPropertyInspector({ event: "tvScanResults", tvs });
        } catch (err) {
            streamDeck.logger.error("TV scan failed", err);
            await streamDeck.ui.sendToPropertyInspector({ event: "tvScanResults", tvs: [] });
        }
        return;
    }

    if (payload.event === "getInputList") {
        const tvId = payload.tvId as string | undefined;
        const client = (tvId ? tvClientPool.get(tvId) : undefined) ?? tvClientPool.getDefault();
        if (!client || client.state !== "connected") {
            await streamDeck.ui.sendToPropertyInspector({ event: "inputList", inputs: [], error: "not_connected" });
            return;
        }
        try {
            const res = await client.request("ssap://tv/getExternalInputList") as { devices?: { id: string; label: string }[] };
            const inputs = (res?.devices ?? []).map(d => ({ id: d.id, label: d.label }));
            await streamDeck.ui.sendToPropertyInspector({ event: "inputList", inputs });
        } catch {
            await streamDeck.ui.sendToPropertyInspector({ event: "inputList", inputs: [] });
        }
        return;
    }

    if (payload.event === "getAppList") {
        const tvId = payload.tvId as string | undefined;
        const client = (tvId ? tvClientPool.get(tvId) : undefined) ?? tvClientPool.getDefault();
        if (!client || client.state !== "connected") {
            await streamDeck.ui.sendToPropertyInspector({ event: "appList", apps: [], error: "not_connected" });
            return;
        }
        try {
            const res = await client.request("ssap://com.webos.applicationManager/listApps") as { apps?: { id: string; title: string }[] };
            const apps = (res?.apps ?? []).map(a => ({ id: a.id, label: a.title }));
            await streamDeck.ui.sendToPropertyInspector({ event: "appList", apps });
        } catch {
            await streamDeck.ui.sendToPropertyInspector({ event: "appList", apps: [] });
        }
    }
});

streamDeck.connect().then(async () => {
    const raw = await streamDeck.settings.getGlobalSettings() as Record<string, unknown>;
    const migrated = !Array.isArray((raw as { tvs?: unknown }).tvs);
    const settings = migrateSettings(raw);
    if (migrated) await streamDeck.settings.setGlobalSettings(settings);
    streamDeck.logger.debug(`[plugin] startup: ${settings.tvs.length} TV(s) configured`);
    tvClientPool.configure(settings.tvs);
}).catch((err) => {
    streamDeck.logger.error("Failed to connect or load global settings at startup", err);
});

streamDeck.settings.onDidReceiveGlobalSettings<GlobalSettings>((ev) => {
    streamDeck.logger.debug(`[plugin] globalSettings: ${(ev.settings.tvs ?? []).length} TV(s)`);
    tvClientPool.configure(ev.settings.tvs ?? []);
});
