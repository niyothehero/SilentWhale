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
    <div className="py-10">
      <h2 className="font-display text-3xl">{title}</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">{copy}</p>
      {href && action ? (
        <Link
          href={href}
          className="mt-6 inline-flex border-b border-white/40 pb-1 text-sm text-white transition-opacity hover:opacity-70"
        >
          {action}
        </Link>
      ) : null}
    </div>
  );
}
