type SteamFriendStatus = "online" | "away" | "invisible" | "offline";

type SteamRegistry = {
  steamExe: string;
  steamPath: string;
  autoLoginUser: string;
};

type SteamLibraryFolders = {
  path: string;
  contentid: string;
  totalsize: string;
  apps: string[];
};

/**
 * Steam app state flags (bitmask values from .acf manifests)
 * @see https://github.com/lutris/lutris/blob/master/docs/steam.rst
 */
declare const enum SteamStateFlags {
  Invalid = 0,
  Uninstalled = 1,
  UpdateRequired = 2,
  FullyInstalled = 4,
  Encrypted = 8,
  Locked = 16,
  FilesMissing = 32,
  AppRunning = 64,
  FilesCorrupt = 128,
  UpdateRunning = 256,
  UpdatePaused = 512,
  UpdateStarted = 1024,
  Uninstalling = 2048,
  BackupRunning = 4096,
  Reconfiguring = 65536,
  Validating = 131072,
  AddingFiles = 262144,
  Preallocating = 524288,
  Downloading = 1048576,
  Staging = 2097152,
  Committing = 4194304,
  UpdateStopping = 8388608,
}

type SteamApp = {
  id: number;
  name: string;
  installDir: string;
  stateFlags: number;
};

type PluginGlobalSettings = {
  steamRunning?: boolean;
  autoLoginUser?: string;
  steamPath?: string;
  lastUpdated?: string;
};

type SteamUser = {
  steamId64: string;
  accountName: string;
  personaName: string;
  avatarBase64: string;
};
