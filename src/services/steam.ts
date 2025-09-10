import streamDeck from "@elgato/streamdeck";
import { exec } from "child_process";
import { promisify } from "util";

export class Steam {
  private execAsync = promisify(exec);

  async openBigPicture(): Promise<void> {
    streamDeck.logger.info("Launching Steam Big Picture mode...");
    try {
      await this.execAsync(`start steam://open/bigpicture`);
      streamDeck.logger.info("Big Picture mode launched.");
    } catch (error) {
      streamDeck.logger.error(`Failed to launch Big Picture:`, error);
    }
  }

  async closeBigPicture(): Promise<void> {
    streamDeck.logger.info("Exiting Steam Big Picture mode...");
    try {
      await this.execAsync(`start steam://close/bigpicture`);
      streamDeck.logger.info("Exited Big Picture mode.");
    } catch (error) {
      streamDeck.logger.error(`Failed to exit Big Picture:`, error);
    }
  }

  // Future methods for other Steam functions
  // async launchGame(gameId: string): Promise<void> { }
  // async getPlayerStats(): Promise<any> { }
}
