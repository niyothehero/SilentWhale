import { AppNav } from "@/components/app/app-nav";
import type { ReactNode } from "react";

export function PageFrame({
  eyebrow,
  title,
  copy,
  children,
}: {
  eyebrow: string;
  title: string;
  copy?: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <AppNav />
      <section className="mx-auto max-w-[1400px] px-6 py-10 lg:px-12 lg:py-14">
        <div className="mb-8 grid gap-5 border-b border-white/10 pb-8 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <span className="mb-4 inline-flex items-center gap-3 font-mono text-xs uppercase text-white/45">
              <span className="h-px w-10 bg-white/25" />
              {eyebrow}
            </span>
            <h1 className="font-display text-5xl leading-[0.95] tracking-tight md:text-6xl lg:text-7xl">
              {title}
            </h1>
          </div>
          {copy ? (
            <p className="self-end text-base leading-relaxed text-white/55 lg:col-span-4">
              {copy}
            </p>
          ) : null}
        </div>
        {children}
      </section>
    </main>
  );
}
