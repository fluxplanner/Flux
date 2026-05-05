"use client";

import {
  Calculator,
  CalendarDays,
  Home,
  MessageSquareText,
  Search,
  Sparkles,
} from "lucide-react";
import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import * as React from "react";

import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";

type CommandPaletteProps = {
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
};

export function CommandPalette({ open: controlledOpen, onOpenChange }: CommandPaletteProps) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;

  const setNext = React.useCallback(
    (value: boolean) => {
      if (isControlled) onOpenChange?.(value);
      else setInternalOpen(value);
    },
    [isControlled, onOpenChange],
  );

  const router = useRouter();

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setNext(!open);
      }
    };
    const bridge = () => setNext(true);
    window.addEventListener("keydown", down);
    window.addEventListener("flux-open-command", bridge as EventListener);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("flux-open-command", bridge as EventListener);
    };
  }, [open, setNext]);

  function go(href: string) {
    setNext(false);
    router.push(href);
  }

  return (
    <Dialog open={open} onOpenChange={setNext}>
      <DialogContent className="top-[22%] max-w-lg overflow-hidden p-0 ring-1 ring-white/10">
        <span className="sr-only">Command palette</span>
        <Command className="text-zinc-100 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-[0.65rem] [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-zinc-500">
          <div className="flex items-center gap-2 border-b border-white/8 px-3 py-2">
            <Search className="size-4 shrink-0 text-zinc-500" />
            <Command.Input
              placeholder="Jump to planner, AI chat, calendar…"
              className="flex h-10 w-full bg-transparent text-sm text-white outline-none placeholder:text-zinc-500"
            />
          </div>
          <Command.List className="max-h-[min(60vh,420px)] overflow-y-auto p-2 [&_[cmdk-item]]:flex [&_[cmdk-item]]:cursor-pointer [&_[cmdk-item]]:items-center [&_[cmdk-item]]:gap-2 [&_[cmdk-item]]:rounded-xl [&_[cmdk-item]]:px-3 [&_[cmdk-item]]:py-2.5 [&_[cmdk-item][data-selected=true]]:bg-sky-500/15 [&_[cmdk-item][data-selected=true]]:text-white">
            <Command.Empty className="px-4 py-8 text-center text-sm text-zinc-500">
              No matches — keep typing…
            </Command.Empty>

            <Command.Group heading="Navigate">
              <Command.Item value="dashboard home" onSelect={() => go("/")}>
                <Home size={16} /> Dashboard
              </Command.Item>
              <Command.Item value="planner calendar tasks" onSelect={() => go("/planner")}>
                <CalendarDays size={16} /> Planner
              </Command.Item>
              <Command.Item value="flux ai chat tutor" onSelect={() => go("/ai")}>
                <MessageSquareText size={16} /> Flux AI
              </Command.Item>
            </Command.Group>

            <Command.Group heading="Quick">
              <Command.Item value="sign in landing scroll" onSelect={() => go("/sign-in")}>
                <Sparkles size={16} /> Sign-in experience
              </Command.Item>
              <Command.Item
                value="gpa calculator hypothetical"
                onSelect={() => {
                  setNext(false);
                }}
              >
                <Calculator size={16} /> GPA hypothetical (wired later)
              </Command.Item>
            </Command.Group>
          </Command.List>
          <div className="border-t border-white/8 px-4 py-2 text-[0.65rem] text-zinc-500">
            Tip: <kbd className="rounded border border-white/15 bg-white/5 px-1.5 py-0.5 font-mono">⌘K</kbd>{" "}
            toggles palette
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
