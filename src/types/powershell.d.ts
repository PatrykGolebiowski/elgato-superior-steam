type Directory  = {
    path: string;
    name: string;
    files: File[];
}

type File  = {
    name: string;
    mode: "directory" | "file" | "link";
}

type Process = {
  Name?: string;
  ProcessName?: string;
  MainWindowTitle?: string;
};