import { action, KeyDownEvent } from "@elgato/streamdeck";
import { tvClient } from "../tv-client";
import { StatefulTvAction } from "./stateful-tv-action";

@action({ UUID: "com.will-voorhees.lg-tv-control.toggle-power" })
export class TogglePower extends StatefulTvAction {
    override async onKeyDown(_ev: KeyDownEvent): Promise<void> {
        if (tvClient.state === "connected") {
            try { await tvClient.request("ssap://system/turnOff"); } catch { /* ignore */ }
        } else if (tvClient.state === "disconnected") {
            tvClient.reconnect();
        }
        // If "connecting", do nothing and let the connection complete
    }
}
