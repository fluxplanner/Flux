"use client";

import Link from "next/link";

import { FluxAiChatDemo } from "@/components/features/flux-ai-chat-demo";
import { Button } from "@/components/ui/button";
import { GlassPanel } from "@/components/ui/glass-panel";

export default function AiPage() {
  return (
    <div className="min-h-full bg-[radial-gradient(800px_380px_at_100%_0%,rgba(147,51,234,0.14),transparent)] px-6 py-10">
      <div className="mx-auto flex max-w-4xl flex-col gap-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-white">Flux AI</h1>
            <p className="mt-2 max-w-lg text-sm text-zinc-400">
              Chat bubbles with directional springs + live typing rhythm — wire your model behind
              this surface.
            </p>
          </div>
          <Button variant="secondary" asChild>
            <Link href="/planner">Back to planner</Link>
          </Button>
        </div>
        <GlassPanel glow>
          <FluxAiChatDemo />
        </GlassPanel>
      </div>
    </div>
  );
}
