import { action, KeyDownEvent } from "@elgato/streamdeck";
import type { BaseTvActionSettings } from "../types";
import { resolveClient } from "./action-helpers";
import { StatefulTvAction } from "./stateful-tv-action";

@action({ UUID: "com.will-voorhees.smart-tv-control.power-on" })
export class PowerOn extends StatefulTvAction {
    override async onKeyDown(ev: KeyDownEvent<BaseTvActionSettings>): Promise<void> {
        const client = resolveClient(ev.payload.settings?.tvId);
        if (!client) return;
        // Always wake regardless of state: the whole point of this action is to power on
        await client.wakeOnLan();
        client.reconnect();
    }
}
