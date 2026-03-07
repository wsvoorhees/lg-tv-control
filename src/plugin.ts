import streamDeck from "@elgato/streamdeck";

import { IncrementCounter } from "./actions/increment-counter";
import { PowerOn } from "./actions/power-on";
import { scanForTVs } from "./tv-scanner";

// We can enable "trace" logging so that all messages between the Stream Deck, and the plugin are recorded. When storing sensitive information
streamDeck.logger.setLevel("trace");

// Register the increment action.
streamDeck.actions.registerAction(new IncrementCounter());
streamDeck.actions.registerAction(new PowerOn());

// Handle messages from the property inspector.
streamDeck.ui.onSendToPlugin(async (ev) => {
    const payload = ev.payload as { event?: string };
    if (payload.event === "scanForTVs") {
        const tvs = await scanForTVs();
        await streamDeck.ui.sendToPropertyInspector({ event: "tvScanResults", tvs });
    }
});

// Finally, connect to the Stream Deck.
streamDeck.connect();
