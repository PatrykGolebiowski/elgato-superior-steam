import fs from "fs/promises";
import path from "path";
import streamDeck from "@elgato/streamdeck";
import * as VDF from "@node-steam/vdf";

import { PowerShell } from "./powershell";

class SteamUserRegistry {
  private static readonly debugPrefix = "[SteamUserRegistry]";

  // Init
  private constructor(private _steamExe: string, private _steamPath: string, private _autoLoginUser: string) {}

  static async create(): Promise<SteamUserRegistry> {
    streamDeck.logger.debug(`${SteamUserRegistry.debugPrefix} Creating instance...`);

    const powershell = new PowerShell();
    const registry = await powershell.readRegistryEntry({
      path: "HKCU:\\Software\\Valve\\Steam",
      properties: ["SteamExe", "SteamPath", "AutoLoginUser"],
    });

    if (Array.isArray(registry) || !registry || typeof registry !== "object") {
      throw new Error("Registry entry not found or invalid");
    }

    return new SteamUserRegistry((registry as any).SteamExe ?? "", (registry as any).SteamPath ?? "", (registry as any).AutoLoginUser ?? "");
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
  private powershell: PowerShell;

  private _folders: SteamLibraryFolders[] = [];
  private _installedGames: SteamGame[] = [];

  // Init
  private constructor(powershell: PowerShell) {
    this.powershell = powershell;
  }

  static async create(steamPath: string): Promise<SteamLibrary> {
    streamDeck.logger.debug(`${SteamLibrary.debugPrefix} Creating instance...`);

    const powershell = new PowerShell();

    const library = new SteamLibrary(powershell);
    await library.initialize(steamPath);

    return library;
  }

  private async initialize(steamPath: string): Promise<void> {
    this._folders = await this.parseLibraryVDF(steamPath);
    this._installedGames = await this.parseGameVDF(this._folders);
  }

  // Getters
  get libraryFolders(): SteamLibraryFolders[] {
    return this._folders;
  }

  get installedGames(): SteamGame[] {
    return this._installedGames;
  }

  private async parseLibraryVDF(steamPath: string): Promise<SteamLibraryFolders[]> {
    const libraryFolders: SteamLibraryFolders[] = [];
    const vdfPath = path.join(steamPath, "steamapps", "libraryfolders.vdf");
    
    streamDeck.logger.trace(`${SteamLibrary.debugPrefix} Library config path: ${vdfPath}`);

    const vdfFileContent = await fs.readFile(vdfPath, 'utf-8');
    const parsedContent = VDF.parse(vdfFileContent) as Object;

    // Parse VDF structure to extract library folders
    const libraryData = (parsedContent as any).libraryfolders || parsedContent;
    for (const [key, value] of Object.entries(libraryData)) {
      if (typeof value === "object" && value !== null && "path" in value) {
        const libraryEntry = value as any;
        const folder: SteamLibraryFolders = {
          path: `${libraryEntry.path}\\steamapps`,
          contentid: String(libraryEntry.contentid || ""),
          totalsize: String(libraryEntry.totalsize || "0"),
          apps: libraryEntry.apps ? Object.keys(libraryEntry.apps) : [],
        };
        libraryFolders.push(folder);
      }
    }
    streamDeck.logger.debug(`${SteamLibrary.debugPrefix} Found ${libraryFolders.length} library folders`);
    return libraryFolders;
  }

  /**
   * Parse game configurations from all library folders
   */
  private async parseGameVDF(folders: SteamLibraryFolders[]): Promise<SteamGame[]> {
    const games: SteamGame[] = [];

    for (const folder of folders) {
      // Find all .acf manifest files in this library folder
      const directoryContent = await this.powershell.getChildItem({
        path: folder.path,
        filter: "$_.Name -like 'appmanifest_*.acf'",
        properties: ["Name", "Mode"],
      });

      const manifestFiles = directoryContent.files;

      streamDeck.logger.debug(`${SteamLibrary.debugPrefix} Found ${manifestFiles.length} manifests in ${folder.path}`);

      // Parse all manifests in parallel for performance
      const gamePromises = manifestFiles.map(async (manifest) => {
        let vdfContent: string = "";
        const manifestPath = path.join(folder.path, manifest.name);
        
        vdfContent = await fs.readFile(manifestPath, "utf-8");
        const parsedContent = VDF.parse(String(vdfContent)) as any;

        // Parse VDF structure to extract game data
        const gameData = (parsedContent as any).AppState || parsedContent;

        const game: SteamGame = {
          AppId: gameData.appid || "",
          Name: gameData.name || "",
          InstallDir: gameData.installdir || "",
          StateFlags: gameData.StateFlags || "",
        };

        return game;
      });

      const parsedGames = await Promise.all(gamePromises);
      games.push(...parsedGames);
    }
    streamDeck.logger.debug(`${SteamLibrary.debugPrefix} Games: ${games}`);
    streamDeck.logger.debug(`${SteamLibrary.debugPrefix} Total games found: ${games.length}`);
    return games;
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
    streamDeck.logger.debug(`${SteamProtocol.debugPrefix} Creating instance...`);

    const powershell = new PowerShell();
    return new SteamProtocol(powershell, steamExe);
  }

  // Steam control
  startSteam(): void {
    streamDeck.logger.info(`${SteamProtocol.debugPrefix} Starting Steam...`);
    this.powershell.startProcess({ target: this.steamExe });
  }

  async startSteamAsUser(steamExePath: string, accountName: string): Promise<void> {
    streamDeck.logger.info(`${SteamProtocol.debugPrefix} Starting Steam as user '${accountName}'...`);

    const steamProcess = await this.powershell.getProcess({
      name: "steam*",
      properties: ["Name", "ProcessName", "Id"],
    });

    if (steamProcess.length > 0) {
      const processId = steamProcess[0].Id;

      this.exitSteam();
      // Wait for it to exit gracefully (returns true if it exits, false on timeout)

      const exited = await this.powershell.waitProcess({
        id: processId,
        timeout: 2000, // 2 seconds
      });

      // If it didn't exit, force stop it
      if (!exited) {
        streamDeck.logger.warn("Steam didn't exit, forcing stop...");
        await this.powershell.stopProcess({
          id: processId,
          force: true,
        });

        // Wwait a bit more after force stop
        await this.powershell.waitProcess({
          id: processId,
          timeout: 1000,
        });
      }
    }

    // Start Steam with specific user account
    await this.powershell.startProcess({ target: steamExePath, args: ["-login", accountName] });
  }

  exitSteam(): void {
    streamDeck.logger.info(`${SteamProtocol.debugPrefix} Exiting Steam...`);
    this.powershell.startProcess({ target: "steam://exit" });
  }

  // Big Picture
  async launchBigPicture(): Promise<boolean> {
    streamDeck.logger.debug(`${SteamProtocol.debugPrefix} Launching Big Picture mode...`);
    this.powershell.startProcess({ target: "steam://open/bigpicture" });

    // Wait and verify launch
    await new Promise((resolve) => setTimeout(resolve, 500));
    const isRunning = await this.isBigPictureRunning();

    if (!isRunning) {
      streamDeck.logger.warn(`${SteamProtocol.debugPrefix} Big Picture launch command sent, but verification failed`);
      return false;
    }

    return true;
  }

  exitBigPicture(): void {
    streamDeck.logger.debug(`${SteamProtocol.debugPrefix} Exiting Big Picture mode...`);
    this.powershell.startProcess({ target: "steam://close/bigpicture" });
  }

  async isBigPictureRunning(): Promise<boolean> {
    const processes = await this.powershell.getProcess({
      name: "*steam**",
      filter: "$_.MainWindowTitle -like '*big picture*'",
      properties: ["Name", "ProcessName", "MainWindowTitle"],
    });
    const result = processes.length > 0 && processes[0].Name !== null;
    streamDeck.logger.debug(`${SteamProtocol.debugPrefix} Big Picture: ${result}`);
    return result;
  }

  // Friends and status
  setFriendStatus(status: SteamFriendStatus): void {
    streamDeck.logger.debug(`${SteamProtocol.debugPrefix} Setting friend status to '${status}'...`);
    this.powershell.startProcess({ target: `steam://friends/status/${status}` });
  }

  openFriendsList(): void {
    streamDeck.logger.debug(`${SteamProtocol.debugPrefix} Opening friends list...`);
    this.powershell.startProcess({ target: "steam://open/friends" });
  }
}

class SteamUsers {
  private static readonly debugPrefix = "[SteamUsers]";
  private powershell: PowerShell;

  private _users: SteamUser[] = [];

  // Init
  private constructor(powershell: PowerShell) {
    this.powershell = powershell;
  }

  static async create(steamPath: string): Promise<SteamUsers> {
    streamDeck.logger.debug(`${SteamUsers.debugPrefix} Creating instance...`);

    const powershell = new PowerShell();

    const users = new SteamUsers(powershell);
    await users.initialize(steamPath);

    return users;
  }

  get users(): SteamUser[] {
    return this._users;
  }

  private async initialize(steamPath: string): Promise<void> {
    this._users = await this.parseUsersVDF(steamPath);
  }

  private async parseUsersVDF(steamPath: string): Promise<SteamUser[]> {
    const users: SteamUser[] = [];
    let vdfFileContent: string = "";

    const vdfPath = path.join(steamPath, "config", "loginusers.vdf");
    streamDeck.logger.debug(`${SteamUsers.debugPrefix} Users config path: ${vdfPath}`);

    try {
      vdfFileContent = await fs.readFile(vdfPath, "utf-8");
    } catch (error) {
      streamDeck.logger.error(`${SteamUsers.debugPrefix} Failed to read: ${vdfPath}`);
      return [];
    }
    const parsedContent = VDF.parse(vdfFileContent) as Object;

    streamDeck.logger.trace(`${SteamUsers.debugPrefix} Parsed content: ${JSON.stringify(parsedContent)}`);

    // Parse VDF structure to extract users
    const usersData = (parsedContent as any).users || parsedContent;
    for (const [steamId64, value] of Object.entries(usersData)) {
      if (typeof value === "object" && value !== null) {
        const userEntry = value as any;
        const user: SteamUser = {
          steamId64: steamId64,
          accountName: userEntry.AccountName || "",
          personaName: userEntry.PersonaName || "",
          avatarBase64: await this.getUserAvatar(steamPath, steamId64),
        };
        users.push(user);
      }
    }

    streamDeck.logger.debug(`${SteamUsers.debugPrefix} Found ${users.length} users`);
    return users;
  }

  private async getUserAvatar(steamPath: string, steamId64: string): Promise<string> {
    let base64: string = "";

    const avatarPath = path.join(steamPath, "config", "avatarcache", `${steamId64}.png`);
    base64 = await fs.readFile(avatarPath, "base64");

    return `data:image/png;base64,${base64}`;
  }
}

export class Steam {
  private static readonly debugPrefix = "[Steam]";

  private registry: SteamUserRegistry;
  private library: SteamLibrary;
  private users: SteamUsers;
  private webProtocol: SteamProtocol;

  // Init
  private constructor(registry: SteamUserRegistry, library: SteamLibrary, users: SteamUsers, webProtocol: SteamProtocol) {
    this.registry = registry;
    this.library = library;
    this.users = users;
    this.webProtocol = webProtocol;
  }

  static async create(): Promise<Steam> {
    streamDeck.logger.debug(`${Steam.debugPrefix} Creating instance...`);

    const registry = await SteamUserRegistry.create();
    const library = await SteamLibrary.create(registry.steamPath);
    const users = await SteamUsers.create(registry.steamPath);
    const webProtocol = await SteamProtocol.create(registry.steamExe);

    return new Steam(registry, library, users, webProtocol);
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

  getInstalledGames(): SteamGame[] {
    return this.library.installedGames;
  }

  // Users
  getUsers(): SteamUser[] {
    return this.users.users;
  }

  // Steam control
  startSteam(): void {
    this.webProtocol.startSteam();
  }

  async startSteamAsUser(accountName: string): Promise<void> {
    const steamExe = this.getSteamExe();
    await this.webProtocol.startSteamAsUser(steamExe, accountName);
  }

  exitSteam(): void {
    this.webProtocol.exitSteam();
  }

  // Big Picture
  async isBigPictureRunning(): Promise<boolean> {
    return this.webProtocol.isBigPictureRunning();
  }

  async launchBigPicture(): Promise<boolean> {
    return this.webProtocol.launchBigPicture();
  }

  exitBigPicture(): void {
    this.webProtocol.exitBigPicture();
  }

  // Friends and status
  setFriendStatus(status: SteamFriendStatus): void {
    this.webProtocol.setFriendStatus(status);
  }

  openFriendsList(): void {
    this.webProtocol.openFriendsList();
  }
}
