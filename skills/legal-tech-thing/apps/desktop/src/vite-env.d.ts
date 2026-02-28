/// <reference types="vite/client" />

interface DesktopBridge {
  platform: string;
  electronVersion: string;
  pickContractFiles: () => Promise<ImportedContractFile[]>;
  capturePrimaryScreen: () => Promise<CapturedScreenResult>;
  readClipboardText: () => Promise<string>;
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

interface CapturedScreenResult {
  id: string;
  name: string;
  width: number;
  height: number;
  dataUrl: string;
  capturedAt: string;
}

interface Window {
  desktopBridge: DesktopBridge;
}
