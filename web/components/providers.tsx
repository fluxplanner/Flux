"use client";

import { CommandPalette } from "@/components/layout/command-palette";
import * as React from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      <CommandPalette />
      {children}
    </>
  );
}
