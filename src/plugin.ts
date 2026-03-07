import streamDeck from "@elgato/streamdeck";

import { PowerOn } from "./actions/power-on";
import { SetInput } from "./actions/set-input";
import { TurnOff } from "./actions/turn-off";
import { TogglePower } from "./actions/toggle-power";
import { VolumeUp } from "./actions/volume-up";
import { VolumeDown } from "./actions/volume-down";
import { ToggleMute } from "./actions/toggle-mute";
import { MediaPlay } from "./actions/media-play";
import { MediaPause } from "./actions/media-pause";
import { MediaStop } from "./actions/media-stop";
import { MediaRewind } from "./actions/media-rewind";
import { MediaFastForward } from "./actions/media-fast-forward";
import { LaunchApp } from "./actions/launch-app";
import { tvClient } from "./tv-client";
import { scanForTVs } from "./tv-scanner";

streamDeck.logger.setLevel("trace");

// Register actions.
streamDeck.actions.registerAction(new PowerOn());
streamDeck.actions.registerAction(new SetInput());
streamDeck.actions.registerAction(new TurnOff());
streamDeck.actions.registerAction(new TogglePower());
streamDeck.actions.registerAction(new VolumeUp());
streamDeck.actions.registerAction(new VolumeDown());
streamDeck.actions.registerAction(new ToggleMute());
streamDeck.actions.registerAction(new MediaPlay());
streamDeck.actions.registerAction(new MediaPause());
streamDeck.actions.registerAction(new MediaStop());
streamDeck.actions.registerAction(new MediaRewind());
streamDeck.actions.registerAction(new MediaFastForward());
streamDeck.actions.registerAction(new LaunchApp());

// Handle messages from the property inspector.
streamDeck.ui.onSendToPlugin(async (ev) => {
    const payload = ev.payload as { event?: string };

    if (payload.event === "scanForTVs") {
        try {
            const tvs = await scanForTVs();
            await streamDeck.ui.sendToPropertyInspector({ event: "tvScanResults", tvs });
        } catch {
            await streamDeck.ui.sendToPropertyInspector({ event: "tvScanResults", tvs: [] });
        }
    }

    if (payload.event === "getInputList") {
        try {
            const res = await tvClient.request("ssap://tv/getExternalInputList") as { devices?: { id: string; label: string }[] };
            const inputs = (res?.devices ?? []).map(d => ({ id: d.id, label: d.label }));
            await streamDeck.ui.sendToPropertyInspector({ event: "inputList", inputs });
        } catch {
            await streamDeck.ui.sendToPropertyInspector({ event: "inputList", inputs: [] });
        }
    }

    if (payload.event === "getAppList") {
        try {
            const res = await tvClient.request("ssap://com.webos.applicationManager/listApps") as { apps?: { id: string; title: string }[] };
            const apps = (res?.apps ?? []).map(a => ({ id: a.id, label: a.title }));
            await streamDeck.ui.sendToPropertyInspector({ event: "appList", apps });
        } catch {
            await streamDeck.ui.sendToPropertyInspector({ event: "appList", apps: [] });
        }
    }
});

// Finally, connect to the Stream Deck.
streamDeck.connect();
