"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import * as React from "react";

export function ScrollSection() {
  const ref = React.useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const scale = useTransform(scrollYProgress, [0, 0.45], [0.86, 1]);
  const opacity = useTransform(scrollYProgress, [0, 0.35], [0.15, 1]);

  return (
    <section
      ref={ref}
      className="relative flex min-h-[160vh] items-center justify-center px-6"
    >
      <motion.div style={{ scale, opacity }} className="mx-auto max-w-4xl text-center">
        <p className="mb-6 font-mono text-xs uppercase tracking-[0.35em] text-sky-400/90">
          Flux Planner
        </p>
        <h1 className="text-balance bg-gradient-to-br from-white via-white to-zinc-400 bg-clip-text font-semibold tracking-tight text-transparent sm:text-6xl lg:text-7xl">
          Your planner, reinvented.
        </h1>
        <p className="mx-auto mt-8 max-w-xl text-lg text-zinc-400">
          Smooth motion, calm glass UI, AI that respects your workload — crafted to feel as good as
          it looks.
        </p>
      </motion.div>
    </section>
  );
}
