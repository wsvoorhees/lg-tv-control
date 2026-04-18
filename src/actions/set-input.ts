import { action, DidReceiveSettingsEvent, KeyDownEvent, SingletonAction, WillAppearEvent } from "@elgato/streamdeck";
import type { BaseTvActionSettings } from "../types";
import { resolveClient, wakeAndReconnect } from "./action-helpers";

type SetInputSettings = BaseTvActionSettings & {
    inputId?: string;
    inputLabel?: string;
};

@action({ UUID: "com.will-voorhees.lg-tv-control.set-input" })
export class SetInput extends SingletonAction<SetInputSettings> {
    override onWillAppear(ev: WillAppearEvent<SetInputSettings>): void {
        const { inputLabel, inputId } = ev.payload.settings;
        ev.action.setTitle(inputLabel ?? inputId ?? "Input");
    }

    override onDidReceiveSettings(ev: DidReceiveSettingsEvent<SetInputSettings>): void {
        const { inputLabel, inputId } = ev.payload.settings;
        ev.action.setTitle(inputLabel ?? inputId ?? "Input");
    }

    override async onKeyDown(ev: KeyDownEvent<SetInputSettings>): Promise<void> {
        const { inputId, inputLabel, tvId } = ev.payload.settings;

        if (!inputId) {
            ev.action.setTitle("No input");
            setTimeout(() => ev.action.setTitle(inputLabel ?? "Input"), 2000);
            return;
        }

        const client = resolveClient(tvId);
        if (!client) return;

        await wakeAndReconnect(client);
        const needsWait = client.state !== "connected";
        if (needsWait) ev.action.setTitle("...");

        try {
            await client.waitForConnected();
            await client.request("ssap://tv/switchInput", { inputId });
            if (needsWait) ev.action.setTitle(inputLabel ?? inputId);
        } catch {
            ev.action.setTitle("!");
            setTimeout(() => ev.action.setTitle(inputLabel ?? inputId), 2000);
        }
    }
}
