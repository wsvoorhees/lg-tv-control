import { action, KeyDownEvent } from "@elgato/streamdeck";
import { tvClient } from "../tv-client";
import { StatefulTvAction } from "./stateful-tv-action";

@action({ UUID: "com.will-voorhees.lg-tv-control.turn-off" })
export class TurnOff extends StatefulTvAction {
    override async onKeyDown(_ev: KeyDownEvent): Promise<void> {
        if (tvClient.state !== "connected") return;
        try { await tvClient.request("ssap://system/turnOff"); } catch { /* ignore */ }
    }
}
