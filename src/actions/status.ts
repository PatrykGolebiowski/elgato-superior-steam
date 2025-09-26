import { action, KeyDownEvent, KeyUpEvent, SingletonAction, WillAppearEvent, streamDeck } from "@elgato/streamdeck";
import { getSteam } from "../services/steam-singleton";

type StatusSettings = {
  currentStatus?: SteamFriendStatus;
};

/**
 * Toggle Steam friend status.
 */
@action({ UUID: "com.humhunch.superior-steam.status" })
export class Status extends SingletonAction {
  private statusOrder: SteamFriendStatus[] = ["online", "away", "invisible", "offline"];

  override async onWillAppear(ev: WillAppearEvent<StatusSettings>): Promise<void> {
    const settings = await ev.action.getSettings();
    const currentStatus = settings.currentStatus || "online";

    await ev.action.setTitle(this.formatStatus(currentStatus));
  }

  override async onKeyDown(ev: KeyDownEvent<StatusSettings>): Promise<void> {
    const steam = await getSteam();

    const settings = await ev.action.getSettings();
    const currentStatus = settings.currentStatus || "online";

    // Get next status in cycle
    const currentIndex = this.statusOrder.indexOf(currentStatus);
    const nextStatus = this.statusOrder[(currentIndex + 1) % this.statusOrder.length];

    steam.setFriendStatus(nextStatus);
    await ev.action.setSettings({ currentStatus: nextStatus });
    await ev.action.setTitle(this.formatStatus(nextStatus));
  }

  private formatStatus(status: string): string {
    return status.charAt(0).toUpperCase() + status.slice(1);
  }
}
