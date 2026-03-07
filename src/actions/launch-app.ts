import { action, DidReceiveSettingsEvent, KeyDownEvent, SingletonAction, WillAppearEvent } from "@elgato/streamdeck";
import { tvClient } from "../tv-client";

type LaunchAppSettings = {
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
        const { appId, appLabel } = ev.payload.settings;

        if (!appId) {
            ev.action.setTitle("No app");
            return;
        }

        if (tvClient.state !== "connected") {
            ev.action.setTitle("...");
            setTimeout(() => ev.action.setTitle(appLabel ?? appId), 2000);
            return;
        }

        try {
            await tvClient.request("ssap://system.launcher/launch", { id: appId });
        } catch {
            ev.action.setTitle("!");
            setTimeout(() => ev.action.setTitle(appLabel ?? appId), 2000);
        }
    }
}
