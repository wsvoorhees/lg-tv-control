import { action, KeyDownEvent, SingletonAction, WillAppearEvent } from "@elgato/streamdeck";
import { tvClient } from "../tv-client";

type LaunchAppSettings = {
    tvIpAddress?: string;
    appId?: string;
    appLabel?: string;
};

@action({ UUID: "com.will-voorhees.lg-tv-control.launch-app" })
export class LaunchApp extends SingletonAction<LaunchAppSettings> {
    override onWillAppear(ev: WillAppearEvent<LaunchAppSettings>): void {
        const { tvIpAddress, appLabel, appId } = ev.payload.settings;
        if (tvIpAddress) {
            tvClient.connect(tvIpAddress);
        }
        ev.action.setTitle(appLabel ?? appId ?? "App");
    }

    override async onKeyDown(ev: KeyDownEvent<LaunchAppSettings>): Promise<void> {
        const { tvIpAddress, appId, appLabel } = ev.payload.settings;

        if (!appId) {
            ev.action.setTitle("No app");
            return;
        }

        if (tvIpAddress) {
            tvClient.connect(tvIpAddress);
        }

        if (tvClient.state !== "connected") {
            ev.action.setTitle("...");
            setTimeout(() => ev.action.setTitle(appLabel ?? appId), 2000);
            return;
        }

        await tvClient.request("ssap://system.launcher/launch", { id: appId });
    }
}
