"use client";

import { BookOpen, ChevronDown, ChevronRight, FileText, Layers, Plus, Presentation } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import * as React from "react";

import { GoogleSlidesEmbed } from "@/components/features/google-slides-embed";
import { GlassPanel } from "@/components/ui/glass-panel";
import { ScrollReveal } from "@/components/features/scroll-reveal";
import { Modal, Field, fieldClass } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";

type Lesson = {
  id: string;
  title: string;
  type: "lecture" | "lab" | "discussion" | "assessment";
  slidesUrl?: string;
};

type Unit = {
  id: string;
  number: number;
  title: string;
  description: string;
  lessons: Lesson[];
  slidesUrl?: string;
};

type Subject = {
  id: string;
  name: string;
  color: "sky" | "emerald" | "amber";
  units: Unit[];
};

const SUBJECTS: Subject[] = [
  {
    id: "calc",
    name: "AP Calculus BC",
    color: "sky",
    units: [
      {
        id: "calc-u1",
        number: 1,
        title: "Limits and Continuity",
        description: "Foundational understanding of limits, continuity, and the epsilon-delta definition.",
        slidesUrl: "https://docs.google.com/presentation/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms/edit",
        lessons: [
          { id: "l1", title: "Introduction to Limits", type: "lecture", slidesUrl: "https://docs.google.com/presentation/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms/edit" },
          { id: "l2", title: "One-Sided Limits", type: "lecture" },
          { id: "l3", title: "Continuity and Discontinuities", type: "discussion" },
          { id: "l4", title: "Unit 1 Assessment", type: "assessment" },
        ],
      },
      {
        id: "calc-u2",
        number: 2,
        title: "Differentiation: Definition and Fundamental Properties",
        description: "Derivatives from first principles, power rule, product and quotient rules.",
        lessons: [
          { id: "l5", title: "Average vs. Instantaneous Rate of Change", type: "lecture" },
          { id: "l6", title: "Derivative Rules Practice", type: "lab" },
          { id: "l7", title: "Unit 2 Quiz", type: "assessment" },
        ],
      },
    ],
  },
  {
    id: "bio",
    name: "AP Biology",
    color: "emerald",
    units: [
      {
        id: "bio-u1",
        number: 1,
        title: "Chemistry of Life",
        description: "Water properties, macromolecules, and the biochemical foundations of life.",
        lessons: [
          { id: "l8", title: "Properties of Water", type: "lecture" },
          { id: "l9", title: "Macromolecule Lab", type: "lab" },
          { id: "l10", title: "Enzymes and Catalysis", type: "lecture" },
        ],
      },
      {
        id: "bio-u2",
        number: 2,
        title: "Cell Structure and Function",
        description: "Prokaryotic vs. eukaryotic cells, organelles, and membrane transport.",
        lessons: [
          { id: "l11", title: "Cell Organelles Overview", type: "lecture" },
          { id: "l12", title: "Microscopy Lab", type: "lab" },
          { id: "l13", title: "Membrane Transport Discussion", type: "discussion" },
        ],
      },
    ],
  },
  {
    id: "hist",
    name: "AP US History",
    color: "amber",
    units: [
      {
        id: "hist-u1",
        number: 1,
        title: "Period 1 — 1491–1607",
        description: "Native American civilizations, European contact, and the Columbian Exchange.",
        lessons: [
          { id: "l14", title: "Pre-Columbian Societies", type: "lecture" },
          { id: "l15", title: "European Exploration", type: "discussion" },
          { id: "l16", title: "Document Analysis: Primary Sources", type: "assessment" },
        ],
      },
    ],
  },
];

const LESSON_TYPE_STYLES: Record<Lesson["type"], string> = {
  lecture: "bg-sky-500/15 text-sky-300",
  lab: "bg-emerald-500/15 text-emerald-300",
  discussion: "bg-violet-500/15 text-violet-300",
  assessment: "bg-amber-500/15 text-amber-300",
};

const SUBJECT_COLORS: Record<Subject["color"], string> = {
  sky: "border-sky-500/30 bg-sky-500/8",
  emerald: "border-emerald-500/30 bg-emerald-500/8",
  amber: "border-amber-500/30 bg-amber-500/8",
};

const SUBJECT_ICON_COLORS: Record<Subject["color"], string> = {
  sky: "text-sky-400",
  emerald: "text-emerald-400",
  amber: "text-amber-400",
};

function LessonRow({ lesson }: { lesson: Lesson }) {
  const [showSlides, setShowSlides] = React.useState(false);
  const Icon = lesson.type === "lab" ? FileText : lesson.type === "assessment" ? Layers : BookOpen;

  return (
    <div>
      <div className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-white/4">
        <Icon size={14} className="shrink-0 text-zinc-500" />
        <span className="flex-1 text-sm text-zinc-300">{lesson.title}</span>
        <span className={`rounded-full px-2 py-0.5 text-[0.62rem] font-mono uppercase tracking-wide ${LESSON_TYPE_STYLES[lesson.type]}`}>
          {lesson.type}
        </span>
        {lesson.slidesUrl && (
          <button
            type="button"
            onClick={() => setShowSlides((v) => !v)}
            aria-expanded={showSlides}
            className="flex items-center gap-1 rounded-md px-2 py-0.5 text-[0.65rem] text-sky-400 transition-colors hover:bg-sky-500/10"
          >
            <Presentation size={11} />
            {showSlides ? "Hide" : "Slides"}
          </button>
        )}
      </div>
      <AnimatePresence>
        {showSlides && lesson.slidesUrl && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className="overflow-hidden px-3 pb-3"
          >
            <GoogleSlidesEmbed url={lesson.slidesUrl} title={lesson.title} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function UnitCard({ unit, subjectColor }: { unit: Unit; subjectColor: Subject["color"] }) {
  const [open, setOpen] = React.useState(false);
  const [showUnitSlides, setShowUnitSlides] = React.useState(false);

  return (
    <motion.div layout className="overflow-hidden rounded-xl border border-white/8 bg-zinc-900/60">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-white/4"
      >
        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border text-xs font-bold ${SUBJECT_COLORS[subjectColor]} ${SUBJECT_ICON_COLORS[subjectColor]}`}>
          {unit.number}
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-white">{unit.title}</p>
          <p className="text-xs text-zinc-500">{unit.lessons.length} lessons</p>
        </div>
        {unit.slidesUrl && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowUnitSlides((v) => !v);
            }}
            className="mr-2 flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-sky-400 transition-colors hover:bg-sky-500/10"
          >
            <Presentation size={13} />
            Unit slides
          </button>
        )}
        <motion.div animate={{ rotate: open ? 90 : 0 }} transition={{ type: "spring", stiffness: 400, damping: 32 }}>
          <ChevronRight size={16} className="text-zinc-500" />
        </motion.div>
      </button>

      <AnimatePresence>
        {showUnitSlides && unit.slidesUrl && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden border-t border-white/6 px-4 py-3"
          >
            <GoogleSlidesEmbed url={unit.slidesUrl} title={`Unit ${unit.number}: ${unit.title}`} />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/6 px-2 py-2">
              <p className="mb-2 px-3 text-xs text-zinc-500">{unit.description}</p>
              <div className="flex flex-col gap-0.5">
                {unit.lessons.map((lesson) => (
                  <LessonRow key={lesson.id} lesson={lesson} />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function SubjectSection({ subject }: { subject: Subject }) {
  const [collapsed, setCollapsed] = React.useState(false);
  const totalLessons = subject.units.reduce((s, u) => s + u.lessons.length, 0);

  return (
    <ScrollReveal>
      <GlassPanel>
        <div className="flex items-center gap-3">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${SUBJECT_COLORS[subject.color]}`}>
            <BookOpen size={16} className={SUBJECT_ICON_COLORS[subject.color]} />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-semibold text-white">{subject.name}</h2>
            <p className="text-xs text-zinc-500">{subject.units.length} units · {totalLessons} lessons</p>
          </div>
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            aria-expanded={!collapsed}
            className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-white/8 hover:text-zinc-300"
            aria-label={collapsed ? "Expand" : "Collapse"}
          >
            <motion.div animate={{ rotate: collapsed ? -90 : 0 }} transition={{ type: "spring", stiffness: 400, damping: 32 }}>
              <ChevronDown size={16} />
            </motion.div>
          </button>
        </div>

        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={false}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 flex flex-col gap-2 overflow-hidden"
            >
              {subject.units.map((unit) => (
                <UnitCard key={unit.id} unit={unit} subjectColor={subject.color} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </GlassPanel>
    </ScrollReveal>
  );
}

function AddUnitModal({
  open,
  onClose,
  subjects,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  subjects: Subject[];
  onAdd: (subjectId: string, unit: Unit) => void;
}) {
  const [subjectId, setSubjectId] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [slidesUrl, setSlidesUrl] = React.useState("");

  React.useEffect(() => {
    if (open) {
      setSubjectId(subjects[0]?.id ?? "");
      setTitle("");
      setDescription("");
      setSlidesUrl("");
    }
  }, [open, subjects]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !subjectId) return;
    const subject = subjects.find((s) => s.id === subjectId);
    onAdd(subjectId, {
      id: `unit-${Date.now()}`,
      number: (subject?.units.length ?? 0) + 1,
      title: title.trim(),
      description: description.trim() || "No description yet.",
      lessons: [],
      slidesUrl: slidesUrl.trim() || undefined,
    });
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Add unit">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <div>
          <label htmlFor="add-unit-subject" className="mb-1 block text-xs text-zinc-500">
            Subject
          </label>
          <select
            id="add-unit-subject"
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            className={fieldClass}
          >
            {subjects.map((s) => (
              <option key={s.id} value={s.id} className="bg-zinc-900">
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <Field
          label="Unit title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Unit 3 — Integration"
        />
        <Field
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Short summary of the unit"
        />
        <Field
          label="Slides URL (optional)"
          value={slidesUrl}
          onChange={(e) => setSlidesUrl(e.target.value)}
          placeholder="https://docs.google.com/presentation/d/…"
        />
        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!title.trim()}>
            <Plus size={15} />
            Add unit
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default function UnitsPage() {
  const [subjects, setSubjects] = React.useState<Subject[]>(SUBJECTS);
  const [addOpen, setAddOpen] = React.useState(false);

  function addUnit(subjectId: string, unit: Unit) {
    setSubjects((prev) =>
      prev.map((s) => (s.id === subjectId ? { ...s, units: [...s.units, unit] } : s)),
    );
  }

  return (
    <div className="min-h-full bg-[radial-gradient(700px_350px_at_80%_-10%,rgba(99,102,241,0.10),transparent)] px-6 py-10">
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-indigo-400/90">Curriculum</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">Units &amp; Lessons</h1>
            <p className="mt-2 max-w-lg text-sm text-zinc-400">
              Browse all course units, open lesson slides directly in-app, and track curriculum progress.
            </p>
          </div>
          <Button variant="outline" className="gap-2" onClick={() => setAddOpen(true)}>
            <Plus size={15} />
            Add unit
          </Button>
        </div>

        <div className="space-y-6">
          {subjects.map((subject) => (
            <SubjectSection key={subject.id} subject={subject} />
          ))}
        </div>
      </div>
      <AddUnitModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        subjects={subjects}
        onAdd={addUnit}
      />
    </div>
  );
}
