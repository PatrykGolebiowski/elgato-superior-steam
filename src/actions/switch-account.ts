import streamDeck, { action, KeyDownEvent, SingletonAction, JsonValue, DidReceiveSettingsEvent, SendToPluginEvent } from "@elgato/streamdeck";
import { DataSourcePayload, DataSourceResult } from "../types/sdpi";
import { getSteam } from "../services/steam-singleton";

type Settings = {
  accountName: string;
  personaName: string;
};

/**
 * Switch Steam to a different user account.
 */
@action({ UUID: "com.humhunch.superior-steam.switch-account" })
export class SwitchAccount extends SingletonAction<Settings> {
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
        await ev.action.setImage(user.avatarBase64);
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
      streamDeck.logger.info(`[SwitchAccount] Switching to account: ${settings.personaName} (${settings.accountName})`);
      await steam.startSteam(settings.accountName);
    } else {
      streamDeck.logger.warn(`[SwitchAccount] No account selected`);
    }
  }
}
