"use client";

import { motion, useScroll, useTransform, type MotionValue } from "framer-motion";
import React, { useRef } from "react";
import { BookOpen, Bot, CalendarDays, Sparkles } from "lucide-react";

/** Stock imagery (Unsplash) — student / planning / focus */
const CAPABILITY_IMAGES = {
  campus: "https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=900&q=80",
  notes: "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=900&q=80",
  desk: "https://images.unsplash.com/photo-1497032628192-86f99bcd76bc?auto=format&fit=crop&w=900&q=80",
} as const;

const capabilityCards = [
  {
    title: "Flux AI tutor",
    body: "Study plans, flashcards, and exam prep from your real schedule.",
    icon: Bot,
  },
  {
    title: "Tasks & calendar",
    body: "Due dates, countdowns, and Google Calendar in one place.",
    icon: CalendarDays,
  },
  {
    title: "Notes & vision import",
    body: "Snap a syllabus photo — Flux turns it into structured tasks.",
    icon: BookOpen,
  },
  {
    title: "Whole-school picture",
    body: "GPA, extracurriculars, and workload signals stay in sync.",
    icon: Sparkles,
  },
] as const;

/**
 * Scroll-driven stroke + Flux capability story.
 * Original pattern from svg-follow-scroll; LinePath hooks fixed (no hooks in style object).
 */
function FluxScrollCapabilities() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });

  return (
    <section
      ref={ref}
      className="mx-auto flex min-h-[350vh] w-full max-w-[100vw] flex-col items-center overflow-x-hidden bg-[#FAFDEE] px-4 pb-24 text-[#1F3A4B]"
    >
      <div className="relative mt-24 flex w-full max-w-4xl flex-col items-center justify-center gap-6 text-center lg:mt-32">
        <h1 className="relative z-10 font-jakarta text-5xl font-medium tracking-[-0.08em] sm:text-6xl lg:text-8xl">
          Your semester,
          <br />
          one scroll at a time.
          <br />
          <span className="text-[#0ea5e9]">Flux keeps pace.</span>
        </h1>
        <p className="relative z-10 max-w-2xl font-jakarta text-lg font-medium text-[#1F3A4B]/90 sm:text-xl">
          Scroll to draw the path — then see how Flux turns school chaos into a clear plan.
        </p>

        <LinePath className="pointer-events-none absolute -right-[35%] top-0 z-0 h-[min(120vh,900px)] w-[min(140vw,1278px)] max-w-none opacity-90 sm:-right-[30%]" scrollYProgress={scrollYProgress} />
      </div>

      <div className="mt-32 grid w-full max-w-5xl grid-cols-1 gap-4 sm:grid-cols-3">
        <img
          src={CAPABILITY_IMAGES.campus}
          alt="Students collaborating on campus"
          className="h-48 w-full rounded-2xl object-cover sm:h-56"
          width={900}
          height={600}
          loading="lazy"
        />
        <img
          src={CAPABILITY_IMAGES.notes}
          alt="Open planner and notes"
          className="h-48 w-full rounded-2xl object-cover sm:h-56"
          width={900}
          height={600}
          loading="lazy"
        />
        <img
          src={CAPABILITY_IMAGES.desk}
          alt="Focused study workspace"
          className="h-48 w-full rounded-2xl object-cover sm:col-span-1 sm:h-56 md:col-span-1"
          width={900}
          height={600}
          loading="lazy"
        />
      </div>

      <div className="mt-24 w-full max-w-5xl translate-y-[min(40vh,18rem)] rounded-4xl bg-[#1F3A4B] px-4 pb-12 pt-10 font-jakarta text-[#FAFDEE] sm:translate-y-[25vh]">
        <p className="mb-4 text-center text-xs font-semibold uppercase tracking-[0.2em] text-[#C2F84F]">
          What Flux handles for you
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {capabilityCards.map(({ title, body, icon: Icon }) => (
            <div
              key={title}
              className="flex gap-4 rounded-2xl border border-white/10 bg-white/5 p-5 text-left backdrop-blur-sm"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#C2F84F]/20 text-[#C2F84F]">
                <Icon className="h-5 w-5" strokeWidth={2} aria-hidden />
              </div>
              <div>
                <h2 className="text-lg font-semibold">{title}</h2>
                <p className="mt-1 text-sm leading-relaxed text-[#FAFDEE]/80">{body}</p>
              </div>
            </div>
          ))}
        </div>

        <h2 className="mt-14 text-center text-[clamp(2.5rem,12vw,9rem)] font-bold leading-[0.95] tracking-tighter">
          fluxplanner.app
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-center text-sm text-[#FAFDEE]/75">
          Drop this route into marketing or embed the built bundle from your static site. The main Flux app remains
          HTML-first; this package is an isolated React + Tailwind showcase.
        </p>
      </div>
    </section>
  );
}

/** @deprecated Use `FluxScrollCapabilities`; kept for drop-in parity with the reference demo. */
const Skiper19 = FluxScrollCapabilities;

export { FluxScrollCapabilities, Skiper19 };

function LinePath({
  className,
  scrollYProgress,
}: {
  className?: string;
  scrollYProgress: MotionValue<number>;
}) {
  const pathLength = useTransform(scrollYProgress, [0, 1], [0.12, 1]);
  const strokeDashoffset = useTransform(pathLength, (value) => 1 - value);

  return (
    <svg
      width="1278"
      height="2319"
      viewBox="0 0 1278 2319"
      fill="none"
      overflow="visible"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <motion.path
        d="M876.605 394.131C788.982 335.917 696.198 358.139 691.836 416.303C685.453 501.424 853.722 498.43 941.95 409.714C1016.1 335.156 1008.64 186.907 906.167 142.846C807.014 100.212 712.699 198.494 789.049 245.127C889.053 306.207 986.062 116.979 840.548 43.3233C743.932 -5.58141 678.027 57.1682 672.279 112.188C666.53 167.208 712.538 172.943 736.353 163.088C760.167 153.234 764.14 120.924 746.651 93.3868C717.461 47.4252 638.894 77.8642 601.018 116.979C568.164 150.908 557 201.079 576.467 246.924C593.342 286.664 630.24 310.55 671.68 302.614C756.114 286.446 729.747 206.546 681.86 186.442C630.54 164.898 492 209.318 495.026 287.644C496.837 334.494 518.402 366.466 582.455 367.287C680.013 368.538 771.538 299.456 898.634 292.434C1007.02 286.446 1192.67 309.384 1242.36 382.258C1266.99 418.39 1273.65 443.108 1247.75 474.477C1217.32 511.33 1149.4 511.259 1096.84 466.093C1044.29 420.928 1029.14 380.576 1033.97 324.172C1038.31 273.428 1069.55 228.986 1117.2 216.384C1152.2 207.128 1188.29 213.629 1194.45 245.127C1201.49 281.062 1132.22 280.104 1100.44 272.673C1065.32 264.464 1044.22 234.837 1032.77 201.413C1019.29 162.061 1029.71 131.126 1056.44 100.965C1086.19 67.4032 1143.96 54.5526 1175.78 86.1513C1207.02 117.17 1186.81 143.379 1156.22 166.691C1112.57 199.959 1052.57 186.238 999.784 155.164C957.312 130.164 899.171 63.7054 931.284 26.3214C952.068 2.12513 996.288 3.87363 1007.22 43.58C1018.15 83.2749 1003.56 122.644 975.969 163.376C948.377 204.107 907.272 255.122 913.558 321.045C919.727 385.734 990.968 497.068 1063.84 503.35C1111.46 507.456 1166.79 511.984 1175.68 464.527C1191.52 379.956 1101.26 334.985 1030.29 377.017C971.109 412.064 956.297 483.647 953.797 561.655C947.587 755.413 1197.56 941.828 936.039 1140.66C745.771 1285.32 321.926 950.737 134.536 1202.19C-6.68295 1391.68 -53.4837 1655.38 131.935 1760.5C478.381 1956.91 1124.19 1515 1201.28 1997.83C1273.66 2451.23 100.805 1864.7 303.794 2668.89"
        stroke="#C2F84F"
        strokeWidth="20"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          pathLength,
          strokeDashoffset,
        }}
      />
    </svg>
  );
}
