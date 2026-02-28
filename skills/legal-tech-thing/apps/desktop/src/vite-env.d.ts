/// <reference types="vite/client" />

interface DesktopBridge {
  platform: string;
  electronVersion: string;
  pickContractFiles: () => Promise<ImportedContractFile[]>;
  capturePrimaryScreen: () => Promise<CapturedScreenResult>;
  readClipboardText: () => Promise<string>;
  onGlobalCaptureHotkey: (
    handler: (payload: GlobalCaptureHotkeyPayload) => void
  ) => () => void;
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

interface GlobalCaptureHotkeyPayload {
  shortcut: string;
  triggeredAt: string;
  capture: CapturedScreenResult;
}

interface Window {
  desktopBridge: DesktopBridge;
}
