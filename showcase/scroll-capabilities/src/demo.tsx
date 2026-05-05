import { FluxScrollCapabilities } from "@/components/ui/svg-follow-scroll";
import { DraggableGradientIcon } from "@/components/ui/swipe-animation";

export default function DemoOne() {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <section className="border-b border-white/10 py-12 md:py-16">
        <p className="mb-2 text-center text-xs font-semibold uppercase tracking-[0.2em] text-white/45">
          Interaction
        </p>
        <h2 className="mb-2 text-center text-xl font-bold tracking-tight md:text-2xl">
          Draggable gradient icon
        </h2>
        <p className="mx-auto mb-8 max-w-md text-center text-sm text-white/55">
          Drag the card horizontally — background, stroke, and paths respond via{" "}
          <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs">
            motion/react
          </code>
          .
        </p>
        <DraggableGradientIcon />
      </section>
      <FluxScrollCapabilities />
    </div>
  );
}
