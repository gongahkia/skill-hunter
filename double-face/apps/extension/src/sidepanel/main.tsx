import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { SidePanelApp } from "./SidePanelApp";
import "./styles.css";

const rootElement = document.getElementById("root");

if (rootElement) {
  const root = createRoot(rootElement);
  root.render(
    <StrictMode>
      <SidePanelApp />
    </StrictMode>
  );
}
