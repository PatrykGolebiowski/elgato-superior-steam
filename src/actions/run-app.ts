import streamDeck, {
  action,
  KeyDownEvent,
  SingletonAction,
  JsonValue,
  DidReceiveSettingsEvent,
  SendToPluginEvent,
  WillAppearEvent,
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
  override async onWillAppear(ev: WillAppearEvent<Settings>): Promise<void> {
    const payload = ev.payload.settings;

    // Restore the app icon when the action appears
    if (payload.id) {
      try {
        const steam = await getSteam();
        const iconBase64 = await steam.getAppIconBase64(payload.id);
        if (iconBase64) {
          await ev.action.setImage(iconBase64);
        }
      } catch (error) {
        streamDeck.logger.error(
          `[RunApp] Failed to restore app icon: ${error}`,
        );
      }
    }
  }

  override async onDidReceiveSettings(
    ev: DidReceiveSettingsEvent<Settings>,
  ): Promise<void> {
    const payload = ev.payload.settings;

    // Look up and store the game name when ID changes
    if (payload.id) {
      const steam = await getSteam();
      const steamApp = steam
        .getInstalledApps()
        .find((steamApp) => steamApp.id.toString() === payload.id);

      if (steamApp && payload.name !== steamApp.name) {
        await ev.action.setSettings({ ...payload, name: steamApp.name });
      }

      // Set the app icon
      try {
        const iconBase64 = await steam.getAppIconBase64(payload.id);
        if (iconBase64) {
          await ev.action.setImage(iconBase64);
        }
      } catch (error) {
        streamDeck.logger.error(`[RunApp] Failed to set app icon: ${error}`);
      }
    }
  }

  override async onSendToPlugin(
    ev: SendToPluginEvent<JsonValue, Settings>,
  ): Promise<void> {
    // Handle datasource requests
    if (
      ev.payload instanceof Object &&
      "event" in ev.payload &&
      ev.payload.event === "installedApps"
    ) {
      const steam = await getSteam();
      const items: DataSourceResult = steam.getInstalledApps().map((app) => ({
        value: String(app.id),
        label: app.name,
      }));

      streamDeck.ui.current?.sendToPropertyInspector({
        event: "installedApps",
        items,
      } satisfies DataSourcePayload);
    }
  }

  override async onKeyDown(ev: KeyDownEvent<Settings>): Promise<void> {
    const steam = await getSteam();
    const settings = ev.payload.settings;

    if (settings.id) {
      streamDeck.logger.info(
        `[RunApp] Launching app: ${settings.name} (${settings.id})`,
      );
      steam.launchApp(settings.id);
    } else {
      streamDeck.logger.warn(`[RunApp] No app selected`);
    }
  }
}
