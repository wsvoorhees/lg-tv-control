import { action, KeyDownEvent, SingletonAction, WillAppearEvent } from "@elgato/streamdeck";
import { tvClient } from "../tv-client";

type SetInputSettings = {
    tvIpAddress?: string;
    inputId?: string;
    inputLabel?: string;
};

@action({ UUID: "com.will-voorhees.lg-tv-control.set-input" })
export class SetInput extends SingletonAction<SetInputSettings> {
    override onWillAppear(ev: WillAppearEvent<SetInputSettings>): void {
        const { tvIpAddress, inputLabel, inputId } = ev.payload.settings;
        if (tvIpAddress) {
            tvClient.connect(tvIpAddress);
        }
        ev.action.setTitle(inputLabel ?? inputId ?? "Input");
    }

    override async onKeyDown(ev: KeyDownEvent<SetInputSettings>): Promise<void> {
        const { tvIpAddress, inputId, inputLabel } = ev.payload.settings;

        if (!inputId) {
            ev.action.setTitle("No input");
            return;
        }

        if (tvIpAddress) {
            tvClient.connect(tvIpAddress);
        }

        if (tvClient.state !== "connected") {
            ev.action.setTitle("...");
            setTimeout(() => ev.action.setTitle(inputLabel ?? inputId), 2000);
            return;
        }

        await tvClient.request("ssap://tv/switchInput", { inputId });
    }
}
