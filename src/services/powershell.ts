import streamDeck from "@elgato/streamdeck";
import { exec } from "child_process";
import { promisify } from "util";

// Note: `this` means the method returns the current instance of the class. This enables method chaining
class CommandBuilder {
  private commands: string[] = [];
  private whereClause?: string;
  private selectProps?: string[];
  private sortProps?: string[];
  private firstCount?: number;
  private lastCount?: number;
  private isUnique?: boolean;
  private shouldConvertToJson?: boolean;
  private jsonDepth?: number;

  command(cmd: string): this {
    this.commands.push(cmd);
    return this;
  }

  // Optional parameters - only add if provided
  where(condition?: string): this {
    if (condition) {
      this.whereClause = condition;
    }
    return this;
  }

  select(...properties: string[]): this {
    const props = properties.flat().filter(Boolean);
    if (props.length > 0) {
      this.selectProps = props;
    }
    return this;
  }

  sort(property: string, descending = false): this {
    if (!this.sortProps) this.sortProps = [];
    this.sortProps.push(descending ? `${property} -Descending` : property);
    return this;
  }

  first(count: number): this {
    this.firstCount = count;
    return this;
  }

  last(count: number): this {
    this.lastCount = count;
    return this;
  }

  unique(): this {
    this.isUnique = true;
    return this;
  }

  json(depth: number = 2): this {
    this.shouldConvertToJson = true;
    this.jsonDepth = depth;
    return this;
  }

  build(): string {
    let result = this.commands.join("; ");

    if (this.whereClause) {
      result += ` | Where-Object {${this.whereClause}}`;
    }

    if (this.sortProps && this.sortProps.length > 0) {
      result += ` | Sort-Object ${this.sortProps.join(", ")}`;
    }

    if (this.selectProps && this.selectProps.length > 0) {
      result += ` | Select-Object ${this.selectProps.join(", ")}`;
    }

    if (this.isUnique) {
      result += " -Unique";
    }

    if (this.firstCount) {
      result += ` -First ${this.firstCount}`;
    } else if (this.lastCount) {
      result += ` -Last ${this.lastCount}`;
    }

    if (this.shouldConvertToJson) {
      const depth = this.jsonDepth || 2;
      result += ` | ConvertTo-Json -Compress -Depth ${depth}`;
    }

    return result;
  }

  // Convenience method to build and return string directly
  toString(): string {
    return this.build();
  }
}

export class PowerShell {
  private debugPrefix: string = "[PowerShell]";
  private execAsync = promisify(exec);

  /**
   * Executes a PowerShell command
   */
  private async invokeCommand<T = void>(command: CommandBuilder, outputFormat: OutputFormat = "none"): Promise<T> {
    try {
      let fullCommand: string;

      if (outputFormat === "json") {
        fullCommand = command.json().build();
      } else {
        fullCommand = command.build();
      }
      streamDeck.logger.error(`${this.debugPrefix} Built command:`, fullCommand);
      const { stdout } = await this.execAsync(`powershell -Command "${fullCommand}"`);

      switch (outputFormat) {
        case "none":
          return undefined as T;
        case "text":
          return stdout.trim() as T;
        case "json":
          const trimmed = stdout.trim();
          return trimmed ? JSON.parse(trimmed) : ([] as T);
      }
    } catch (error) {
      streamDeck.logger.error(`${this.debugPrefix} Command failed:`, error);
      throw error;
    }
  }

  public async startProcess(options: StartProcessOptions): Promise<void> {
    // Build the Start-Process command with parameters
    const params: string[] = [`-FilePath '${options.target}'`];

    if (options.args && options.args.length > 0) {
      const argsList = options.args.map((arg) => `'${arg}'`).join(", ");
      params.push(`-ArgumentList ${argsList}`);
    }

    if (options.verb) {
      params.push(`-Verb '${options.verb}'`);
    }

    if (options.workingDirectory) {
      params.push(`-WorkingDirectory '${options.workingDirectory}'`);
    }

    if (options.windowStyle) {
      params.push(`-WindowStyle ${options.windowStyle}`);
    }

    const command = new CommandBuilder().command(`Start-Process ${params.join(" ")}`);

    await this.invokeCommand(command, "none");
  }

  public async readRegistryEntry(options: RegistryOptions): Promise<Record<string, any>> {
    const command = new CommandBuilder()
      .command(`Get-ItemProperty -Path '${options.path}'`)
      .where(options.filter)
      .select(...(options.properties || []));

    try {
      const result = await this.invokeCommand<Record<string, any>>(command, "json");
      return result || {};
    } catch (error) {
      streamDeck.logger.error(`Error reading registry ${options.path}:`, error);
      return {};
    }
  }

  public async getChildItem(options: DirectoryOptions): Promise<Directory> {
    const command = new CommandBuilder()
      .command(`Get-ChildItem -Path '${options.path}' -ErrorAction SilentlyContinue`)
      .where(options.filter)
      .select(...(options.properties || []));

    try {
      const result = await this.invokeCommand<any>(command, "json");

      const files: File[] = [];
      const items = Array.isArray(result) ? result : [result].filter(Boolean);

      for (const item of items) {
        if (item?.Name && item?.Mode) {
          files.push({
            name: item.Name,
            mode: this.parseModeToType(item.Mode),
          });
        }
      }

      return {
        path: options.path,
        name: options.path.split(/[/\\]/).pop() || options.path,
        files,
      };
    } catch (error) {
      streamDeck.logger.error(`Error listing directory ${options.path}:`, error);
      return {
        path: options.path,
        name: "",
        files: [],
      };
    }
  }

  public async getContent(options: GetContentOptions): Promise<string> {
    const command = new CommandBuilder().command(`Get-Content -Path '${options.path}' -Raw`);

    try {
      const result = await this.invokeCommand<string>(command, "text");
      return result || "";
    } catch (error) {
      streamDeck.logger.error(`Error reading file ${options.path}:`, error);
      return "";
    }
  }

  public async getContentBase64(options: GetContentOptions): Promise<string> {
    const command = new CommandBuilder().command(`[Convert]::ToBase64String([IO.File]::ReadAllBytes('${options.path}'))`);

    return await this.invokeCommand<string>(command, "text");
  }

  public async getProcess(options: ProcessOptions): Promise<Process[]> {
    const command = new CommandBuilder()
      .command(`Get-Process -Name "${options.name}" -ErrorAction SilentlyContinue`)
      .where(options.filter)
      .select(...(options.properties || []));

    try {
      const result = await this.invokeCommand<Process | Process[]>(command, "json");
      if (!result) return [];
      return Array.isArray(result) ? result : [result];
    } catch (error) {
      streamDeck.logger.error(`Error searching for process ${options.name}:`, error);
      return [];
    }
  }

  public async stopProcess(options: StopProcessOptions): Promise<void> {
    if (!options.name && !options.id) {
      throw new Error("Either name or id must be specified");
    }

    const identifier = options.name ? `-Name "${options.name}"` : `-Id ${options.id}`;
    const forceParam = options.force ? " -Force" : "";

    const command = new CommandBuilder().command(`Stop-Process ${identifier}${forceParam} -ErrorAction SilentlyContinue`);

    await this.invokeCommand(command, "none");
  }

  public async waitProcess(options: WaitProcessOptions): Promise<boolean> {
    if (!options.name && !options.id) {
      throw new Error("Either name or id must be specified");
    }

    const identifier = options.name ? `-Name "${options.name}"` : `-Id ${options.id}`;
    const timeoutSeconds = options.timeout ? Math.ceil(options.timeout / 1000) : 10;

    const command = new CommandBuilder()
      .command(`$result = try {`)
      .command(`  Wait-Process ${identifier} -Timeout ${timeoutSeconds} -ErrorAction Stop`)
      .command(`  $true`)
      .command(`} catch [Microsoft.PowerShell.Commands.ProcessCommandException] {`)
      .command(`  $false`)
      .command(`} catch {`)
      .command(`  $true`)
      .command(`}`)
      .command(`$result`); // Output the result

    return await this.invokeCommand<boolean>(command, "json");
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
