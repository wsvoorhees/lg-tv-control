import streamDeck from "@elgato/streamdeck";

import { PowerOn } from "./actions/power-on";
import { SetInput } from "./actions/set-input";
import { TurnOff } from "./actions/turn-off";
import { ToggleTv } from "./actions/toggle-tv";
import { tvClient } from "./tv-client";
import { scanForTVs } from "./tv-scanner";

// We can enable "trace" logging so that all messages between the Stream Deck, and the plugin are recorded. When storing sensitive information
streamDeck.logger.setLevel("trace");

// Register actions.
streamDeck.actions.registerAction(new PowerOn());
streamDeck.actions.registerAction(new SetInput());
streamDeck.actions.registerAction(new TurnOff());
streamDeck.actions.registerAction(new ToggleTv());

// Handle messages from the property inspector.
streamDeck.ui.onSendToPlugin(async (ev) => {
    const payload = ev.payload as { event?: string };

    if (payload.event === "scanForTVs") {
        const tvs = await scanForTVs();
        await streamDeck.ui.sendToPropertyInspector({ event: "tvScanResults", tvs });
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
});

// Finally, connect to the Stream Deck.
streamDeck.connect();
