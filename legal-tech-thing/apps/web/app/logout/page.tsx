"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { logoutUser } from "../../src/auth/api";

export default function LogoutPage() {
  const router = useRouter();

  useEffect(() => {
    async function runLogout() {
      await logoutUser();
      router.replace("/login");
    }

    void runLogout();
  }, [router]);

  return (
    <main>
      <h1>Logging out...</h1>
    </main>
  );
}
