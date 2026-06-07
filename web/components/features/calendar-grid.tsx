"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import * as React from "react";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

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

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

// Monday-first offset: Sun=6, Mon=0, Tue=1, …
function getMonthOffset(year: number, month: number) {
  return (new Date(year, month, 1).getDay() + 6) % 7;
}

export function CalendarGridAnimated() {
  const today = new Date();
  const [viewYear, setViewYear] = React.useState(today.getFullYear());
  const [viewMonth, setViewMonth] = React.useState(today.getMonth());

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const offset = getMonthOffset(viewYear, viewMonth);
  const totalCells = Math.ceil((offset + daysInMonth) / 7) * 7;
  const cells = Array.from({ length: totalCells }, (_, i) => {
    const day = i - offset + 1;
    return day >= 1 && day <= daysInMonth ? day : null;
  });

  const isCurrentMonth =
    viewYear === today.getFullYear() && viewMonth === today.getMonth();

  function prevMonth() {
    if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11); }
    else setViewMonth((m) => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0); }
    else setViewMonth((m) => m + 1);
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl">
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={prevMonth}
          className="rounded-lg p-1 text-zinc-500 transition-colors hover:bg-white/8 hover:text-zinc-300"
          aria-label="Previous month"
        >
          <ChevronLeft size={14} />
        </button>
        <span className="text-sm font-semibold text-white">
          {MONTH_NAMES[viewMonth]}{viewYear !== today.getFullYear() ? ` ${viewYear}` : ""}
        </span>
        <button
          type="button"
          onClick={nextMonth}
          className="rounded-lg p-1 text-zinc-500 transition-colors hover:bg-white/8 hover:text-zinc-300"
          aria-label="Next month"
        >
          <ChevronRight size={14} />
        </button>
      </div>
      <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[0.62rem] font-mono uppercase tracking-wide text-zinc-500">
        {WEEKDAYS.map((d, i) => (
          <div key={`${d}-${i}`}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (day === null) {
            return <div key={`empty-${i}`} className="aspect-square" />;
          }
          const isToday = isCurrentMonth && day === today.getDate();
          return (
            <motion.button
              type="button"
              key={`${viewYear}-${viewMonth}-${day}`}
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
                isToday
                  ? "aspect-square rounded-lg bg-sky-500 text-[0.7rem] font-bold text-white shadow-lg shadow-sky-500/25"
                  : "aspect-square rounded-lg bg-white/[0.04] text-[0.7rem] text-zinc-400 ring-1 ring-white/6 hover:bg-white/8 hover:text-zinc-200"
              }
            >
              {day}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
