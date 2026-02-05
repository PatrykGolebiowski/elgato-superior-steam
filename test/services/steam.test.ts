/// <reference path="../../src/types/steam.d.ts" />
import { describe, it, expect, test, beforeAll } from "vitest";
import path from "path";

import { getSteam } from "../../src/services/steam-singleton";
import { PowerShell } from "../../src/services/powershell.js";
import { Steam } from "../../src/services/steam";

describe("Integration: Steam User Registry", () => {
  let steam: Steam;
  let registryValues: { SteamExe: string; SteamPath: string; AutoLoginUser: string };

  beforeAll(async () => {
    steam = await getSteam();
    const ps = new PowerShell();
    registryValues = (await ps.readRegistryEntry({
      path: "HKCU:\\Software\\Valve\\Steam",
      properties: ["SteamExe", "SteamPath", "AutoLoginUser"],
    })) as { SteamExe: string; SteamPath: string; AutoLoginUser: string };
  });

  it("`SteamPath` should match registry", async () => {
    const registry = path.normalize(registryValues.SteamPath);
    expect(steam.getSteamPath()).toEqual(registry);
  });

  it("`SteamExe` should match registry", async () => {
    const registry = path.normalize(registryValues.SteamExe);
    expect(steam.getSteamExe()).toEqual(registry);
  });

  it("`AutoLoginUser` should match registry", async () => {
    const registry = registryValues.AutoLoginUser;
    expect(steam.getAutoLoginUser()).toEqual(registry);
  });
});

describe("Integration: Steam Library", () => {
  let libraryFolders: SteamLibraryFolders[];
  let installedApps: SteamApp[];

  beforeAll(async () => {
    const steam = await getSteam();
    libraryFolders = steam.getLibraryFolders();
    installedApps = steam.getInstalledApps();
  });

  // Library
  it("Library folders should not be empty", () => {
    expect(libraryFolders.length).toBeGreaterThan(0);
  });

  it("All library folders should have required properties", () => {
    expect(libraryFolders.length).toBeGreaterThan(0);
    libraryFolders.forEach((folder: SteamLibraryFolders) => {
      expect(folder.path).toBeDefined();
      expect(folder.path).toBeTypeOf("string");
      expect(folder.path.length).toBeGreaterThan(0);

      expect(folder.contentid).toBeDefined();
      expect(folder.contentid).toBeTypeOf("string");

      expect(folder.totalsize).toBeDefined();
      expect(folder.totalsize).toBeTypeOf("string");

      expect(folder.apps).toBeDefined();
      expect(folder.apps).toBeTypeOf("object");
    });
  });

  it("Library apps should have `228980` app", () => {
    if (libraryFolders.length > 0) {
      expect(libraryFolders.find((folder: SteamLibraryFolders) => folder.apps.includes("228980"))).toBeTruthy();
    }
  });

  // Apps
  it("Installed apps should be an array", () => {
    expect(Array.isArray(installedApps)).toBe(true);
  });

  it("All installed apps should have required properties (if any apps installed)", () => {
    if (installedApps.length === 0) {
      // No apps installed - skip property validation
      expect(installedApps.length).toBe(0);
      return;
    }

    installedApps.forEach((app: SteamApp) => {
      expect(app.id).toBeDefined();
      expect(app.id).toBeTypeOf("number");
      expect(app.id).toBeGreaterThan(0);

      expect(app.name).toBeDefined();
      expect(app.name).toBeTypeOf("string");
      expect(app.name.length).toBeGreaterThan(0);

      expect(app.installDir).toBeDefined();
      expect(app.installDir).toBeTypeOf("string");

      expect(app.stateFlags).toBeDefined();
      expect(app.stateFlags).toBeTypeOf("number");
      expect(app.stateFlags).toBeGreaterThanOrEqual(0);
    });
  });

  // Steamworks Common Redistributables (228980) should not be listed as a launchable app
  it("Installed apps should not have `228980` app (if any apps installed)", () => {
    if (installedApps.length > 0) {
      expect(installedApps.find((app: { id: number }) => app.id === 228980)).toBeUndefined();
    }
  });

  it("Should retrieve app icon as base64 (if any apps installed)", async () => {
    if (installedApps.length === 0) {
      expect(installedApps.length).toBe(0);
      return;
    }

    const steam = await getSteam();
    const firstApp = installedApps[0];
    const iconBase64 = await steam.getAppIconBase64(firstApp.id.toString());

    // Should return a string
    expect(iconBase64).toBeTypeOf("string");

    if (iconBase64) {
      // Should be a data URI with base64 encoding
      expect(iconBase64).toMatch(/^data:image\/(png|jpeg|jpg|ico);base64,/);

      // Should be long enough to be an actual image
      expect(iconBase64.length).toBeGreaterThan(100);

      // Extract base64 part and verify it's valid
      const base64Part = iconBase64.split(",")[1];
      expect(base64Part).toMatch(/^[A-Za-z0-9+/=]+$/);
    }
  });
});

describe("Integration: Steam users", () => {
  let users: SteamUser[];

  beforeAll(async () => {
    const steam = await getSteam();
    users = steam.getLoggedInUsers();
  });

  it("All logged in users should have required properties (if any users logged in)", () => {
    if (users.length === 0) {
      // No users logged in - skip property validation
      expect(users.length).toBe(0);
      return;
    }

    users.forEach((user: SteamUser) => {
      expect(user.steamId64).toBeDefined();
      expect(user.steamId64).toBeTypeOf("string");
      expect(user.steamId64.length).toBeGreaterThan(0);

      expect(user.accountName).toBeDefined();
      expect(user.accountName).toBeTypeOf("string");
      expect(user.accountName.length).toBeGreaterThan(0);

      expect(user.personaName).toBeDefined();
      expect(user.personaName).toBeTypeOf("string");
      expect(user.personaName.length).toBeGreaterThan(0);

      expect(user.avatarBase64).toBeDefined();
      expect(user.avatarBase64).toBeTypeOf("string");
      expect(user.avatarBase64.length).toBeGreaterThan(0);
    });
  });

  it("Should retrieve user avatar icon as base64 (if any user logged in)", async () => {
    if (users.length === 0) {
      expect(users.length).toBe(0);
      return;
    }

    const firstUser = users[0];
    const avatarBase64 = firstUser.avatarBase64;
    // Should return a string
    expect(avatarBase64).toBeTypeOf("string");

    if (avatarBase64) {
      // Should be a data URI with base64 encoding
      expect(avatarBase64).toMatch(/^data:image\/(png|jpeg|jpg|ico);base64,/);

      // Should be long enough to be an actual image
      expect(avatarBase64.length).toBeGreaterThan(100);

      // Extract base64 part and verify it's valid
      const base64Part = avatarBase64.split(",")[1];
      expect(base64Part).toMatch(/^[A-Za-z0-9+/=]+$/);
    }
  });
});

describe.skip("SteamProtocol (LIVE)", () => {
  let steam: Steam;
  const ps = new PowerShell();

  beforeAll(async () => {
    steam = await Steam.create();
  });

  it("should detect if Steam is running", async () => {
    // This is a bit tautological, but we just want to ensure it doesn't throw
    const isRunning = await steam.isSteamRunning();
    expect(typeof isRunning).toBe("boolean");
  });
});
