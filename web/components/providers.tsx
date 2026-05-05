"use client";

import { CommandPalette } from "@/components/layout/command-palette";
import * as React from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  React.useEffect(() => {
    // #region agent log
    fetch("http://127.0.0.1:7650/ingest/92050576-10c4-4824-9c8e-cbeb99e15440", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "204e89",
      },
      body: JSON.stringify({
        sessionId: "204e89",
        location: "providers.tsx:mount",
        message: "Next.js Providers mounted",
        data: { path: typeof window !== "undefined" ? window.location.pathname : "" },
        timestamp: Date.now(),
        hypothesisId: "H6",
      }),
    }).catch(() => {});
    // #endregion
  }, []);
  return (
    <>
      <CommandPalette />
      {children}
    </>
  );
}
