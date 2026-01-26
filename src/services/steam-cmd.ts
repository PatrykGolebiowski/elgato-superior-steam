import streamDeck from "@elgato/streamdeck";
import { SteamCmdResponse, SteamCmdApp } from "../types/steam-cmd.d";

export class SteamCMD {
  private static readonly debugPrefix = "[SteamCMD]";
  private static readonly steamCmdApiUrl = "https://api.steamcmd.net/v1/info";

  async getApp(appId: string): Promise<SteamCmdApp | null> {
    try {
      streamDeck.logger.debug(
        `${SteamCMD.debugPrefix} Fetching app info for app ${appId}`,
      );

      const response = await fetch(`${SteamCMD.steamCmdApiUrl}/${appId}`);
      if (!response.ok) {
        streamDeck.logger.warn(
          `${SteamCMD.debugPrefix} Failed to fetch app info: ${response.status}`,
        );
        return null;
      }

      const data = (await response.json()) as SteamCmdResponse;

      if (data.status !== "success") {
        streamDeck.logger.warn(
          `${SteamCMD.debugPrefix} API request was not successful: ${data.status}`,
        );
        return null;
      }

      const app = data?.data?.[appId];
      if (!app) {
        streamDeck.logger.warn(
          `${SteamCMD.debugPrefix} No app data found for app ${appId}`,
        );
        return null;
      }

      return app;
    } catch (error) {
      streamDeck.logger.error(
        `${SteamCMD.debugPrefix} Error fetching app info: ${error}`,
      );
      return null;
    }
  }
}
