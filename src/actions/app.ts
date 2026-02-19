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
import {
  compositeAppIcon,
  getCompositeOptionsFromStateFlags,
} from "../services/image-compositor";

type ActionMode = 'launch' | 'news' | 'properties' | 'store' | 'community' | 'validate';

type Settings = {
  name: string;
  id: string;
  params?: string;
  actionMode?: ActionMode;
};

/**
 * Get a list of installed Steam apps.
 */
@action({ UUID: "com.humhunch.superior-steam.run-app" })
export class App extends SingletonAction<Settings> {
  private async buildIcon(steam: Awaited<ReturnType<typeof getSteam>>, appId: string, steamRunning: boolean): Promise<string | null> {
    let iconBase64 = await steam.getAppIconBase64(appId);
    if (!iconBase64) return null;

    if (!steamRunning) {
      return compositeAppIcon(iconBase64, { grayscale: true });
    }

    const app = steam.getAppById(appId);
    if (app) {
      const compositeOptions = getCompositeOptionsFromStateFlags(app.stateFlags);
      if (compositeOptions) {
        return compositeAppIcon(iconBase64, compositeOptions);
      }
    }

    return iconBase64;
  }

  override async onWillAppear(ev: WillAppearEvent<Settings>): Promise<void> {
    const payload = ev.payload.settings;

    // Restore the app icon when the action appears (with state-based effects)
    if (payload.id) {
      try {
        const steam = await getSteam();
        const globalSettings = await streamDeck.settings.getGlobalSettings<PluginGlobalSettings>();
        const steamRunning = globalSettings.steamRunning ?? true;

        const iconBase64 = await this.buildIcon(steam, payload.id, steamRunning);
        if (iconBase64) {
          await ev.action.setImage(iconBase64);
        }
      } catch (error) {
        streamDeck.logger.error(
          `[App] Failed to restore app icon: ${error}`,
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

      // Set the app icon (with state-based effects)
      try {
        const globalSettings = await streamDeck.settings.getGlobalSettings<PluginGlobalSettings>();
        const steamRunning = globalSettings.steamRunning ?? true;

        const iconBase64 = await this.buildIcon(steam, payload.id, steamRunning);
        if (iconBase64) {
          await ev.action.setImage(iconBase64);
        }
      } catch (error) {
        streamDeck.logger.error(`[App] Failed to set app icon: ${error}`);
      }
    }
  }

  /**
   * Refresh all visible App action icons to reflect the current Steam running state.
   */
  async refresh(steamRunning: boolean): Promise<void> {
    const steam = await getSteam();
    for (const action of this.actions) {
      const settings = await action.getSettings();
      if (!settings.id) continue;
      try {
        const iconBase64 = await this.buildIcon(steam, settings.id, steamRunning);
        if (iconBase64) {
          await action.setImage(iconBase64);
        }
      } catch (error) {
        streamDeck.logger.error(`[App] Failed to refresh icon for app ${settings.id}: ${error}`);
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

    if (!settings.id) {
      streamDeck.logger.warn(`[App] No app selected`);
      return;
    }

    const actionMode = settings.actionMode ?? 'launch';
    streamDeck.logger.info(
      `[App] Action '${actionMode}' on app: ${settings.name} (${settings.id})`,
    );

    switch (actionMode) {
      case 'launch':
        steam.launchApp(settings.id, settings.params);
        break;
      case 'news':
        steam.openAppNews(settings.id);
        break;
      case 'properties':
        steam.openAppProperties(settings.id);
        break;
      case 'store':
        steam.openAppStore(settings.id);
        break;
      case 'community':
        steam.openAppCommunity(settings.id);
        break;
      case 'validate':
        steam.validateApp(settings.id);
        break;
    }
  }
}
