"use client";

import { LayoutDashboard, Brain, CalendarDays, PanelLeft } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";

import { cn } from "@/lib/utils";

const items = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/planner", icon: CalendarDays, label: "Planner" },
  { href: "/ai", icon: Brain, label: "Flux AI" },
];

const spring = { type: "spring" as const, stiffness: 420, damping: 38 };

export function Sidebar() {
  const [expanded, setExpanded] = React.useState(true);
  const pathname = usePathname();

  return (
    <motion.aside
      animate={{ width: expanded ? 232 : 76 }}
      transition={spring}
      className="relative z-40 flex h-screen shrink-0 flex-col gap-4 border-r border-white/8 bg-zinc-950/95 p-3 text-white backdrop-blur-xl"
    >
      <div className="flex items-center justify-between gap-2 px-1">
        <motion.div
          animate={{ opacity: expanded ? 1 : 0.85 }}
          className="flex min-w-0 flex-col"
        >
          {expanded && (
            <span className="truncate font-bold tracking-tight text-white">
              Flux
            </span>
          )}
          {expanded && (
            <span className="text-[0.6rem] uppercase tracking-[0.2em] text-zinc-500">
              Planner
            </span>
          )}
        </motion.div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="rounded-lg border border-white/10 bg-white/5 p-2 text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
          aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
        >
          <PanelLeft size={18} />
        </button>
      </div>

      <nav className="flex flex-1 flex-col gap-1.5 pt-2">
        {items.map((item) => {
          const Icon = item.icon;
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <Link key={item.href} href={item.href} className="block">
              <motion.div
                whileHover={{ scale: 1.03, x: 2 }}
                whileTap={{ scale: 0.97 }}
                transition={spring}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 transition-colors",
                  active
                    ? "bg-sky-500/15 text-white ring-1 ring-sky-400/25"
                    : "text-zinc-400 hover:bg-white/6 hover:text-white",
                )}
              >
                <Icon size={20} className="shrink-0" />
                {expanded && (
                  <span className="text-sm font-semibold">{item.label}</span>
                )}
              </motion.div>
            </Link>
          );
        })}
      </nav>

      <motion.div
        layout
        className="mt-auto rounded-xl border border-white/8 bg-white/[0.04] p-3 text-xs text-zinc-500"
      >
        {expanded ? (
          <>
            <div className="font-mono text-[0.62rem] uppercase tracking-wider text-zinc-400">
              Flux Next
            </div>
            <p className="mt-1 leading-relaxed">Linear · Apple · Notion energy</p>
          </>
        ) : (
          <div className="text-center font-mono text-[0.58rem] text-zinc-500">
            v0
          </div>
        )}
      </motion.div>
    </motion.aside>
  );
}
