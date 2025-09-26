import streamDeck, { LogLevel } from "@elgato/streamdeck";

import { getSteam } from "./services/steam-singleton";

import { BigPicture } from "./actions/big-picture";
import { Status } from "./actions/status";
import { RunApp } from "./actions/run-app";
import { SwitchAccount } from "./actions/switch-account";


// "trace" logging so that all messages between the Stream Deck, and the plugin are recorded.
streamDeck.logger.setLevel(LogLevel.TRACE);

// Register actions
streamDeck.actions.registerAction(new BigPicture());
streamDeck.actions.registerAction(new Status());
streamDeck.actions.registerAction(new RunApp());
streamDeck.actions.registerAction(new SwitchAccount());

// Connect to Stream Deck and initialize Steam library
streamDeck.connect().then(async () => {
  const steam = await getSteam();

  streamDeck.settings.setGlobalSettings({
    installedGames: steam.getInstalledGames(),
  });
  const settings = await streamDeck.settings.getGlobalSettings();
  streamDeck.logger.info("Global settings:", settings);
});
