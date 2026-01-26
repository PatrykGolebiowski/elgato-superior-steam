// Type definitions for steam-cmd API response
// Based on steam-cmd-2073850.json

export interface SteamCmdResponse {
  data: SteamCmdData;
  status: string;
}

export interface SteamCmdData {
  [appid: string]: SteamCmdApp;
}

export interface SteamCmdApp {
  _change_number: number;
  _missing_token: boolean;
  _sha: string;
  _size: number;
  appid: string;
  common: SteamCmdAppCommon;
  config: SteamCmdAppConfig;
  depots: any; // Keeping this as 'any' for now as it's complex and not immediately needed
  extended: SteamCmdAppExtended;
  install?: SteamCmdInstall;
  ufs?: SteamCmdUfs;
}

export interface SteamCmdAppCommon {
  aicontenttype: string;
  associations: { [key: string]: SteamCmdAssociation };
  category: { [key: string]: string };
  clienticon: string;
  clienticns?: string;
  clienttga: string;
  community_hub_visible: string;
  community_visible_stats: string;
  content_descriptors?: { [key: string]: string };
  content_descriptors_including_dlc: { [key: string]: string };
  controller_support: string;
  controllertagwizard: string;
  eulas: { [key: string]: SteamCmdEula };
  exfgls: string;
  gameid: string;
  genres: { [key: string]: string };
  header_image: { [key: string]: string };
  icon: string;
  languages: { [key: string]: string };
  library_assets: SteamCmdLibraryAssets;
  library_assets_full: SteamCmdLibraryAssetsFull;
  name: string;
  name_localized?: { [key: string]: string };
  osarch: string;
  osextended: string;
  oslist: string;
  primary_genre: string;
  releasestate: string;
  review_percentage: string;
  review_score: string;
  small_capsule: { [key: string]: string };
  steam_deck_compatibility: SteamDeckCompatibility;
  steam_release_date: string;
  store_asset_mtime: string;
  store_tags: { [key: string]: string };
  supported_languages: { [key: string]: SteamCmdSupportedLanguage };
  type: string;
}

export interface SteamCmdAssociation {
  name: string;
  type: string;
}

export interface SteamCmdEula {
  id: string;
  name: string;
  url: string;
  version: string;
}

export interface SteamCmdLibraryAssets {
  library_capsule: string;
  library_header: string;
  library_hero: string;
  library_hero_blur: string;
  library_logo: string;
  logo_position: SteamCmdLogoPosition;
}

export interface SteamCmdLogoPosition {
  height_pct: string;
  pinned_position: string;
  width_pct: string;
}

export interface SteamCmdLibraryAssetsFull {
  library_capsule: SteamCmdImageAsset;
  library_header: SteamCmdImageAsset;
  library_hero: SteamCmdImageAsset;
  library_hero_blur: SteamCmdImageAsset;
  library_logo: SteamCmdImageAsset & { logo_position: SteamCmdLogoPosition };
}

export interface SteamCmdImageAsset {
  image: { [key: string]: string };
  image2x?: { [key: string]: string };
}

export interface SteamDeckCompatibility {
  category: string;
  configuration: SteamDeckConfiguration;
  steamos_compatibility: string;
  steamos_tests: { [key: string]: SteamDeckTest };
  test_timestamp: string;
  tested_build_id: string;
  tests: { [key: string]: SteamDeckTest };
}

export interface SteamDeckConfiguration {
  gamescope_frame_limiter_not_supported: string;
  hdr_support: string;
  non_deck_display_glyphs: string;
  primary_player_is_controller_slot_0: string;
  recommended_runtime: string;
  requires_h264: string;
  requires_internet_for_setup: string;
  requires_internet_for_singleplayer: string;
  requires_manual_keyboard_invoke: string;
  requires_non_controller_launcher_nav: string;
  requires_voice_files: string;
  small_text: string;
  supported_input: string;
}

export interface SteamDeckTest {
  display: string;
  token: string;
}

export interface SteamCmdSupportedLanguage {
  supported: string;
  subtitles?: string;
  full_audio?: string;
}

export interface SteamCmdAppConfig {
  installdir: string;
  launch: { [key: string]: SteamCmdLaunchConfig };
}

export interface SteamCmdLaunchConfig {
  config?: {
    osarch: string;
  };
  executable: string;
  type: string;
}

export interface SteamCmdAppExtended {
  developer: string;
  dlcavailableonstore: string;
  homepage: string;
  isfreeapp: string;
  listofdlc: string;
  publisher: string;
  aliases?: string;
  gamedir?: string;
  icon?: string;
  languages_macos?: string;
  loadallbeforelaunch?: string;
  minclientversion?: string;
  minclientversion_pw_csgo?: string;
  noservers?: string;
  primarycache?: string;
  primarycache_macos?: string;
  serverbrowsername?: string;
  state?: string;
  vacmacmodulecache?: string;
  vacmodulecache?: string;
  vacmodulefilename?: string;
  validoslist?: string;
}

export interface SteamCmdInstall {
  registry: {
    [key: string]: {
      string: {
        [key: string]: string;
      };
    };
  };
  utf8_registry_strings: string;
}

export interface SteamCmdUfs {
  maxnumfiles: string;
  quota: string;
}
