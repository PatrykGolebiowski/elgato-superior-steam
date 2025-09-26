type Directory  = {
    path: string;
    name: string;
    files: File[];
}

type File  = {
    name: string;
    mode: "directory" | "file" | "link";
}