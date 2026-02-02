import fs from "fs/promises";
import path from "path";
import open, { openApp } from "open";
import streamDeck from "@elgato/streamdeck";
import * as VDF from "@node-steam/vdf";
import decodeIco from "decode-ico";
import UPNG from "upng-js";

import { PowerShell } from "./powershell";

import { SteamCMD } from "./steam-cmd";

class SteamUserRegistry {
  private static readonly debugPrefix = "[SteamUserRegistry]";

  // Init
  private constructor(
    private _steamExe: string,
    private _steamPath: string,
    private _autoLoginUser: string,
  ) {}

  static async create(): Promise<SteamUserRegistry> {
    streamDeck.logger.debug(
      `${SteamUserRegistry.debugPrefix} Creating instance...`,
    );

    const powershell = new PowerShell();
    const registry = await powershell.readRegistryEntry({
      path: "HKCU:\\Software\\Valve\\Steam",
      properties: ["SteamExe", "SteamPath", "AutoLoginUser"],
    });

    if (Array.isArray(registry) || !registry || typeof registry !== "object") {
      throw new Error("Registry entry not found or invalid");
    }

    return new SteamUserRegistry(
      path.normalize((registry as any).SteamExe ?? ""),
      path.normalize((registry as any).SteamPath ?? ""),
      (registry as any).AutoLoginUser ?? "",
    );
  }

  // Getters
  get steamExe(): string {
    return this._steamExe;
  }

  get steamPath(): string {
    return this._steamPath;
  }

  get autoLoginUser(): string {
    return this._autoLoginUser;
  }
}

class SteamLibrary {
  private static readonly debugPrefix = "[SteamLibrary]";

  // Apps to exclude from installed apps list
  private static readonly appExceptions = new Set<number>([
    228980, // Steamworks Common Redistributables
  ]);

  // Icons to skip (no proper icon available)
  private static readonly iconExceptions = new Set([
    "SteamMovie", // Not a game icon
  ]);

  private _folders: SteamLibraryFolders[] = [];
  private _installedApps: SteamApp[] = [];
  private _steamPath: string = "";
  private _steam_cmd: SteamCMD;

  // Init
  private constructor(api: SteamCMD) {
    this._steam_cmd = api;
  }

  static async create(steamPath: string, api: SteamCMD): Promise<SteamLibrary> {
    streamDeck.logger.debug(`${SteamLibrary.debugPrefix} Creating instance...`);

    const library = new SteamLibrary(api);
    await library.initialize(steamPath);

    return library;
  }

  private async initialize(steamPath: string): Promise<void> {
    this._steamPath = steamPath;
    this._folders = await this.parseLibraryVDF(steamPath);
    this._installedApps = await this.parseGameVDF(this._folders);
  }

  // Getters
  get libraryFolders(): SteamLibraryFolders[] {
    return this._folders;
  }

  get installedApps(): SteamApp[] {
    return this._installedApps.filter(
      (app) => !SteamLibrary.appExceptions.has(app.id),
    );
  }

  async getAppIconBase64(appId: string): Promise<string | null> {
    try {
      // Get clienticon hash from API
      const app = await this._steam_cmd.getApp(appId);
      const clientIconHash = app?.common.clienticon;
      if (!clientIconHash) {
        return null;
      }

      // Skip known problematic icons
      if (SteamLibrary.iconExceptions.has(clientIconHash)) {
        streamDeck.logger.debug(
          `${SteamLibrary.debugPrefix} Skipping icon ${clientIconHash} (in exception list)`,
        );
        return null;
      }

      // Read .ico from local Steam folder
      const icoPath = path.join(
        this._steamPath,
        "steam",
        "games",
        `${clientIconHash}.ico`,
      );

      streamDeck.logger.debug(
        `${SteamLibrary.debugPrefix} Reading icon from: ${icoPath}`,
      );

      const icoBuffer = await fs.readFile(icoPath);

      // Decode ICO and find the largest image
      const images = decodeIco(new Uint8Array(icoBuffer));

      if (images.length === 0) {
        streamDeck.logger.warn(
          `${SteamLibrary.debugPrefix} No icons found for app ${appId}`,
        );
        return null;
      }

      // Find the largest image (prefer PNG, but accept BMP)
      const largest = images.reduce((max, img) =>
        img.width > max.width ? img : max,
      );

      streamDeck.logger.debug(
        `${SteamLibrary.debugPrefix} Using ${largest.width}x${largest.height} ${largest.type.toUpperCase()} icon`,
      );

      let pngData: Uint8Array;
      if (largest.type === "png") {
        // PNG data is already encoded
        pngData = largest.data;
      } else {
        // BMP data is raw RGBA pixels - encode to PNG
        const rgba = new Uint8Array(largest.data);
        const encoded = UPNG.encode(
          [rgba.buffer],
          largest.width,
          largest.height,
          0,
        );
        pngData = new Uint8Array(encoded);
      }

      const base64 = Buffer.from(pngData).toString("base64");
      return `data:image/png;base64,${base64}`;
    } catch (error) {
      streamDeck.logger.error(
        `${SteamLibrary.debugPrefix} Error getting app icon: ${error}`,
      );
      return null;
    }
  }

  private async parseLibraryVDF(
    steamPath: string,
  ): Promise<SteamLibraryFolders[]> {
    const libraryFolders: SteamLibraryFolders[] = [];
    const vdfPath = path.join(steamPath, "steamapps", "libraryfolders.vdf");

    streamDeck.logger.trace(
      `${SteamLibrary.debugPrefix} Library config path: ${vdfPath}`,
    );

    const vdfFileContent = await fs.readFile(vdfPath, "utf-8");
    const parsedContent = VDF.parse(vdfFileContent) as Object;

    // Parse VDF structure to extract library folders
    const libraryData = (parsedContent as any).libraryfolders || parsedContent;
    for (const [key, value] of Object.entries(libraryData)) {
      if (typeof value === "object" && value !== null && "path" in value) {
        const libraryEntry = value as any;
        const folder: SteamLibraryFolders = {
          path: path.join(libraryEntry.path, "steamapps"),
          contentid: String(libraryEntry.contentid || ""),
          totalsize: String(libraryEntry.totalsize || "0"),
          apps: libraryEntry.apps ? Object.keys(libraryEntry.apps) : [],
        };
        libraryFolders.push(folder);
      }
    }
    streamDeck.logger.debug(
      `${SteamLibrary.debugPrefix} Found ${libraryFolders.length} library folders`,
    );
    return libraryFolders;
  }

  /**
   * Parse game configurations from all library folders
   */
  private async parseGameVDF(
    folders: SteamLibraryFolders[],
  ): Promise<SteamApp[]> {
    const apps: SteamApp[] = [];

    for (const folder of folders) {
      let manifestFiles: string[] = [];
      const files = await fs.readdir(folder.path);
      manifestFiles = files.filter((file) => path.extname(file) === ".acf");

      streamDeck.logger.debug(
        `${SteamLibrary.debugPrefix} Found ${manifestFiles.length} manifests in ${folder.path}`,
      );

      // Parse all manifests in parallel for performance
      const gamePromises = manifestFiles.map(async (manifest) => {
        let vdfContent: string = "";
        const manifestPath = path.join(folder.path, manifest);

        vdfContent = await fs.readFile(manifestPath, "utf-8");
        const parsedContent = VDF.parse(String(vdfContent)) as any;

        // Parse VDF structure to extract game data
        const gameData = (parsedContent as any).AppState || parsedContent;

        const game: SteamApp = {
          id: Number(gameData.appid) || 0,
          name: gameData.name || "",
          installDir: gameData.installdir || "",
          stateFlags: Number(gameData.StateFlags) || 0,
        };

        return game;
      });

      const parsedApps = await Promise.all(gamePromises);
      apps.push(...parsedApps);
    }

    streamDeck.logger.debug(
      `${SteamLibrary.debugPrefix} Total apps found: ${apps.length}`,
    );
    return apps;
  }
}

class SteamProtocol {
  private static readonly debugPrefix = "[SteamProtocol]";
  private powershell: PowerShell;
  private steamExe: string;

  // Init
  private constructor(powershell: PowerShell, steamExe: string) {
    this.powershell = powershell;
    this.steamExe = steamExe;
  }

  static async create(steamExe: string): Promise<SteamProtocol> {
    streamDeck.logger.debug(
      `${SteamProtocol.debugPrefix} Creating instance...`,
    );

    return new SteamProtocol(new PowerShell(), steamExe);
  }

  // Steam control
  async startSteam(accountName?: string): Promise<void> {
    if (accountName) {
      streamDeck.logger.info(
        `${SteamProtocol.debugPrefix} Starting Steam as user '${accountName}'...`,
      );

      const steamRunning = await this.isSteamRunning();
      streamDeck.logger.info(
        `${SteamProtocol.debugPrefix} Steam status: ${steamRunning}`,
      );

      if (steamRunning) {
        this.exitSteam();
        const exited = await this.waitForSteamExit(3000); // TO DO: MAKE TIMEOUT CONFIGURABLE

        if (!exited) {
          streamDeck.logger.error(
            `${SteamProtocol.debugPrefix} Steam failed to stop...`,
          );
          return;
        }
      }

      await openApp(this.steamExe, { arguments: ["-login", accountName] });
    } else {
      streamDeck.logger.info(`${SteamProtocol.debugPrefix} Starting Steam...`);
      await open(this.steamExe, { wait: false });
    }
  }

  exitSteam(): void {
    streamDeck.logger.info(`${SteamProtocol.debugPrefix} Exiting Steam...`);
    open("steam://exit");
  }

  // Big Picture
  async launchBigPicture(): Promise<boolean> {
    streamDeck.logger.debug(
      `${SteamProtocol.debugPrefix} Launching Big Picture mode...`,
    );
    await open("steam://open/bigpicture");

    // Wait and verify launch
    await new Promise((resolve) => setTimeout(resolve, 500));
    const isRunning = await this.isBigPictureRunning();

    if (!isRunning) {
      streamDeck.logger.warn(
        `${SteamProtocol.debugPrefix} Big Picture launch command sent, but verification failed`,
      );
      return false;
    }

    return true;
  }

  exitBigPicture(): void {
    streamDeck.logger.debug(
      `${SteamProtocol.debugPrefix} Exiting Big Picture mode...`,
    );
    open("steam://close/bigpicture");
  }

  async isBigPictureRunning(): Promise<boolean> {
    const processes = await this.powershell.getProcess({
      name: "*steam**",
      filter: "$_.MainWindowTitle -like '*big picture*'",
      properties: ["Name", "ProcessName", "MainWindowTitle"],
    });
    return processes.length > 0;
  }

  private async isSteamRunning(): Promise<boolean> {
    const processes = await this.powershell.getProcess({
      name: "*steam*",
      properties: ["Name"],
    });
    return processes.length > 0;
  }

  // Friends and status
  setFriendStatus(status: SteamFriendStatus): void {
    open(`steam://friends/status/${status}`);
  }

  openFriendsList(): void {
    open(`steam://open/friends`);
  }

  // App actions
  launchApp(id: string, params?: string): void {
    const url = params
      ? `steam://launch/${id}//${params}`
      : `steam://launch/${id}`;
    open(url);
  }

  openAppNews(id: string): void {
    open(`steam://appnews/${id}`);
  }

  openAppProperties(id: string): void {
    open(`steam://gameproperties/${id}`);
  }

  openAppStore(id: string): void {
    open(`steam://store/${id}`);
  }

  openAppCommunity(id: string): void {
    open(`steam://url/GameHub/${id}`);
  }

  validateApp(id: string): void {
    open(`steam://validate/${id}`);
  }

  // Helpers
  private async waitForSteamExit(timeoutMs: number): Promise<boolean> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const steamRunning = await this.isSteamRunning();

      if (!steamRunning) {
        return true;
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return false;
  }
}

class SteamUsers {
  private static readonly debugPrefix = "[SteamUsers]";

  private _loggedInUsers: SteamUser[] = [];

  // Init
  private constructor() {}

  static async create(steamPath: string): Promise<SteamUsers> {
    streamDeck.logger.debug(`${SteamUsers.debugPrefix} Creating instance...`);

    const users = new SteamUsers();
    await users.initialize(steamPath);

    return users;
  }

  get loggedInUsers(): SteamUser[] {
    return this._loggedInUsers;
  }

  private async initialize(steamPath: string): Promise<void> {
    this._loggedInUsers = await this.parseUsersVDF(steamPath);
  }

  private async getUserAvatar(
    steamPath: string,
    steamId64: string,
  ): Promise<string> {
    let base64: string = "";

    const avatarPath = path.join(
      steamPath,
      "config",
      "avatarcache",
      `${steamId64}.png`,
    );
    base64 = await fs.readFile(avatarPath, "base64");

    return `data:image/png;base64,${base64}`;
  }

  private async parseUsersVDF(steamPath: string): Promise<SteamUser[]> {
    let loggedInUsers: SteamUser[] = [];
    let vdfFileContent: string = "";

    const vdfPath = path.join(steamPath, "config", "loginusers.vdf");
    streamDeck.logger.debug(
      `${SteamUsers.debugPrefix} Config path: ${vdfPath}`,
    );

    try {
      vdfFileContent = await fs.readFile(vdfPath, "utf-8");
    } catch (error) {
      streamDeck.logger.error(
        `${SteamUsers.debugPrefix} Failed to read: ${vdfPath}`,
      );
      return [];
    }

    const parsedContent = VDF.parse(vdfFileContent) as Object;
    const usersData = (parsedContent as any).users || parsedContent;

    const userPromises = Object.entries(usersData).map(
      async ([steamId64, value]) => {
        const entry = value as any;
        return {
          steamId64: steamId64,
          accountName: entry.AccountName || "",
          personaName: entry.PersonaName || "",
          avatarBase64: await this.getUserAvatar(steamPath, steamId64),
        };
      },
    );

    loggedInUsers = await Promise.all(userPromises);
    return loggedInUsers;
  }
}

export class Steam {
  private static readonly debugPrefix = "[Steam]";

  private registry: SteamUserRegistry;
  private library: SteamLibrary;
  private users: SteamUsers;
  private protocol: SteamProtocol;
  private api: SteamCMD;

  // Init
  private constructor(
    registry: SteamUserRegistry,
    library: SteamLibrary,
    users: SteamUsers,
    protocol: SteamProtocol,
    api: SteamCMD,
  ) {
    this.registry = registry;
    this.library = library;
    this.users = users;
    this.protocol = protocol;
    this.api = api;
  }

  static async create(): Promise<Steam> {
    streamDeck.logger.debug(`${Steam.debugPrefix} Creating instance...`);

    const registry = await SteamUserRegistry.create();
    const api = new SteamCMD();
    const library = await SteamLibrary.create(registry.steamPath, api);
    const users = await SteamUsers.create(registry.steamPath);
    const protocol = await SteamProtocol.create(registry.steamExe);

    return new Steam(registry, library, users, protocol, api);
  }

  // Registry
  getSteamPath(): string {
    return this.registry.steamPath;
  }

  getSteamExe(): string {
    return this.registry.steamExe;
  }

  getAutoLoginUser(): string {
    return this.registry.autoLoginUser;
  }

  // Library
  getLibraryFolders(): SteamLibraryFolders[] {
    return this.library.libraryFolders;
  }

  getInstalledApps(): SteamApp[] {
    return this.library.installedApps;
  }

  // Users
  getLoggedInUsers(): SteamUser[] {
    return this.users.loggedInUsers;
  }

  // Steam control
  async startSteam(accountName?: string): Promise<void> {
    this.protocol.startSteam(accountName);
  }

  exitSteam(): void {
    this.protocol.exitSteam();
  }

  // Big Picture
  async isBigPictureRunning(): Promise<boolean> {
    return this.protocol.isBigPictureRunning();
  }

  async launchBigPicture(): Promise<boolean> {
    return this.protocol.launchBigPicture();
  }

  exitBigPicture(): void {
    this.protocol.exitBigPicture();
  }

  // Friends and status
  setFriendStatus(status: SteamFriendStatus): void {
    this.protocol.setFriendStatus(status);
  }

  openFriendsList(): void {
    this.protocol.openFriendsList();
  }

  launchApp(id: string, params?: string): void {
    this.protocol.launchApp(id, params);
  }

  openAppNews(id: string): void {
    this.protocol.openAppNews(id);
  }

  openAppProperties(id: string): void {
    this.protocol.openAppProperties(id);
  }

  openAppStore(id: string): void {
    this.protocol.openAppStore(id);
  }

  openAppCommunity(id: string): void {
    this.protocol.openAppCommunity(id);
  }

  validateApp(id: string): void {
    this.protocol.validateApp(id);
  }

  // Library - Icons
  async getAppIconBase64(appId: string): Promise<string | null> {
    return this.library.getAppIconBase64(appId);
  }

  // Library - App lookup
  getAppById(appId: string): SteamApp | undefined {
    return this.library.installedApps.find((a) => a.id.toString() === appId);
  }
}
