"use client";

import { ExternalLink, Maximize2, Minimize2, Presentation } from "lucide-react";
import { motion } from "framer-motion";
import * as React from "react";

type GoogleSlidesEmbedProps = {
  url: string;
  title?: string;
};

function toEmbedUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    // Only ever embed HTTPS docs.google.com presentation URLs. Always rebuild
    // the embed URL from the validated deck id — never pass a raw URL through.
    if (u.protocol !== "https:") return null;
    if (u.hostname !== "docs.google.com") return null;
    const match = u.pathname.match(/\/presentation\/d\/([A-Za-z0-9_-]+)/);
    if (!match) return null;
    return `https://docs.google.com/presentation/d/${match[1]}/embed?start=false&loop=false&delayms=3000`;
  } catch {
    return null;
  }
}

export function GoogleSlidesEmbed({ url, title }: GoogleSlidesEmbedProps) {
  const [expanded, setExpanded] = React.useState(false);
  const embedUrl = toEmbedUrl(url);

  if (!embedUrl) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/8 px-4 py-3">
        <Presentation size={18} className="shrink-0 text-red-400" />
        <p className="text-sm text-red-300">Invalid Google Slides URL</p>
      </div>
    );
  }

  return (
    <motion.div
      layout
      className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/80"
    >
      <div className="flex items-center justify-between border-b border-white/8 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Presentation size={15} className="text-sky-400" />
          <span className="text-sm font-semibold text-white">
            {title ?? "Google Slides"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-white/8 hover:text-zinc-300"
            aria-label="Open in Google Slides"
          >
            <ExternalLink size={14} />
          </a>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-white/8 hover:text-zinc-300"
            aria-label={expanded ? "Collapse" : "Expand"}
          >
            {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      </div>
      <motion.div
        animate={{ height: expanded ? 520 : 260 }}
        transition={{ type: "spring", stiffness: 340, damping: 34 }}
        className="relative overflow-hidden"
      >
        <iframe
          src={embedUrl}
          title={title ?? "Google Slides"}
          allowFullScreen
          sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
          referrerPolicy="no-referrer"
          className="absolute inset-0 h-full w-full border-0"
        />
      </motion.div>
    </motion.div>
  );
}

type SlidesLinkCardProps = {
  url: string;
  title: string;
  slideCount?: number;
  onOpen?: () => void;
};

export function SlidesLinkCard({ url, title, slideCount, onOpen }: SlidesLinkCardProps) {
  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 460, damping: 30 }}
      className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/8 bg-white/[0.04] p-3 hover:border-sky-500/30 hover:bg-sky-500/5"
      onClick={onOpen}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-500/15">
        <Presentation size={16} className="text-sky-400" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-white">{title}</p>
        {slideCount !== undefined && (
          <p className="text-xs text-zinc-500">{slideCount} slides</p>
        )}
      </div>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="shrink-0 text-zinc-600 transition-colors hover:text-zinc-300"
        aria-label="Open externally"
      >
        <ExternalLink size={13} />
      </a>
    </motion.div>
  );
}
