"use client";

import { motion } from "framer-motion";
import Link from "next/link";

import { CalendarGridAnimated } from "@/components/features/calendar-grid";
import { ScrollReveal } from "@/components/features/scroll-reveal";
import { TaskCard } from "@/components/features/task-card";
import { FloatingCard } from "@/components/ui/floating-card";
import { GlassPanel } from "@/components/ui/glass-panel";
import { MagneticButton } from "@/components/ui/magnetic-button";
import { Button } from "@/components/ui/button";

const sample = [
  { id: "d1", title: "AP Calc — problem set 4.2", due: "Thu · 45 min est." },
  { id: "d2", title: "History reading + 3 margin notes", due: "Due Sun" },
];

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 380, damping: 30 } },
};

export default function DashboardPage() {
  return (
    <div className="min-h-full bg-[radial-gradient(900px_440px_at_12%_-12%,rgba(56,189,248,0.12),transparent)] px-6 py-10">
      <div className="mx-auto max-w-6xl space-y-12">
        <header className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="font-mono text-xs uppercase tracking-[0.3em] text-sky-400/90"
            >
              Today in Flux
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.06, type: "spring", stiffness: 360, damping: 32 }}
              className="mt-3 text-4xl font-semibold tracking-tight text-white md:text-5xl"
            >
              Calm focus, dramatic polish.
            </motion.h1>
            <p className="mt-3 max-w-xl text-zinc-400">
              A premium shell for the Flux roadmap — motion-first cards, glass panels, and tactile
              magnetic CTAs.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <MagneticButton
              type="button"
              onClick={() => window.dispatchEvent(new Event("flux-open-command"))}
            >
              Open command palette
            </MagneticButton>
            <Button variant="secondary" asChild>
              <Link href="/planner">Planner</Link>
            </Button>
          </div>
        </header>

        <div className="grid gap-8 lg:grid-cols-12">
          <ScrollReveal className="lg:col-span-7">
            <GlassPanel>
              <h2 className="text-lg font-semibold text-white">Next up</h2>
              <p className="mt-1 text-sm text-zinc-400">Staggered task cards with spring motion</p>
              <motion.div
                className="mt-6 grid gap-4 sm:grid-cols-2"
                variants={container}
                initial="hidden"
                animate="show"
              >
                {sample.map((task) => (
                  <motion.div key={task.id} variants={item}>
                    <TaskCard task={task} />
                  </motion.div>
                ))}
              </motion.div>
            </GlassPanel>
          </ScrollReveal>

          <div className="space-y-8 lg:col-span-5">
            <ScrollReveal>
              <FloatingCard>
                <h3 className="text-base font-semibold text-white">Momentum</h3>
                <p className="mt-2 text-sm text-zinc-400">
                  Idle float + soft glow — the app should feel alive even when you pause.
                </p>
              </FloatingCard>
            </ScrollReveal>
            <ScrollReveal>
              <CalendarGridAnimated />
            </ScrollReveal>
          </div>
        </div>
      </div>
    </div>
  );
}
