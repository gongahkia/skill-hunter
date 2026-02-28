import { app, BrowserWindow } from "electron";
import path from "node:path";

const rendererDevServerUrl = process.env.VITE_DEV_SERVER_URL;
const rendererEntryPath = path.join(__dirname, "../dist/renderer/index.html");
const preloadPath = path.join(__dirname, "preload.js");

function createMainWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 1024,
    minHeight: 680,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: preloadPath
    }
  });

  if (rendererDevServerUrl) {
    void mainWindow.loadURL(rendererDevServerUrl);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    void mainWindow.loadFile(rendererEntryPath);
  }
}

app.whenReady().then(() => {
  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
