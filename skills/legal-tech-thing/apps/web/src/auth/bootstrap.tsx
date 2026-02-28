"use client";

import { useEffect } from "react";

import { refreshAccessToken } from "./api";

export function AuthBootstrap() {
  useEffect(() => {
    void refreshAccessToken();
  }, []);

  return null;
}
