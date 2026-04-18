import { action, DidReceiveSettingsEvent, KeyDownEvent, SingletonAction, WillAppearEvent } from "@elgato/streamdeck";
import type { BaseTvActionSettings } from "../types";
import { resolveClient, wakeAndReconnect } from "./action-helpers";

type LaunchAppSettings = BaseTvActionSettings & {
    appId?: string;
    appLabel?: string;
};

@action({ UUID: "com.will-voorhees.lg-tv-control.launch-app" })
export class LaunchApp extends SingletonAction<LaunchAppSettings> {
    override onWillAppear(ev: WillAppearEvent<LaunchAppSettings>): void {
        const { appLabel, appId } = ev.payload.settings;
        ev.action.setTitle(appLabel ?? appId ?? "App");
    }

    override onDidReceiveSettings(ev: DidReceiveSettingsEvent<LaunchAppSettings>): void {
        const { appLabel, appId } = ev.payload.settings;
        ev.action.setTitle(appLabel ?? appId ?? "App");
    }

    override async onKeyDown(ev: KeyDownEvent<LaunchAppSettings>): Promise<void> {
        const { appId, appLabel, tvId } = ev.payload.settings;

        if (!appId) {
            ev.action.setTitle("No app");
            setTimeout(() => ev.action.setTitle(appLabel ?? "App"), 2000);
            return;
        }

        const client = resolveClient(tvId);
        if (!client) return;

        await wakeAndReconnect(client);
        const needsWait = client.state !== "connected";
        if (needsWait) ev.action.setTitle("...");

        try {
            await client.waitForConnected();
            await client.request("ssap://system.launcher/launch", { id: appId });
            if (needsWait) ev.action.setTitle(appLabel ?? appId);
        } catch {
            ev.action.setTitle("!");
            setTimeout(() => ev.action.setTitle(appLabel ?? appId), 2000);
        }
    }
}
