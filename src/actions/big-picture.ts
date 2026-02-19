import { action, KeyDownEvent, SingletonAction, WillAppearEvent } from "@elgato/streamdeck";
import { getSteam } from "../services/steam-singleton";

/**
 * Enable/disable steam's Big Picture mode.
 */
@action({ UUID: "com.humhunch.superior-steam.big-picture" })
export class BigPicture extends SingletonAction {
  override async onWillAppear(ev: WillAppearEvent): Promise<void> {
    if (!ev.action.isKey()) return;
    const steam = await getSteam();
    const isRunning = await steam.isBigPictureRunning();
    await ev.action.setState(isRunning ? 1 : 0);
  }

  override async onKeyDown(ev: KeyDownEvent): Promise<void> {
    if (!ev.action.isKey()) return;
    const steam = await getSteam();
    const isBigPicture = await steam.isBigPictureRunning();

    if (!isBigPicture) {
      const success = await steam.launchBigPicture();
      await ev.action.setState(success ? 1 : 0);
    } else {
      steam.exitBigPicture();
      await ev.action.setState(0);
    }
  }
}
