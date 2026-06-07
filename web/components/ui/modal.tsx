"use client";

import { X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import * as React from "react";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
};

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export const fieldClass =
  "w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-sky-500/50 focus:outline-none focus:ring-1 focus:ring-sky-500/30";

export function Field({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const id = React.useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs text-zinc-500">
        {label}
      </label>
      <input id={id} className={fieldClass} {...props} />
    </div>
  );
}

export function Modal({ open, onClose, title, children }: ModalProps) {
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLElement | null>(null);
  const titleId = React.useId();

  // Capture the element that opened the modal; restore focus to it on close.
  React.useEffect(() => {
    if (open) {
      triggerRef.current = document.activeElement as HTMLElement | null;
      const t = setTimeout(() => {
        const first = dialogRef.current?.querySelector<HTMLElement>(
          'input:not([disabled]), textarea, select, button:not([aria-label="Close"])',
        );
        first?.focus();
      }, 60);
      return () => clearTimeout(t);
    }
    triggerRef.current?.focus?.();
  }, [open]);

  // Esc closes; Tab is trapped inside the dialog.
  React.useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !dialogRef.current) return;
      const items = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
      );
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            ref={dialogRef}
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="fixed left-1/2 top-[22%] z-50 w-full max-w-md -translate-x-1/2 rounded-2xl border border-white/10 bg-zinc-950/95 p-6 shadow-2xl backdrop-blur-xl"
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 id={titleId} className="text-base font-semibold text-white">
                {title}
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="rounded-lg p-1 text-zinc-500 transition-colors hover:bg-white/8 hover:text-zinc-300"
              >
                <X size={16} />
              </button>
            </div>
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
