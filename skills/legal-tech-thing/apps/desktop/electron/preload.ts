import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("desktopBridge", {
  platform: process.platform,
  electronVersion: process.versions.electron
});
