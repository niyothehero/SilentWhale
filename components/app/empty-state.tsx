import Link from "next/link";

export function EmptyState({
  title,
  copy,
  href,
  action,
}: {
  title: string;
  copy: string;
  href?: string;
  action?: string;
}) {
  return (
    <div className="border-y border-white/10 py-12">
      <h2 className="font-display text-4xl">{title}</h2>
      <p className="mt-3 max-w-2xl text-white/55">{copy}</p>
      {href && action ? (
        <Link
          href={href}
          className="mt-8 inline-flex border-b border-white pb-1 text-sm text-white transition-opacity hover:opacity-70"
        >
          {action}
        </Link>
      ) : null}
    </div>
  );
}
