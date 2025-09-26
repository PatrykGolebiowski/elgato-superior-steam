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
}

type SteamGame = {
  AppId: string;
  Name: string;
  InstallDir: string;
  StateFlags: string;
}

type PluginGlobalSettings = {
  installedGames?: SteamGame[];
  lastLibraryUpdate?: string;
}

type SteamUser = {
  steamId64: string;
  accountName: string;
  personaName: string;
  avatarUrl: string;
}
