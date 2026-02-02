import streamDeck from "@elgato/streamdeck";
import path from "path";
import { PowerShell } from "./powershell";
import { SteamCMD } from "./steam-cmd";

export type RunningAppChangeCallback = (appId: number, isRunning: boolean) => void;

export class SteamMonitor {
  private static readonly debugPrefix = "[SteamMonitor]";
  private static readonly POLL_INTERVAL_MS = 3000; // Poll every 3 seconds

  private powershell: PowerShell;
  private steamCmd: SteamCMD;
  private installedApps: SteamApp[];
  private libraryFolders: SteamLibraryFolders[];
  private intervalId?: NodeJS.Timeout;
  private runningAppIds = new Set<number>();
  private changeCallbacks: RunningAppChangeCallback[] = [];
  private executableCache = new Map<number, string[]>(); // appId -> executable names

  // Init
  constructor(installedApps: SteamApp[], libraryFolders: SteamLibraryFolders[], steamCmd: SteamCMD) {
    this.powershell = new PowerShell();
    this.steamCmd = steamCmd;
    this.installedApps = installedApps;
    this.libraryFolders = libraryFolders;
    streamDeck.logger.debug(`${SteamMonitor.debugPrefix} Created instance`);
  }

  // Monitoring control
  start(): void {
    if (this.intervalId) {
      streamDeck.logger.warn(
        `${SteamMonitor.debugPrefix} Already running, ignoring start()`,
      );
      return;
    }

    streamDeck.logger.info(`${SteamMonitor.debugPrefix} Starting monitor...`);

    // Run initial check immediately
    this.checkRunningApps();

    // Then poll periodically
    this.intervalId = setInterval(() => {
      this.checkRunningApps();
    }, SteamMonitor.POLL_INTERVAL_MS);
  }

  stop(): void {
    if (this.intervalId) {
      streamDeck.logger.info(`${SteamMonitor.debugPrefix} Stopping monitor...`);
      clearInterval(this.intervalId);
      this.intervalId = undefined;
      this.runningAppIds.clear();
    }
  }

  // Subscribe to app state changes
  onAppStateChange(callback: RunningAppChangeCallback): void {
    this.changeCallbacks.push(callback);
  }

  // Check if specific app is running
  isAppRunning(appId: number): boolean {
    return this.runningAppIds.has(appId);
  }

  // Get all currently running app IDs
  getRunningAppIds(): number[] {
    return Array.from(this.runningAppIds);
  }

  // Core detection logic - hybrid approach
  private async checkRunningApps(): Promise<void> {
    try {
      const newRunningAppIds = await this.detectRunningApps();

      // Detect changes and notify callbacks
      const previousIds = this.runningAppIds;

      // Find newly started apps
      for (const appId of newRunningAppIds) {
        if (!previousIds.has(appId)) {
          streamDeck.logger.info(
            `${SteamMonitor.debugPrefix} App started: ${appId}`,
          );
          this.notifyCallbacks(appId, true);
        }
      }

      // Find stopped apps
      for (const appId of previousIds) {
        if (!newRunningAppIds.has(appId)) {
          streamDeck.logger.info(
            `${SteamMonitor.debugPrefix} App stopped: ${appId}`,
          );
          this.notifyCallbacks(appId, false);
        }
      }

      this.runningAppIds = newRunningAppIds;
    } catch (error) {
      streamDeck.logger.error(
        `${SteamMonitor.debugPrefix} Error checking running apps: ${error}`,
      );
    }
  }

  private async detectRunningApps(): Promise<Set<number>> {
    const runningAppIds = new Set<number>();

    try {
      // Optimized approach: Only check GameOverlay processes + targeted fallback

      // Step 1: Check processes with GameOverlay DLLs (most games)
      const overlayProcesses = await this.powershell.getProcess({
        name: "*",
        filter:
          "$_.Modules.ModuleName -contains 'GameOverlayRenderer.dll' -or $_.Modules.ModuleName -contains 'GameOverlayRenderer64.dll'",
        properties: ["Path"],
      });

      streamDeck.logger.debug(
        `${SteamMonitor.debugPrefix} Found ${overlayProcesses.length} processes with GameOverlay`,
      );

      // Match overlay processes against installed apps
      for (const app of this.installedApps) {
        const possiblePaths = this.getAppPaths(app);

        const isRunning = overlayProcesses.some((proc) => {
          if (!proc.Path) return false;
          const processPath = proc.Path.toLowerCase();
          return possiblePaths.some((path) =>
            processPath.includes(path.toLowerCase()),
          );
        });

        if (isRunning) {
          runningAppIds.add(app.id);
        }
      }

      // Step 2: For apps not found via overlay, check specific process names
      // This handles overlay-disabled games (disabled by default to reduce noise)
      // Most games will be caught by GameOverlay detection above

      // Note: This fallback is currently disabled to avoid API spam and log noise.
      // Only GameOverlay detection is active. To enable fallback for specific apps,
      // uncomment the code below and consider adding a whitelist of app IDs.

      /*
      const appsToCheck = this.installedApps.filter(
        (app) => !runningAppIds.has(app.id)
      );

      if (appsToCheck.length > 0) {
        // Query only processes using executable names from SteamCMD
        for (const app of appsToCheck) {
          // Get executable names from cache or fetch from SteamCMD
          const executableNames = await this.getAppExecutables(app.id);

          if (executableNames.length === 0) {
            continue; // No executable info available
          }

          for (const exeName of executableNames) {
            // Extract just the filename from path (e.g., "game/cs2.sh" -> "cs2.sh")
            const filename = path.basename(exeName);

            // Remove extension for Get-Process query (e.g., "cs2.sh" -> "cs2")
            const processName = filename.replace(/\.(exe|sh)$/i, '');

            try {
              const processes = await this.powershell.getProcess({
                name: processName,
                properties: ["Path"],
              });

              if (processes.length > 0) {
                // Verify the process is in a Steam library folder
                const possiblePaths = this.getAppPaths(app);
                const matchesPath = processes.some((proc) => {
                  if (!proc.Path) return false;
                  const processPath = proc.Path.toLowerCase();
                  return possiblePaths.some((path) =>
                    processPath.includes(path.toLowerCase()),
                  );
                });

                if (matchesPath) {
                  runningAppIds.add(app.id);
                  break; // Found it, move to next app
                }
              }
            } catch {
              // Process not running, this is expected - continue silently
            }
          }
        }
      }
      */

      streamDeck.logger.debug(
        `${SteamMonitor.debugPrefix} Detected ${runningAppIds.size} running apps`,
      );
    } catch (error) {
      streamDeck.logger.error(
        `${SteamMonitor.debugPrefix} Error detecting apps: ${error}`,
      );
    }

    return runningAppIds;
  }

  private async getAppExecutables(appId: number): Promise<string[]> {
    // Check cache first
    if (this.executableCache.has(appId)) {
      return this.executableCache.get(appId)!;
    }

    // Fetch from SteamCMD API
    try {
      const appData = await this.steamCmd.getApp(appId.toString());

      if (!appData?.config?.launch) {
        streamDeck.logger.debug(
          `${SteamMonitor.debugPrefix} No launch config for app ${appId}`,
        );
        this.executableCache.set(appId, []);
        return [];
      }

      // Extract all executable names from launch configs
      const executables: string[] = [];
      for (const key in appData.config.launch) {
        const launchConfig = appData.config.launch[key];
        if (launchConfig.executable) {
          executables.push(launchConfig.executable);
        }
      }

      streamDeck.logger.debug(
        `${SteamMonitor.debugPrefix} Found executables for app ${appId}: ${executables.join(", ")}`,
      );

      // Cache the result
      this.executableCache.set(appId, executables);
      return executables;
    } catch (error) {
      streamDeck.logger.debug(
        `${SteamMonitor.debugPrefix} Failed to get executables for app ${appId}: ${error}`,
      );
      this.executableCache.set(appId, []);
      return [];
    }
  }

  private getAppPaths(app: SteamApp): string[] {
    const paths: string[] = [];

    // Add install directory name (most reliable)
    if (app.installDir) {
      paths.push(app.installDir);

      // Also try common\<installDir>
      paths.push(path.join("common", app.installDir));

      // Try full paths from each library folder
      for (const folder of this.libraryFolders) {
        const fullPath = path.join(folder.path, "common", app.installDir);
        paths.push(fullPath);
      }
    }

    return paths;
  }

  private notifyCallbacks(appId: number, isRunning: boolean): void {
    for (const callback of this.changeCallbacks) {
      try {
        callback(appId, isRunning);
      } catch (error) {
        streamDeck.logger.error(
          `${SteamMonitor.debugPrefix} Error in callback: ${error}`,
        );
      }
    }
  }
}
