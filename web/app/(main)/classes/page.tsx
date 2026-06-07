"use client";

import {
  Bell, BookOpen, ChevronRight, ClipboardList, Presentation, UserPlus, Users,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import * as React from "react";

import { GoogleSlidesEmbed } from "@/components/features/google-slides-embed";
import { GlassPanel } from "@/components/ui/glass-panel";
import { ScrollReveal } from "@/components/features/scroll-reveal";
import { Modal, Field } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";

type Assignment = {
  id: string;
  title: string;
  due: string;
  submitted: number;
  total: number;
  slidesUrl?: string;
};

type Announcement = {
  id: string;
  text: string;
  date: string;
};

type ClassRecord = {
  id: string;
  name: string;
  period: string;
  studentCount: number;
  currentUnit: string;
  joinCode: string;
  color: "sky" | "violet" | "rose" | "emerald";
  assignments: Assignment[];
  announcements: Announcement[];
  slidesDeckUrl?: string;
};

const CLASSES: ClassRecord[] = [
  {
    id: "c1",
    name: "AP Calculus BC",
    period: "Period 2",
    studentCount: 24,
    currentUnit: "Unit 2 — Differentiation",
    joinCode: "CALC-7X92",
    color: "sky",
    slidesDeckUrl: "https://docs.google.com/presentation/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms/edit",
    assignments: [
      { id: "a1", title: "Problem Set 4.2", due: "Thu Jun 12", submitted: 18, total: 24 },
      { id: "a2", title: "Derivative Rules Quiz", due: "Mon Jun 16", submitted: 0, total: 24, slidesUrl: "https://docs.google.com/presentation/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms/edit" },
    ],
    announcements: [
      { id: "n1", text: "Office hours moved to Thursday 3–4 PM this week.", date: "Jun 5" },
    ],
  },
  {
    id: "c2",
    name: "AP Biology",
    period: "Period 4",
    studentCount: 28,
    currentUnit: "Unit 2 — Cell Structure",
    joinCode: "BIO-3K41",
    color: "emerald",
    assignments: [
      { id: "a3", title: "Microscopy Lab Report", due: "Fri Jun 13", submitted: 21, total: 28 },
    ],
    announcements: [
      { id: "n2", text: "Lab coats required starting next week. Please bring your own.", date: "Jun 4" },
    ],
  },
  {
    id: "c3",
    name: "AP US History",
    period: "Period 6",
    studentCount: 30,
    currentUnit: "Unit 1 — 1491–1607",
    joinCode: "HIST-9P07",
    color: "violet",
    assignments: [
      { id: "a4", title: "Primary Source Analysis", due: "Wed Jun 11", submitted: 28, total: 30 },
      { id: "a5", title: "Period 1 Essay Draft", due: "Fri Jun 20", submitted: 0, total: 30 },
    ],
    announcements: [],
  },
];

const CLASS_COLORS: Record<ClassRecord["color"], { border: string; icon: string; badge: string }> = {
  sky:     { border: "border-sky-500/30",     icon: "text-sky-400",     badge: "bg-sky-500/15 text-sky-300" },
  emerald: { border: "border-emerald-500/30", icon: "text-emerald-400", badge: "bg-emerald-500/15 text-emerald-300" },
  violet:  { border: "border-violet-500/30",  icon: "text-violet-400",  badge: "bg-violet-500/15 text-violet-300" },
  rose:    { border: "border-rose-500/30",    icon: "text-rose-400",    badge: "bg-rose-500/15 text-rose-300" },
};

type Tab = "assignments" | "announcements" | "slides";

function ClassCard({
  cls,
  onPostAnnouncement,
}: {
  cls: ClassRecord;
  onPostAnnouncement: (text: string) => void;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const [tab, setTab] = React.useState<Tab>("assignments");
  const [activeSlides, setActiveSlides] = React.useState<{ url: string; title: string } | null>(null);
  const colors = CLASS_COLORS[cls.color];

  const tabs: { id: Tab; label: string; icon: React.ComponentType<{ size: number }> }[] = [
    { id: "assignments", label: "Assignments", icon: ClipboardList },
    { id: "announcements", label: "Announcements", icon: Bell },
    ...(cls.slidesDeckUrl ? [{ id: "slides" as Tab, label: "Class slides", icon: Presentation }] : []),
  ];

  return (
    <motion.div layout className="overflow-hidden rounded-2xl border border-white/8 bg-zinc-900/60">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-center gap-4 p-5 text-left hover:bg-white/4"
      >
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border bg-white/4 ${colors.border}`}>
          <BookOpen size={18} className={colors.icon} />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-white">{cls.name}</p>
          <p className="mt-0.5 text-xs text-zinc-500">{cls.period} · {cls.currentUnit}</p>
        </div>
        <div className="mr-3 flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-xs text-zinc-500">
            <Users size={13} />
            {cls.studentCount}
          </div>
          <span className={`rounded-full px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-wide ${colors.badge}`}>
            {cls.joinCode}
          </span>
        </div>
        <motion.div animate={{ rotate: expanded ? 90 : 0 }} transition={{ type: "spring", stiffness: 400, damping: 32 }}>
          <ChevronRight size={16} className="text-zinc-500" />
        </motion.div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/8">
              <div className="flex gap-1 px-4 pt-3">
                {tabs.map((t) => {
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTab(t.id)}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                        tab === t.id
                          ? "bg-sky-500/15 text-sky-300"
                          : "text-zinc-500 hover:bg-white/6 hover:text-zinc-300"
                      }`}
                    >
                      <Icon size={13} />
                      {t.label}
                    </button>
                  );
                })}
                <div className="flex-1" />
                <button
                  type="button"
                  className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-zinc-600 transition-colors hover:bg-white/6 hover:text-zinc-300"
                >
                  <UserPlus size={13} />
                  Invite
                </button>
              </div>

              <div className="p-4">
                {tab === "assignments" && (
                  <div className="flex flex-col gap-2">
                    {cls.assignments.length === 0 ? (
                      <p className="py-4 text-center text-sm text-zinc-600">No assignments yet.</p>
                    ) : (
                      cls.assignments.map((a) => (
                        <div key={a.id}>
                          <div className="flex items-center gap-3 rounded-xl border border-white/6 bg-white/[0.03] px-4 py-3">
                            <div className="flex-1">
                              <p className="text-sm font-semibold text-white">{a.title}</p>
                              <p className="mt-0.5 text-xs text-zinc-500">Due {a.due}</p>
                            </div>
                            <div className="mr-3 text-right">
                              <p className="text-sm font-semibold text-white">{a.submitted}/{a.total}</p>
                              <p className="text-xs text-zinc-500">submitted</p>
                            </div>
                            <div className="h-8 w-8 shrink-0">
                              <svg viewBox="0 0 32 32" className="h-full w-full -rotate-90">
                                <circle cx="16" cy="16" r="13" fill="none" strokeWidth="3" className="stroke-white/8" />
                                <circle
                                  cx="16" cy="16" r="13" fill="none" strokeWidth="3"
                                  strokeDasharray={`${(a.submitted / a.total) * 81.7} 81.7`}
                                  strokeLinecap="round"
                                  className={colors.icon.replace("text-", "stroke-")}
                                />
                              </svg>
                            </div>
                            {a.slidesUrl && (
                              <button
                                type="button"
                                onClick={() =>
                                  setActiveSlides(
                                    activeSlides?.url === a.slidesUrl
                                      ? null
                                      : { url: a.slidesUrl!, title: a.title }
                                  )
                                }
                                className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-sky-400 transition-colors hover:bg-sky-500/10"
                              >
                                <Presentation size={12} />
                                Slides
                              </button>
                            )}
                          </div>
                          <AnimatePresence>
                            {activeSlides?.url === a.slidesUrl && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="overflow-hidden pt-2"
                              >
                                <GoogleSlidesEmbed url={activeSlides!.url} title={activeSlides!.title} />
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {tab === "announcements" && (
                  <div className="flex flex-col gap-2">
                    {cls.announcements.length === 0 ? (
                      <p className="py-4 text-center text-sm text-zinc-600">No announcements yet.</p>
                    ) : (
                      cls.announcements.map((ann) => (
                        <div key={ann.id} className="flex gap-3 rounded-xl border border-white/6 bg-white/[0.03] px-4 py-3">
                          <Bell size={15} className="mt-0.5 shrink-0 text-amber-400" />
                          <div>
                            <p className="text-sm text-zinc-200">{ann.text}</p>
                            <p className="mt-1 text-xs text-zinc-600">{ann.date}</p>
                          </div>
                        </div>
                      ))
                    )}
                    <AnnouncementComposer onPost={onPostAnnouncement} />
                  </div>
                )}

                {tab === "slides" && cls.slidesDeckUrl && (
                  <GoogleSlidesEmbed url={cls.slidesDeckUrl} title={`${cls.name} — Class Deck`} />
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

const NEW_CLASS_COLORS: ClassRecord["color"][] = ["sky", "violet", "rose", "emerald"];

function randomCode() {
  return Math.random().toString(36).slice(2, 6).toUpperCase();
}

function AnnouncementComposer({ onPost }: { onPost: (text: string) => void }) {
  const [text, setText] = React.useState("");
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    onPost(text.trim());
    setText("");
  }
  return (
    <form onSubmit={submit} className="mt-1 flex gap-2">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Write an announcement…"
        className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white placeholder:text-zinc-600 focus:border-sky-500/50 focus:outline-none focus:ring-1 focus:ring-sky-500/30"
      />
      <Button type="submit" variant="ghost" disabled={!text.trim()} className="text-xs">
        Post
      </Button>
    </form>
  );
}

function NewClassModal({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (cls: ClassRecord) => void;
}) {
  const [name, setName] = React.useState("");
  const [period, setPeriod] = React.useState("");
  const [currentUnit, setCurrentUnit] = React.useState("");

  React.useEffect(() => {
    if (open) {
      setName("");
      setPeriod("");
      setCurrentUnit("");
    }
  }, [open]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const color = NEW_CLASS_COLORS[Math.floor(Math.random() * NEW_CLASS_COLORS.length)];
    const prefix = name.trim().split(/\s+/)[0].slice(0, 4).toUpperCase();
    onAdd({
      id: `class-${Date.now()}`,
      name: name.trim(),
      period: period.trim() || "Unscheduled",
      studentCount: 0,
      currentUnit: currentUnit.trim() || "Not started",
      joinCode: `${prefix}-${randomCode()}`,
      color,
      assignments: [],
      announcements: [],
    });
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="New class">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <Field
          label="Class name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. AP Physics C"
        />
        <Field
          label="Period"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          placeholder="e.g. Period 3"
        />
        <Field
          label="Current unit"
          value={currentUnit}
          onChange={(e) => setCurrentUnit(e.target.value)}
          placeholder="e.g. Unit 1 — Kinematics"
        />
        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!name.trim()}>
            <Users size={15} />
            Create class
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default function ClassesPage() {
  const [classes, setClasses] = React.useState<ClassRecord[]>(CLASSES);
  const [newClassOpen, setNewClassOpen] = React.useState(false);

  function addClass(cls: ClassRecord) {
    setClasses((prev) => [cls, ...prev]);
  }

  function postAnnouncement(classId: string, text: string) {
    const date = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });
    setClasses((prev) =>
      prev.map((c) =>
        c.id === classId
          ? { ...c, announcements: [{ id: `n-${Date.now()}`, text, date }, ...c.announcements] }
          : c,
      ),
    );
  }

  return (
    <div className="min-h-full bg-[radial-gradient(700px_350px_at_20%_-10%,rgba(56,189,248,0.09),transparent)] px-6 py-10">
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-sky-400/90">Staff view</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">My Classes</h1>
            <p className="mt-2 max-w-lg text-sm text-zinc-400">
              Manage assignments, post announcements, and share slides with each class.
            </p>
          </div>
          <Button variant="outline" className="gap-2" onClick={() => setNewClassOpen(true)}>
            <Users size={15} />
            New class
          </Button>
        </div>

        <ScrollReveal>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { label: "Total students", value: classes.reduce((s, c) => s + c.studentCount, 0) },
              { label: "Active classes", value: classes.length },
              { label: "Open assignments", value: classes.flatMap((c) => c.assignments).filter((a) => a.submitted < a.total).length },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl border border-white/8 bg-white/[0.03] px-5 py-4">
                <p className="text-2xl font-bold text-white">{stat.value}</p>
                <p className="mt-0.5 text-xs text-zinc-500">{stat.label}</p>
              </div>
            ))}
          </div>
        </ScrollReveal>

        <div className="flex flex-col gap-4">
          {classes.map((cls) => (
            <ClassCard
              key={cls.id}
              cls={cls}
              onPostAnnouncement={(text) => postAnnouncement(cls.id, text)}
            />
          ))}
        </div>
      </div>
      <NewClassModal open={newClassOpen} onClose={() => setNewClassOpen(false)} onAdd={addClass} />
    </div>
  );
}
