import { action, KeyDownEvent, KeyUpEvent, SingletonAction, WillAppearEvent } from "@elgato/streamdeck";
import { getSteam } from "../services/steam-singleton";

/**
 * Enable/disable steam's Big Picture mode.
 */
@action({ UUID: "com.humhunch.superior-steam.big-picture" })
export class BigPicture extends SingletonAction {
  override async onWillAppear(ev: WillAppearEvent): Promise<void> {
    const steam = await getSteam();
    const isRunning = await steam.isBigPictureRunning();
    return ev.action.setTitle(isRunning ? "BP: ON" : "BP: OFF");
  }

  override async onKeyDown(ev: KeyDownEvent): Promise<void> {
    const steam = await getSteam();
    const isBigPicture = await steam.isBigPictureRunning();

    if (!isBigPicture) {
      const success = await steam.launchBigPicture();
      await ev.action.setTitle(success ? "BP: ON" : "BP: FAIL");
    } else {
      steam.exitBigPicture();
      await ev.action.setTitle("BP: OFF");
    }
  }
}
