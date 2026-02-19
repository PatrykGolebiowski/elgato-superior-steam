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
import { compositeAppIcon } from "../services/image-compositor";

type Settings = {
  accountName: string;
  personaName: string;
};

/**
 * Launch Steam with a specific user account.
 */
@action({ UUID: "com.humhunch.superior-steam.launch-account" })
export class LaunchAccount extends SingletonAction<Settings> {
  private applyGrayscaleIfNeeded(avatarBase64: string, steamRunning: boolean): string {
    if (!steamRunning) {
      return compositeAppIcon(avatarBase64, { grayscale: true });
    }
    return avatarBase64;
  }

  override async onWillAppear(ev: WillAppearEvent<Settings>): Promise<void> {
    const payload = ev.payload.settings;

    // Restore the avatar image when action appears
    if (payload.accountName) {
      const steam = await getSteam();
      const user = steam.getLoggedInUsers().find((user) => user.accountName === payload.accountName);

      if (user) {
        const globalSettings = await streamDeck.settings.getGlobalSettings<PluginGlobalSettings>();
        const steamRunning = globalSettings.steamRunning ?? true;
        await ev.action.setImage(this.applyGrayscaleIfNeeded(user.avatarBase64, steamRunning));
      }
    }
  }

  override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<Settings>): Promise<void> {
    const payload = ev.payload.settings;

    // Look up and store the persona name when account name changes
    if (payload.accountName) {
      const steam = await getSteam();
      const user = steam.getLoggedInUsers().find((user) => user.accountName === payload.accountName);

      if (user) {
        // Update persona name if different
        if (payload.personaName !== user.personaName) {
          await ev.action.setSettings({ ...payload, personaName: user.personaName });
        }

        // Set the avatar image
        const globalSettings = await streamDeck.settings.getGlobalSettings<PluginGlobalSettings>();
        const steamRunning = globalSettings.steamRunning ?? true;
        await ev.action.setImage(this.applyGrayscaleIfNeeded(user.avatarBase64, steamRunning));
      }
    }
  }

  /**
   * Refresh all visible LaunchAccount action icons to reflect the current Steam running state.
   */
  async refresh(steamRunning: boolean): Promise<void> {
    const steam = await getSteam();
    for (const action of this.actions) {
      const settings = await action.getSettings();
      if (!settings.accountName) continue;
      const user = steam.getLoggedInUsers().find((u) => u.accountName === settings.accountName);
      if (user) {
        await action.setImage(this.applyGrayscaleIfNeeded(user.avatarBase64, steamRunning));
      }
    }
  }

  override async onSendToPlugin(ev: SendToPluginEvent<JsonValue, Settings>): Promise<void> {
    // Handle datasource requests
    if (ev.payload instanceof Object && "event" in ev.payload && ev.payload.event === "steamUsers") {
      const steam = await getSteam();
      const items: DataSourceResult = steam.getLoggedInUsers().map((user) => ({
        value: user.accountName,
        label: `${user.personaName}`,
      }));

      streamDeck.ui.current?.sendToPropertyInspector({
        event: "steamUsers",
        items,
      } satisfies DataSourcePayload);
    }
  }

  override async onKeyDown(ev: KeyDownEvent<Settings>): Promise<void> {
    const steam = await getSteam();
    const settings = ev.payload.settings;

    if (settings.accountName) {
      streamDeck.logger.info(`[LaunchAccount] Launching Steam with account: ${settings.personaName} (${settings.accountName})`);
      await steam.startSteam(settings.accountName);
    } else {
      streamDeck.logger.warn(`[LaunchAccount] No account selected`);
    }
  }
}
