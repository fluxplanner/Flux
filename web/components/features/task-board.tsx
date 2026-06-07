"use client";

import {
  DndContext,
  PointerSensor,
  closestCenter,
  type DragEndEvent,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { motion } from "framer-motion";
import * as React from "react";

import { TaskCard } from "@/components/features/task-card";
import type { Task } from "@/components/features/task-types";

type TaskBoardProps = {
  tasks: Task[];
  onTasksChange: (tasks: Task[]) => void;
};

const listVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.04 },
  },
};

export function TaskBoard({ tasks, onTasksChange }: TaskBoardProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = tasks.findIndex((x) => x.id === active.id);
    const newIdx = tasks.findIndex((x) => x.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    onTasksChange(arrayMove(tasks, oldIdx, newIdx));
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
    >
      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <motion.ul
          className="flex flex-col gap-3"
          variants={listVariants}
          initial="hidden"
          animate="show"
        >
          {tasks.map((task) => (
            <li key={task.id}>
              <TaskCard task={task} sortable />
            </li>
          ))}
        </motion.ul>
      </SortableContext>
    </DndContext>
  );
}
