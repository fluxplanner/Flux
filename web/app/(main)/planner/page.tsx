"use client";

import Link from "next/link";

import { TaskBoard } from "@/components/features/task-board";
import { Button } from "@/components/ui/button";
import { MagneticButton } from "@/components/ui/magnetic-button";

const initial = [
  { id: "t1", title: "Chem lab pre-lab", due: "Tomorrow · 25m" },
  { id: "t2", title: "Lit essay outline", due: "Wed" },
  { id: "t3", title: "SAT practice — reading", due: "Sat morning" },
];

export default function PlannerPage() {
  return (
    <div className="min-h-full px-6 py-10">
      <div className="mx-auto flex max-w-3xl flex-col gap-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-white">Planner</h1>
            <p className="mt-2 text-sm text-zinc-400">
              Drag handles reorder tasks — spring physics on every row.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link href="/ai">Open Flux AI</Link>
            </Button>
            <MagneticButton>New task</MagneticButton>
          </div>
        </div>
        <TaskBoard initial={initial} />
      </div>
    </div>
  );
}
