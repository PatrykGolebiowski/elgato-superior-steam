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
  private isMonitoringSubscribed = false;

  override async onWillAppear(ev: WillAppearEvent<Settings>): Promise<void> {
    const payload = ev.payload.settings;

    // Subscribe to app state changes (only once)
    if (!this.isMonitoringSubscribed) {
      this.subscribeToAppStateChanges();
      this.isMonitoringSubscribed = true;
    }

    // Restore the app icon when the action appears (with state-based effects)
    if (payload.id) {
      await this.updateAppIcon(ev.action, payload.id);
    }
  }

  private subscribeToAppStateChanges(): void {
    getSteam()
      .then((steam) => {
        steam.onAppStateChange(async (appId, isRunning) => {
          streamDeck.logger.info(
            `[App] App ${appId} ${isRunning ? "started" : "stopped"}`,
          );

          // Update all actions that are showing this app
          const actions = this.actions;
          for (const action of actions) {
            const settings = await action.getSettings();
            if (settings.id === appId.toString()) {
              await this.updateAppIcon(action, settings.id);
            }
          }
        });
      })
      .catch((error) => {
        streamDeck.logger.error(
          `[App] Failed to subscribe to app state changes: ${error}`,
        );
      });
  }

  private async updateAppIcon(
    action: any,
    appId: string,
  ): Promise<void> {
    try {
      const steam = await getSteam();
      let iconBase64 = await steam.getAppIconBase64(appId);

      if (iconBase64) {
        // Apply state-based visual effects (including running state)
        const app = steam.getAppById(appId);
        const isRunning = steam.isAppRunning(Number(appId));

        // Determine composite options based on manifest state AND running state
        let compositeOptions = null;

        if (isRunning) {
          // If running, show green border (highest priority)
          compositeOptions = { border: { color: "#00ff00", width: 6 } };
        } else if (app) {
          // Otherwise check manifest state flags
          compositeOptions = getCompositeOptionsFromStateFlags(app.stateFlags);
        }

        if (compositeOptions) {
          iconBase64 = compositeAppIcon(iconBase64, compositeOptions);
        }

        await action.setImage(iconBase64);
      }
    } catch (error) {
      streamDeck.logger.error(`[App] Failed to update app icon: ${error}`);
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

      // Set the app icon (with state-based effects including running state)
      await this.updateAppIcon(ev.action, payload.id);
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
