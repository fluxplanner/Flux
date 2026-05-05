"use client";

import { animate } from "animejs";
import * as React from "react";

import { cn } from "@/lib/utils";

type MagneticButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  children: React.ReactNode;
};

export function MagneticButton({
  children,
  className,
  onMouseMove,
  onMouseLeave,
  onClick,
  type = "button",
  ...rest
}: MagneticButtonProps) {
  const ref = React.useRef<HTMLButtonElement>(null);

  const handleMove = React.useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      onMouseMove?.(e);
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      animate(el, {
        translateX: x * 0.22,
        translateY: y * 0.22,
        duration: 280,
        ease: "out(2)",
      });
    },
    [onMouseMove],
  );

  const reset = React.useCallback(() => {
    const el = ref.current;
    if (!el) return;
    animate(el, {
      translateX: 0,
      translateY: 0,
      duration: 420,
      ease: "out(4)",
    });
  }, []);

  return (
    <button
      ref={ref}
      type={type}
      {...rest}
      onMouseMove={handleMove}
      onMouseLeave={(e) => {
        reset();
        onMouseLeave?.(e);
      }}
      onClick={onClick}
      className={cn(
        "rounded-xl bg-sky-500 px-6 py-3 font-semibold text-zinc-950 shadow-lg shadow-sky-600/35 transition-[box-shadow] hover:shadow-sky-500/45",
        className,
      )}
    >
      {children}
    </button>
  );
}
