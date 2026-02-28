import type { ReactNode } from "react";

import { AuthBootstrap } from "../src/auth/bootstrap";
import "./globals.css";

export const metadata = {
  title: "Legal Tech Thing",
  description: "Contract intelligence platform"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthBootstrap />
        {children}
      </body>
    </html>
  );
}
