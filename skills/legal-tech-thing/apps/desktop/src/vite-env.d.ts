/// <reference types="vite/client" />

interface DesktopBridge {
  platform: string;
  electronVersion: string;
}

interface Window {
  desktopBridge: DesktopBridge;
}
