"use client";

import { motion } from "framer-motion";
import * as React from "react";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];
const DAYS = Array.from({ length: 35 }, (_, i) => i + 1);

const cellVariants = {
  hidden: { opacity: 0, scale: 0.92 },
  show: (i: number) => ({
    opacity: 1,
    scale: 1,
    transition: {
      delay: i * 0.012,
      type: "spring" as const,
      stiffness: 380,
      damping: 28,
    },
  }),
};

export function CalendarGridAnimated() {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm font-semibold text-white">May</span>
        <span className="font-mono text-xs uppercase tracking-widest text-zinc-500">
          Live preview
        </span>
      </div>
      <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[0.62rem] font-mono uppercase tracking-wide text-zinc-500">
        {WEEKDAYS.map((d, i) => (
          <div key={`${d}-${i}`}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {DAYS.map((d, i) => (
          <motion.button
            type="button"
            key={d}
            custom={i}
            variants={cellVariants}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-10%" }}
            whileHover={{
              scale: 1.08,
              transition: { type: "spring", stiffness: 500, damping: 22 },
            }}
            whileTap={{ scale: 0.94 }}
            className={
              d % 7 === 2 || d % 11 === 0
                ? "aspect-square rounded-lg bg-sky-500/18 text-[0.7rem] font-semibold text-sky-100 ring-1 ring-sky-400/35"
                : "aspect-square rounded-lg bg-white/[0.04] text-[0.7rem] text-zinc-400 ring-1 ring-white/6"
            }
          >
            {((d - 1) % 31) + 1}
          </motion.button>
        ))}
      </div>
    </div>
  );
}
