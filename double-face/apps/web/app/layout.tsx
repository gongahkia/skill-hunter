import type { ReactNode } from "react";

import { AuthBootstrap } from "../src/auth/bootstrap";
import "./globals.css";

export const metadata = {
  title: "Double Face",
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
