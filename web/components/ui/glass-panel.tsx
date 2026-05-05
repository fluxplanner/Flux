"use client";

import { motion } from "framer-motion";
import * as React from "react";

import { cn } from "@/lib/utils";

type GlassPanelProps = {
  className?: string;
  glow?: boolean;
  children?: React.ReactNode;
};

export function GlassPanel({
  className,
  glow = true,
  children,
}: GlassPanelProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 32 }}
      className={cn(
        "relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.09] to-white/[0.02] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-2xl",
        glow &&
          "before:pointer-events-none before:absolute before:inset-0 before:rounded-2xl before:bg-[radial-gradient(600px_200px_at_20%_0%,rgba(56,189,248,0.12),transparent_55%)]",
        className,
      )}
    >
      {children}
    </motion.div>
  );
}
