import { contextBridge, ipcRenderer } from "electron";

type ImportedContractFile = {
  path: string;
  name: string;
  size: number;
  mimeType: string;
  kind: "pdf" | "docx" | "image" | "txt";
  base64Content: string;
  textPreview: string | null;
};

type CapturedScreenResult = {
  id: string;
  name: string;
  width: number;
  height: number;
  dataUrl: string;
  capturedAt: string;
};

type GlobalCaptureHotkeyPayload = {
  shortcut: string;
  triggeredAt: string;
  capture: CapturedScreenResult;
};

const GLOBAL_CAPTURE_EVENT_NAME = "desktop:global-capture-hotkey";

contextBridge.exposeInMainWorld("desktopBridge", {
  platform: process.platform,
  electronVersion: process.versions.electron,
  pickContractFiles: () => ipcRenderer.invoke("desktop:pick-contract-files") as Promise<ImportedContractFile[]>,
  capturePrimaryScreen: () =>
    ipcRenderer.invoke("desktop:capture-primary-screen") as Promise<CapturedScreenResult>,
  readClipboardText: () => ipcRenderer.invoke("desktop:clipboard-read-text") as Promise<string>,
  onGlobalCaptureHotkey: (handler: (payload: GlobalCaptureHotkeyPayload) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: GlobalCaptureHotkeyPayload) => {
      handler(payload);
    };

    ipcRenderer.on(GLOBAL_CAPTURE_EVENT_NAME, listener);
    return () => {
      ipcRenderer.removeListener(GLOBAL_CAPTURE_EVENT_NAME, listener);
    };
  }
});
