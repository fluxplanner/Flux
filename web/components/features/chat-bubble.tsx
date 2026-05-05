"use client";

import { motion } from "framer-motion";

type ChatBubbleProps = {
  text: string;
  isUser?: boolean;
};

export function ChatBubble({ text, isUser }: ChatBubbleProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: isUser ? 36 : -36 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: "spring", stiffness: 420, damping: 34 }}
      className={
        isUser
          ? "ml-auto max-w-[min(100%,22rem)] rounded-2xl rounded-br-md bg-gradient-to-br from-sky-500 to-sky-600 px-4 py-2.5 text-sm font-medium text-zinc-950 shadow-lg shadow-sky-600/35"
          : "max-w-[min(100%,22rem)] rounded-2xl rounded-bl-md border border-white/10 bg-white/[0.07] px-4 py-2.5 text-sm text-zinc-100 shadow-inner"
      }
    >
      {text}
    </motion.div>
  );
}
