"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { TaskBoard } from "@/components/features/task-board";
import type { Task } from "@/components/features/task-types";
import { Modal, Field } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { MagneticButton } from "@/components/ui/magnetic-button";

const INITIAL_TASKS: Task[] = [
  { id: "t1", title: "Chem lab pre-lab", due: "Tomorrow · 25m" },
  { id: "t2", title: "Lit essay outline", due: "Wed" },
  { id: "t3", title: "SAT practice — reading", due: "Sat morning" },
];

function NewTaskModal({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (task: Task) => void;
}) {
  const [title, setTitle] = React.useState("");
  const [due, setDue] = React.useState("");

  React.useEffect(() => {
    if (open) {
      setTitle("");
      setDue("");
    }
  }, [open]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    onAdd({ id: `t-${Date.now()}`, title: title.trim(), due: due.trim() || "No due date" });
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="New task">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <Field
          label="Task"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. AP Calc problem set 5.1"
        />
        <Field
          label="Due / time estimate"
          value={due}
          onChange={(e) => setDue(e.target.value)}
          placeholder="e.g. Thu · 30 min est."
        />
        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!title.trim()}>
            <Plus size={15} />
            Add task
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default function PlannerPage() {
  const [tasks, setTasks] = React.useState<Task[]>(INITIAL_TASKS);
  const [modalOpen, setModalOpen] = React.useState(false);

  function addTask(task: Task) {
    setTasks((prev) => [task, ...prev]);
  }

  return (
    <div className="min-h-full px-6 py-10">
      <div className="mx-auto flex max-w-3xl flex-col gap-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-white">Planner</h1>
            <p className="mt-2 text-sm text-zinc-400">
              Drag to reorder — add new tasks with the button below.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link href="/ai">Open Flux AI</Link>
            </Button>
            <MagneticButton onClick={() => setModalOpen(true)}>
              <Plus size={15} className="mr-1" />
              New task
            </MagneticButton>
          </div>
        </div>
        <TaskBoard tasks={tasks} onTasksChange={setTasks} />
      </div>
      <NewTaskModal open={modalOpen} onClose={() => setModalOpen(false)} onAdd={addTask} />
    </div>
  );
}
