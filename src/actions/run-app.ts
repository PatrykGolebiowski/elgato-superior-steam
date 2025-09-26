import streamDeck, {
  action,
  KeyDownEvent,
  KeyUpEvent,
  SingletonAction,
  JsonValue,
  DidReceiveSettingsEvent,
  SendToPluginEvent,
} from "@elgato/streamdeck";
import { DataSourcePayload, DataSourceResult } from "../types/sdpi";
import { getSteam } from "../services/steam-singleton";

type Settings = {
  name: string;
  id: string;
};

/**
 * Get a list of installed Steam apps.
 */
@action({ UUID: "com.humhunch.superior-steam.run-app" })
export class RunApp extends SingletonAction<Settings> {

  override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<Settings>): Promise<void> {
    const payload = ev.payload.settings;

    // Look up and store the game name when ID changes
    if (payload.id) {
      const steam = await getSteam();
      const steamApp = steam.getInstalledGames().find(steamApp => steamApp.AppId.toString() === payload.id);

      if (steamApp && payload.name !== steamApp.Name) {
        await ev.action.setSettings({ ...payload, name: steamApp.Name });
      }
    }
  }

  override async onSendToPlugin(ev: SendToPluginEvent<JsonValue, Settings>): Promise<void> {
    // Handle datasource requests
    if (ev.payload instanceof Object && "event" in ev.payload && ev.payload.event === "installedApps") {
      const steam = await getSteam();
      const items: DataSourceResult = steam.getInstalledGames().map(game => ({
        value: game.AppId,
        label: game.Name,
      }));

      streamDeck.ui.current?.sendToPropertyInspector({
        event: "installedApps",
        items,
      } satisfies DataSourcePayload);
    }
  }

  override async onKeyDown(ev: KeyDownEvent): Promise<void> {
    const steam = await getSteam();
    const settings = ev.payload.settings;

    if (settings.gameId) {
      streamDeck.logger.info(`[RunApp] Launching game: ${settings.gameName} (${settings.gameId})`);
      // TODO: Launch the game using Steam protocol
      // steam.launchGame(settings.gameId);
    } else {
      streamDeck.logger.warn(`[RunApp] No game selected`);
    }
  }
}
