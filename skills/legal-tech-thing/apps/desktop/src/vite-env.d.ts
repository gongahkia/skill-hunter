/// <reference types="vite/client" />

interface DesktopBridge {
  platform: string;
  electronVersion: string;
  pickContractFiles: () => Promise<ImportedContractFile[]>;
}

interface ImportedContractFile {
  path: string;
  name: string;
  size: number;
  mimeType: string;
  kind: "pdf" | "docx" | "image" | "txt";
  base64Content: string;
  textPreview: string | null;
}

interface Window {
  desktopBridge: DesktopBridge;
}
