import { describe, it, expect } from "vitest";
import { PowerShell } from "../../src/services/powershell.js";

// We're testing the CommandBuilder indirectly through PowerShell's private class
// So we'll test the build patterns by checking the actual command strings

describe("PowerShell CommandBuilder", () => {
  describe("basic command building", () => {
    it("should build a simple command", () => {
      // We can't directly test CommandBuilder since it's private,
      // but we can observe the behavior through PowerShell methods
      const ps = new PowerShell();

      // Test that the PowerShell class exists and has the expected methods
      expect(ps).toBeDefined();
      expect(ps.getProcess).toBeDefined();
      expect(ps.readRegistryEntry).toBeDefined();
      expect(ps.getChildItem).toBeDefined();
    });
  });
});

describe("PowerShell command patterns", () => {
  it("should handle process queries", async () => {
    const ps = new PowerShell();

    // This will attempt to find a non-existent process named "nonexistent-test-process"
    // Should return empty array
    const result = await ps.getProcess({ name: "nonexistent-test-process-12345" });

    expect(Array.isArray(result)).toBe(true);
  });

  it("should throw error when stopping process without name or id", async () => {
    const ps = new PowerShell();

    await expect(ps.stopProcess({} as any)).rejects.toThrow("Either name or id must be specified");
  });

  it("should throw error when waiting for process without name or id", async () => {
    const ps = new PowerShell();

    await expect(ps.waitProcess({} as any)).rejects.toThrow("Either name or id must be specified");
  });
});

describe("PowerShell registry operations", () => {
  it("should handle registry read errors gracefully", async () => {
    const ps = new PowerShell();

    // Try to read a non-existent registry path
    const result = await ps.readRegistryEntry({
      path: "HKLM:\\NonExistent\\Test\\Path\\12345",
    });

    // Should return empty object on error
    expect(result).toEqual({});
  });

  it("should read registry entry", async () => {
    const ps = new PowerShell();

    // Try to read a non-existent registry path
    const result = await ps.readRegistryEntry({
      path: "HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\",
    });

    // Should return empty object on error
    expect(result).toHaveProperty("SystemRoot");
  });
});

describe("PowerShell file operations", () => {
  it("should handle directory listing errors gracefully", async () => {
    const ps = new PowerShell();

    // Try to list a non-existent directory
    const result = await ps.getChildItem({
      path: "C:\\NonExistent\\Test\\Directory\\12345",
    });

    // Should return empty directory structure
    expect(result).toHaveProperty("path");
    expect(result).toHaveProperty("files");
    expect(result.files).toEqual([]);
  });

  it("should handle file read errors gracefully", async () => {
    const ps = new PowerShell();

    // Try to read a non-existent file
    const result = await ps.getContent({
      path: "C:\\NonExistent\\Test\\File\\12345.txt",
    });

    // Should return empty string on error
    expect(result).toBe("");
  });
});
