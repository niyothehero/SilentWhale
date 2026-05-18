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
      <section className="mx-auto max-w-[1400px] px-6 py-14 lg:px-12 lg:py-20">
        <div className="mb-12 grid gap-6 border-b border-white/10 pb-10 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <span className="mb-6 inline-flex items-center gap-3 font-mono text-sm text-white/45">
              <span className="h-px w-10 bg-white/25" />
              {eyebrow}
            </span>
            <h1 className="font-display text-6xl leading-[0.9] tracking-tight md:text-7xl lg:text-[112px]">
              {title}
            </h1>
          </div>
          {copy ? (
            <p className="self-end text-lg leading-relaxed text-white/55 lg:col-span-4">
              {copy}
            </p>
          ) : null}
        </div>
        {children}
      </section>
    </main>
  );
}
