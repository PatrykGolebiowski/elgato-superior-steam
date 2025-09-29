type OutputFormat = "none" | "text" | "json";

interface CommandOptions {
  commands: string[];
  where?: string; // `Where-Object` filter
  select?: string[]; // `Select-Object` properties
  sort?: string | string[]; // `Sort-Object` properties
  first?: number; // `Select first` N results
  last?: number; // `Select last` N results
  unique?: boolean; // `Get unique` results
}

// Processes
interface ProcessIdentifier {
  name?: string;
  processName?: string;
  id: number;
}

interface StopProcessOptions extends ProcessIdentifier {
  force?: boolean;
}

interface WaitProcessOptions extends ProcessIdentifier {
  timeout?: number;
}

interface StartProcessOptions {
  target: string;
  args?: string[];
  verb?: string; // For 'RunAs' (admin), 'Open', etc.
  workingDirectory?: string;
  windowStyle?: "Normal" | "Hidden" | "Minimized" | "Maximized";
}



interface QueryOptions {
  filter?: string;
  properties?: string[];
}

interface DirectoryOptions extends QueryOptions {
  path: string;
}

interface ProcessOptions extends QueryOptions {
  name: string;
}

interface RegistryOptions extends QueryOptions {
  path: string;
}



interface GetContentOptions {
  path: string;
}

// Return types
type Directory = {
  path: string;
  name: string;
  files: File[];
};

type File = {
  name: string;
  mode: "directory" | "file" | "link";
};

type Process = {
  Name: string;
  ProcessName: string;
  Id: number;
  MainWindowTitle?: string;
};
