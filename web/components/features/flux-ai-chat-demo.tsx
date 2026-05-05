"use client";

import { motion } from "framer-motion";
import * as React from "react";

import { ChatBubble } from "@/components/features/chat-bubble";

const seed = [
  { id: "1", text: "Quiz me on the Krebs cycle — short answer style.", isUser: true },
  {
    id: "2",
    text: "Here’s Q1: What molecule accepts acetyl to start the cycle, and where does CO₂ first leave?",
    isUser: false,
  },
];

export function AiTypingDots() {
  return (
    <div className="flex items-center gap-1 px-4 py-2">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="inline-block size-2 rounded-full bg-zinc-500"
          animate={{ y: [0, -5, 0], opacity: [0.35, 1, 0.35] }}
          transition={{
            duration: 1.05,
            repeat: Infinity,
            ease: "easeOut",
            delay: i * 0.15,
          }}
        />
      ))}
    </div>
  );
}

export function FluxAiChatDemo() {
  const [thinking, setThinking] = React.useState(false);

  React.useEffect(() => {
    const t = window.setInterval(() => {
      setThinking((s) => !s);
    }, 5400);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="flex min-h-[320px] flex-col gap-3 rounded-2xl border border-white/10 bg-zinc-950/80 p-4 backdrop-blur-xl">
      {seed.map((m) => (
        <ChatBubble key={m.id} text={m.text} isUser={m.isUser} />
      ))}
      <motion.div
        layout
        className="mr-auto rounded-2xl border border-white/8 bg-white/[0.04]"
      >
        {thinking ? (
          <AiTypingDots />
        ) : (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="block max-w-[20rem] px-4 py-2.5 text-sm text-zinc-300"
          >
            Want another question on electron transport instead?
          </motion.span>
        )}
      </motion.div>
    </div>
  );
}
