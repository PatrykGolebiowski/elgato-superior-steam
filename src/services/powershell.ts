import streamDeck from "@elgato/streamdeck";
import { exec } from "child_process";
import { promisify } from "util";

export class PowerShell {
  private debugPrefix: string = "[PowerShell]";
  private execAsync = promisify(exec);

  /**
   * Executes a PowerShell command and returns raw string output.
   * Returns empty string on any error.
   */
  private async runCommandRaw(psCommand: string): Promise<string> {
    try {
      const { stdout } = await this.execAsync(`powershell -Command "${psCommand}"`);
      streamDeck.logger.trace(`${this.debugPrefix} runCommandRaw output: ${stdout}`);
      return stdout.trim();
    } catch (error) {
      streamDeck.logger.error(`${this.debugPrefix} Failed to run PowerShell command:`, error);
      return "";
    }
  }

  /**
   * Executes a PowerShell command and returns JSON-parsed output.
   * Returns empty array [] on any error.
   */
  private async runCommand(psCommand: string): Promise<Object | Object[]> {
    streamDeck.logger.trace(`${this.debugPrefix} command: ${psCommand}`);

    try {
      const stdout = await this.runCommandRaw(`${psCommand} | ConvertTo-Json -Compress`);

      if (stdout === "") {
        streamDeck.logger.warn(`${this.debugPrefix} No output from PowerShell command.`);
        return [];
      }

      const response = JSON.parse(stdout);
      return response;
    } catch (error) {
      streamDeck.logger.error(`${this.debugPrefix} Failed to parse JSON from PowerShell command:`, error);
      return [];
    }
  }

  /**
   * Builds PowerShell command from array of command parts.
   * Handles Select-Object operations and joins commands with semicolons.
   */
  private commandBuilder(commands: string[], selectProperties?: string[]): string {
    let commandString = commands.join("; ");

    if (selectProperties && selectProperties.length > 0) {
      const props = selectProperties.join(", ");
      commandString += ` | Select-Object ${props}`;
    }

    return commandString;
  }

  public async startProcess(filePath: string): Promise<void> {
    const psCommand: string[] = [];

    streamDeck.logger.info(`${this.debugPrefix} Starting process: ${filePath}`);
    psCommand.push(`Start-Process "${filePath}"`);
    const fullCommand = this.commandBuilder(psCommand);

    await this.runCommand(fullCommand);
  }

  public async startProcessWithArgs(filePath: string, args: string[]): Promise<void> {
    const psCommand: string[] = [];

    streamDeck.logger.info(`${this.debugPrefix} Starting process: ${filePath} with args: ${JSON.stringify(args)}`);
    const argsList = args.map(arg => `'${arg}'`).join(', ');
    psCommand.push(`Start-Process -FilePath '${filePath}' -ArgumentList ${argsList}`);
    const fullCommand = this.commandBuilder(psCommand);

    await this.runCommand(fullCommand);
  }

  public async readRegistryEntry(path: string, properties?: string[]): Promise<Object> {
    const psCommand: string[] = [];

    psCommand.push(`Get-ItemProperty -Path '${path}'`);
    const fullCommand = this.commandBuilder(psCommand, properties);

    streamDeck.logger.debug(`${this.debugPrefix} readFile command: ${fullCommand}`);

    return await this.runCommand(fullCommand);
  }

  // I/O
  public async listDirectory(dirPath: string): Promise<Directory> {
    const psCommand: string[] = [];
    psCommand.push(`Get-ChildItem -Path '${dirPath}'`);
    const fullCommand = this.commandBuilder(psCommand, ["Mode", "Name"]);

    streamDeck.logger.debug(`${this.debugPrefix} listDirectory command: ${fullCommand}`);
    const result = await this.runCommand(fullCommand);
    const files: File[] = [];

    if (Array.isArray(result)) {
      for (const item of result) {
        if (item && typeof item === "object" && "Name" in item && "Mode" in item) {
          files.push({
            name: item["Name"] as string,
            mode: this.parseModeToType(item["Mode"] as string),
          });
        }
      }
    } else if (result && typeof result === "object" && "Name" in result && "Mode" in result) {
      files.push({
        name: result["Name"] as string,
        mode: this.parseModeToType(result["Mode"] as string),
      });
    }

    return {
      path: dirPath,
      name: dirPath.split(/[/\\]/).pop() || dirPath,
      files: files,
    };
  }

  public async readFile(filePath: string): Promise<string> {
    const psCommand: string[] = [];

    psCommand.push(`Get-Content -Path '${filePath}' -Raw`);
    const fullCommand = this.commandBuilder(psCommand);

    streamDeck.logger.debug(`${this.debugPrefix} readFile command: ${fullCommand}`);

    const result = await this.runCommandRaw(fullCommand);
    return result;
  }

  public async searchProcesses(processName: string, windowTitle?: string): Promise<Process[]> {
    const psCommand: string[] = [];

    psCommand.push(`$result = $null`);
    psCommand.push(`$processes = Get-Process -Name "${processName}" | Select Name, ProcessName, MainWindowTitle`);

    if (windowTitle) {
      psCommand.push(`$result = $processes | Where-Object {$_.MainWindowTitle -like '*${windowTitle}*'}`);
    } else {
      psCommand.push(`$result = $processes`);
    }

    psCommand.push(`if (-not $result) { $result = @() }`);
    psCommand.push(`$result`);

    const fullCommand = this.commandBuilder(psCommand);

    streamDeck.logger.debug(`${this.debugPrefix} searchProcesses command: ${fullCommand}`);

    try {
      const result = await this.runCommand(fullCommand);

      // Handle single process object or array of processes
      if (Array.isArray(result)) {
        return result as Process[];
      } else if (result && typeof result === "object") {
        return [result as Process];
      } else {
        return [];
      }
    } catch (error) {
      streamDeck.logger.error(`Error searching for process ${processName}:`, error);
      return [];
    }
  }

  // Helpers
  /**
   * Parses PowerShell mode string to readable type
   */
  private parseModeToType(mode: string): "directory" | "file" | "link" {
    if (mode.startsWith("d")) return "directory";
    if (mode.startsWith("l")) return "link";
    if (mode.startsWith("-")) return "file";
    return "file"; // Default to file for unknown types
  }
}
