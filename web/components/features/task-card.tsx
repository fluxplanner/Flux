"use client";

import type { Task } from "@/components/features/task-types";
import { motion } from "framer-motion";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

import { cn } from "@/lib/utils";

type TaskCardProps = {
  task: Task;
  sortable?: boolean;
};

export function TaskCard({ task, sortable }: TaskCardProps) {
  if (!sortable) {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ scale: 1.02, y: -2 }}
        transition={{ type: "spring", stiffness: 460, damping: 30 }}
        className={cn(
          "rounded-xl border border-white/8 bg-white/[0.05] p-4 text-white shadow-lg",
          "ring-1 ring-transparent hover:ring-sky-500/20",
        )}
      >
        <h3 className="font-semibold tracking-tight">{task.title}</h3>
        <p className="mt-1 text-sm text-zinc-400">{task.due}</p>
      </motion.div>
    );
  }

  return <SortableTaskCard task={task} />;
}

function SortableTaskCard({ task }: { task: Task }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 460, damping: 32 }}
      className={cn(
        "flex cursor-grab gap-2 rounded-xl border border-white/8 bg-zinc-900/85 p-3 text-white shadow-lg active:cursor-grabbing",
        isDragging && "border-sky-500/35 shadow-sky-500/15 ring-2 ring-sky-500/30",
      )}
    >
      <button
        type="button"
        className="mt-1 text-zinc-500 hover:text-zinc-300"
        aria-label="Drag"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={18} />
      </button>
      <div>
        <h3 className="font-semibold tracking-tight">{task.title}</h3>
        <p className="mt-1 text-sm text-zinc-400">{task.due}</p>
      </div>
    </motion.div>
  );
}
