import streamDeck, {
  ApplicationDidLaunchEvent,
  ApplicationDidTerminateEvent,
  LogLevel,
} from "@elgato/streamdeck";

import { BigPicture } from "./actions/big-picture";
import { LaunchAccount } from "./actions/launch-account";
import { App } from "./actions/app";
import {
  getSteam,
  resetSteam,
  syncGlobalSettings,
} from "./services/steam-singleton";
import { Status } from "./actions/status";

// "trace" logging so that all messages between the Stream Deck, and the plugin are recorded.
streamDeck.logger.setLevel(LogLevel.TRACE);

// Register actions
const appAction = new App();
const launchAccountAction = new LaunchAccount();

streamDeck.actions.registerAction(new BigPicture());
streamDeck.actions.registerAction(new Status());
streamDeck.actions.registerAction(appAction);
streamDeck.actions.registerAction(launchAccountAction);

async function refreshAllIcons(steamRunning: boolean): Promise<void> {
  await Promise.all([
    appAction.refresh(steamRunning),
    launchAccountAction.refresh(steamRunning),
  ]);
}

streamDeck.system.onApplicationDidLaunch((ev: ApplicationDidLaunchEvent) => {
  streamDeck.logger.info("Steam launched");
  syncGlobalSettings({ steamRunning: true }).then(() => refreshAllIcons(true));
});

streamDeck.system.onApplicationDidTerminate(
  (ev: ApplicationDidTerminateEvent) => {
    streamDeck.logger.info("Steam terminated");
    syncGlobalSettings({ steamRunning: false, autoLoginUser: undefined })
      .then(() => refreshAllIcons(false))
      .finally(() => resetSteam());
  },
);

// Connect to Stream Deck and initialize Steam library
streamDeck.connect().then(async () => {
  try {
    const steam = await getSteam();
    const steamRunning = await steam.isSteamRunning();
    const autoLoginUser = steam.getAutoLoginUser();
    const steamPath = steam.getSteamPath();

    await syncGlobalSettings({
      steamRunning,
      autoLoginUser,
      steamPath,
    });

    streamDeck.logger.info(
      `Steam initialized: running=${steamRunning}, user=${autoLoginUser}`,
    );
  } catch (error) {
    streamDeck.logger.error("Failed to initialize Steam:", error);
  }
});
