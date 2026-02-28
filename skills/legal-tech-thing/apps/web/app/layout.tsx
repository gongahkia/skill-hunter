import type { ReactNode } from "react";

import "./globals.css";

export const metadata = {
  title: "Legal Tech Thing",
  description: "Contract intelligence platform"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
