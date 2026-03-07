import { action, KeyDownEvent } from "@elgato/streamdeck";
import { tvClient } from "../tv-client";
import { StatefulTvAction } from "./stateful-tv-action";

@action({ UUID: "com.will-voorhees.lg-tv-control.power-on" })
export class PowerOn extends StatefulTvAction {
    override onKeyDown(_ev: KeyDownEvent): void {
        tvClient.reconnect();
    }
}
