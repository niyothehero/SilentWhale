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
      <section className="mx-auto max-w-[1280px] px-5 py-7 sm:px-6 lg:px-10 lg:py-9">
        <div className="mb-7 flex flex-col gap-4 border-b border-white/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <span className="mb-3 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-white/40">
              <span className="h-px w-7 bg-white/20" />
              {eyebrow}
            </span>
            <h1 className="font-display text-4xl leading-none tracking-tight md:text-5xl">
              {title}
            </h1>
          </div>
          {copy ? (
            <p className="max-w-md text-sm leading-6 text-white/55">
              {copy}
            </p>
          ) : null}
        </div>
        {children}
      </section>
    </main>
  );
}
