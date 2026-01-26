import streamDeck, {
  ApplicationDidLaunchEvent,
  ApplicationDidTerminateEvent,
  LogLevel,
} from "@elgato/streamdeck";

import { BigPicture } from "./actions/big-picture";
import { LaunchAccount } from "./actions/launch-account";
import { RunApp } from "./actions/run-app";
import { resetSteam } from "./services/steam-singleton";
import { Status } from "./actions/status";

// "trace" logging so that all messages between the Stream Deck, and the plugin are recorded.
streamDeck.logger.setLevel(LogLevel.TRACE);

// Register actions
streamDeck.actions.registerAction(new BigPicture());
streamDeck.actions.registerAction(new Status());
streamDeck.actions.registerAction(new RunApp());
streamDeck.actions.registerAction(new LaunchAccount());

streamDeck.system.onApplicationDidLaunch((ev: ApplicationDidLaunchEvent) => {
  if (ev.application === "steam.exe") {
    streamDeck.logger.info("Steam launched");
  }
});

streamDeck.system.onApplicationDidTerminate(
  (ev: ApplicationDidTerminateEvent) => {
    if (ev.application === "steam.exe") {
      streamDeck.logger.info("Steam terminated");
      resetSteam();
    }
  },
);

// Connect to Stream Deck and initialize Steam library
streamDeck.connect().then(async () => {});
