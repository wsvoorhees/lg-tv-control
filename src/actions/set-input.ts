import { action, DidReceiveSettingsEvent, KeyDownEvent, SingletonAction, WillAppearEvent } from "@elgato/streamdeck";
import { tvClient } from "../tv-client";

type SetInputSettings = {
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
        const { inputId, inputLabel } = ev.payload.settings;

        if (!inputId) {
            ev.action.setTitle("No input");
            setTimeout(() => ev.action.setTitle(inputLabel ?? "Input"), 2000);
            return;
        }

        if (tvClient.state === "disconnected") { await tvClient.wakeOnLan(); tvClient.reconnect(); }
        const needsWait = tvClient.state !== "connected";
        if (needsWait) ev.action.setTitle("...");

        try {
            await tvClient.waitForConnected();
            await tvClient.request("ssap://tv/switchInput", { inputId });
            if (needsWait) ev.action.setTitle(inputLabel ?? inputId);
        } catch {
            ev.action.setTitle("!");
            setTimeout(() => ev.action.setTitle(inputLabel ?? inputId), 2000);
        }
    }
}
