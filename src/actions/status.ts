import { action, KeyDownEvent, KeyUpEvent, SingletonAction, WillAppearEvent, streamDeck } from "@elgato/streamdeck";
import { getSteam } from "../services/steam-singleton";

type StatusSettings = {
  targetStatus?: SteamFriendStatus;
};

/**
 * Set Steam friend status.
 */
@action({ UUID: "com.humhunch.superior-steam.status" })
export class Status extends SingletonAction<StatusSettings> {
  override async onWillAppear(ev: WillAppearEvent<StatusSettings>): Promise<void> {
    const settings = await ev.action.getSettings();
    const targetStatus = settings.targetStatus || "online";

    await ev.action.setTitle(this.formatStatus(targetStatus));
  }

  override async onKeyDown(ev: KeyDownEvent<StatusSettings>): Promise<void> {
    const steam = await getSteam();
    const settings = await ev.action.getSettings();
    const targetStatus = settings.targetStatus || "online";

    streamDeck.logger.info(`[Status] Setting friend status to: ${targetStatus}`);
    steam.setFriendStatus(targetStatus);
    await ev.action.setTitle(this.formatStatus(targetStatus));
  }

  private formatStatus(status: string): string {
    return status.charAt(0).toUpperCase() + status.slice(1);
  }
}
