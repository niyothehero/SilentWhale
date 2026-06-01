"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LockKeyhole, Radio, ShieldCheck, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ACTIVE_CHAIN, formatAddress } from "@/lib/silent-whale";
import { useSilentWhale } from "@/hooks/use-silent-whale";

const links = [
  { href: "/dashboard", label: "Signals" },
  { href: "/analysts", label: "Analysts" },
  { href: "/analyst", label: "Publish" },
  { href: "/watchlist", label: "Watchlist" },
  { href: "/alerts", label: "Alerts" },
  { href: "/dao", label: "DAO" },
  { href: "/subscription", label: "Access" },
  { href: "/admin", label: "Admin" },
];

export function AppNav() {
  const pathname = usePathname();
  const { address, chainId, connect, isConnecting, configured } =
    useSilentWhale();

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-background/92 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-x-4 gap-y-3 px-5 py-3 sm:px-6 lg:px-10">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center bg-white text-black">
            <LockKeyhole className="h-4 w-4" />
          </span>
          <span className="font-display text-xl tracking-tight">
            SilentWhale
          </span>
        </Link>

        <nav className="order-3 -mx-5 flex w-[calc(100%+2.5rem)] items-center gap-4 overflow-x-auto border-t border-white/10 px-5 pt-3 [scrollbar-width:none] md:gap-5 xl:order-none xl:mx-0 xl:w-auto xl:border-t-0 xl:px-0 xl:pt-0 [&::-webkit-scrollbar]:hidden">
          {links.map((link) => {
            const active =
              pathname === link.href ||
              (link.href !== "/dashboard" && pathname.startsWith(`${link.href}/`));
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`shrink-0 border-b py-1 text-sm transition-colors ${
                  active
                    ? "border-white text-white"
                    : "border-transparent text-white/55 hover:text-white"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-3">
          <span className="hidden items-center gap-2 text-xs text-white/45 lg:flex">
            {configured ? (
              <ShieldCheck className="h-4 w-4 text-[#67e8f9]" />
            ) : (
              <Radio className="h-4 w-4 text-[#fbbf24]" />
            )}
            {chainId === ACTIVE_CHAIN.id
              ? ACTIVE_CHAIN.shortName
              : chainId && configured
                ? `Switch to ${ACTIVE_CHAIN.shortName}`
                : configured
                  ? ACTIVE_CHAIN.shortName
                  : "Contract pending"}
          </span>
          <Button
            onClick={connect}
            disabled={isConnecting}
            className="h-9 rounded-full bg-white px-4 text-sm text-black hover:bg-white/90"
          >
            <Wallet className="mr-2 h-4 w-4" />
            {address ? formatAddress(address) : isConnecting ? "Connecting" : "Connect"}
          </Button>
        </div>
      </div>
    </header>
  );
}
