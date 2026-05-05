import Link from "next/link";

import { ScrollSection } from "@/components/features/scroll-section";
import { MagneticButton } from "@/components/ui/magnetic-button";

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-[#030306] text-white">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-10 px-6 pt-16 pb-24">
        <header className="text-center">
          <p className="font-mono text-xs uppercase tracking-[0.35em] text-sky-400/90">
            Flux Next
          </p>
          <h1 className="mt-6 text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
            Landing that feels like hardware.
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-zinc-400">
            Apple-style scroll choreography: scale and opacity tied to scroll progress on a tall
            runway.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <MagneticButton className="rounded-2xl px-8 py-3 text-base">Get started</MagneticButton>
            <Link
              href="/"
              className="rounded-2xl border border-white/12 bg-white/[0.03] px-8 py-3 text-base font-semibold text-white transition-colors hover:bg-white/[0.07]"
            >
              Open app shell
            </Link>
          </div>
        </header>
      </div>

      <ScrollSection />

      <footer className="border-t border-white/6 py-12 text-center text-sm text-zinc-500">
        Flux Planner · Next.js showcase co-living with legacy static deployment.
      </footer>
    </div>
  );
}
