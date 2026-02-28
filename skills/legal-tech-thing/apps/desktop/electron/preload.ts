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

contextBridge.exposeInMainWorld("desktopBridge", {
  platform: process.platform,
  electronVersion: process.versions.electron,
  pickContractFiles: () => ipcRenderer.invoke("desktop:pick-contract-files") as Promise<ImportedContractFile[]>,
  capturePrimaryScreen: () =>
    ipcRenderer.invoke("desktop:capture-primary-screen") as Promise<CapturedScreenResult>
});
