import streamDeck from "@elgato/streamdeck";
import { Steam } from "./steam";

let steamInstance: Steam | null = null;
let steamPromise: Promise<Steam> | null = null;

/**
 * Get the shared Steam instance, creating it if it doesn't exist.
 * This ensures Steam is initialized only once across the entire plugin,
 * even if called multiple times simultaneously.
 */
export async function getSteam(): Promise<Steam> {
  if (steamInstance) {
    return steamInstance;
  }

  if (steamPromise) {
    return await steamPromise;
  }

  steamPromise = Steam.create();
  steamInstance = await steamPromise;
  steamPromise = null; // Clear the promise after completion

  return steamInstance;
}

/**
 * Reset the Steam singleton (dev function - for testing)
 */
export function resetSteam(): void {
  steamInstance = null;
  steamPromise = null;
}

/**
 * Sync plugin global settings with current Steam state.
 * Merges provided overrides with existing settings and updates lastUpdated timestamp.
 */
export async function syncGlobalSettings(
  overrides?: Partial<PluginGlobalSettings>,
): Promise<void> {
  const currentSettings =
    await streamDeck.settings.getGlobalSettings<PluginGlobalSettings>();

  const updatedSettings: PluginGlobalSettings = {
    ...currentSettings,
    ...overrides,
    lastUpdated: new Date().toISOString(),
  };

  await streamDeck.settings.setGlobalSettings(updatedSettings);
}
