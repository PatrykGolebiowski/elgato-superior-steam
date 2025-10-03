import streamDeck, { LogLevel } from "@elgato/streamdeck";

import { BigPicture } from "./actions/big-picture";
import { Status } from "./actions/status";
import { RunApp } from "./actions/run-app";
import { LaunchAccount } from "./actions/launch-account";

// "trace" logging so that all messages between the Stream Deck, and the plugin are recorded.
streamDeck.logger.setLevel(LogLevel.TRACE);

// Register actions
streamDeck.actions.registerAction(new BigPicture());
streamDeck.actions.registerAction(new Status());
streamDeck.actions.registerAction(new RunApp());
streamDeck.actions.registerAction(new LaunchAccount());

// Connect to Stream Deck and initialize Steam library
streamDeck.connect().then(async () => {});
