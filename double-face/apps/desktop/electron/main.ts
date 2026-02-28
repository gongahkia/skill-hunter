import {
  app,
  BrowserWindow,
  clipboard,
  desktopCapturer,
  dialog,
  globalShortcut,
  ipcMain,
  screen
} from "electron";
import { readFile } from "node:fs/promises";
import path from "node:path";

const rendererDevServerUrl = process.env.VITE_DEV_SERVER_URL;
const rendererEntryPath = path.join(__dirname, "../dist/renderer/index.html");
const preloadPath = path.join(__dirname, "preload.js");
const MAX_IMPORT_FILE_SIZE_BYTES = 35 * 1024 * 1024;
const GLOBAL_CAPTURE_SHORTCUT = "CommandOrControl+Shift+R";
const GLOBAL_CAPTURE_EVENT_NAME = "desktop:global-capture-hotkey";

let mainWindow: BrowserWindow | null = null;

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

function toKind(fileName: string): ImportedContractFile["kind"] | null {
  const extension = path.extname(fileName).toLowerCase();

  if (extension === ".pdf") {
    return "pdf";
  }
  if (extension === ".docx") {
    return "docx";
  }
  if (extension === ".txt") {
    return "txt";
  }
  if ([".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".tif", ".tiff"].includes(extension)) {
    return "image";
  }

  return null;
}

function toMimeType(fileName: string) {
  const extension = path.extname(fileName).toLowerCase();

  if (extension === ".pdf") {
    return "application/pdf";
  }
  if (extension === ".docx") {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (extension === ".txt") {
    return "text/plain";
  }
  if (extension === ".png") {
    return "image/png";
  }
  if (extension === ".jpg" || extension === ".jpeg") {
    return "image/jpeg";
  }
  if (extension === ".webp") {
    return "image/webp";
  }
  if (extension === ".gif") {
    return "image/gif";
  }
  if (extension === ".bmp") {
    return "image/bmp";
  }
  if (extension === ".tif" || extension === ".tiff") {
    return "image/tiff";
  }

  return "application/octet-stream";
}

async function readImportedContractFile(filePath: string): Promise<ImportedContractFile | null> {
  const fileName = path.basename(filePath);
  const kind = toKind(fileName);
  if (!kind) {
    return null;
  }

  const fileBuffer = await readFile(filePath);
  if (fileBuffer.byteLength > MAX_IMPORT_FILE_SIZE_BYTES) {
    throw new Error(`FILE_TOO_LARGE:${fileName}`);
  }

  return {
    path: filePath,
    name: fileName,
    size: fileBuffer.byteLength,
    mimeType: toMimeType(fileName),
    kind,
    base64Content: fileBuffer.toString("base64"),
    textPreview: kind === "txt" ? fileBuffer.toString("utf8").slice(0, 4_000) : null
  };
}

function createMainWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    return mainWindow;
  }

  mainWindow = new BrowserWindow({
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

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  return mainWindow;
}

async function capturePrimaryScreen(): Promise<CapturedScreenResult> {
  const primaryDisplay = screen.getPrimaryDisplay();
  const sources = await desktopCapturer.getSources({
    types: ["screen"],
    thumbnailSize: {
      width: primaryDisplay.size.width,
      height: primaryDisplay.size.height
    }
  });

  const source =
    sources.find((candidate) => candidate.display_id === String(primaryDisplay.id)) ?? sources[0];

  if (!source) {
    throw new Error("SCREEN_CAPTURE_SOURCE_NOT_FOUND");
  }

  const size = source.thumbnail.getSize();
  return {
    id: source.id,
    name: source.name,
    width: size.width,
    height: size.height,
    dataUrl: source.thumbnail.toDataURL(),
    capturedAt: new Date().toISOString()
  };
}

function sendGlobalHotkeyCapture(window: BrowserWindow, payload: GlobalCaptureHotkeyPayload) {
  const deliverPayload = () => {
    window.webContents.send(GLOBAL_CAPTURE_EVENT_NAME, payload);
  };

  if (window.webContents.isLoadingMainFrame()) {
    window.webContents.once("did-finish-load", deliverPayload);
    return;
  }

  deliverPayload();
}

function registerGlobalCaptureShortcut() {
  return globalShortcut.register(GLOBAL_CAPTURE_SHORTCUT, () => {
    const window = createMainWindow();
    if (window.isMinimized()) {
      window.restore();
    }

    window.show();
    window.focus();

    void capturePrimaryScreen()
      .then((capture) => {
        sendGlobalHotkeyCapture(window, {
          shortcut: GLOBAL_CAPTURE_SHORTCUT,
          triggeredAt: new Date().toISOString(),
          capture
        });
      })
      .catch(() => undefined);
  });
}

app.whenReady().then(() => {
  ipcMain.handle("desktop:pick-contract-files", async () => {
    const selection = await dialog.showOpenDialog({
      title: "Import contract files",
      properties: ["openFile", "multiSelections"],
      filters: [
        { name: "Contract Files", extensions: ["pdf", "docx", "txt", "png", "jpg", "jpeg", "webp", "gif", "bmp", "tif", "tiff"] },
        { name: "All Files", extensions: ["*"] }
      ]
    });

    if (selection.canceled || selection.filePaths.length === 0) {
      return [];
    }

    const imports: ImportedContractFile[] = [];
    for (const filePath of selection.filePaths) {
      const importedFile = await readImportedContractFile(filePath);
      if (!importedFile) {
        continue;
      }
      imports.push(importedFile);
    }

    return imports;
  });

  ipcMain.handle("desktop:capture-primary-screen", async (): Promise<CapturedScreenResult> =>
    capturePrimaryScreen()
  );

  ipcMain.handle("desktop:clipboard-read-text", async () => clipboard.readText());

  createMainWindow();
  registerGlobalCaptureShortcut();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
