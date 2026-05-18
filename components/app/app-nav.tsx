"use client";

import Link from "next/link";
import { LockKeyhole, Radio, ShieldCheck, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ACTIVE_CHAIN, formatAddress } from "@/lib/silent-whale";
import { useSilentWhale } from "@/hooks/use-silent-whale";

const links = [
  { href: "/dashboard", label: "Signals" },
  { href: "/analyst", label: "Publish" },
  { href: "/watchlist", label: "Watchlist" },
  { href: "/subscription", label: "Access" },
  { href: "/admin", label: "Admin" },
  { href: "/roadmap", label: "Roadmap" },
];

export function AppNav() {
  const { address, chainId, connect, isConnecting, configured } =
    useSilentWhale();

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-background/86 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-6 px-6 py-4 lg:px-12">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center border border-white/20 bg-white text-black">
            <LockKeyhole className="h-4 w-4" />
          </span>
          <span className="font-display text-2xl tracking-tight">
            SilentWhale
          </span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-white/60 transition-colors hover:text-white"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
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
            className="h-10 rounded-full bg-white px-5 text-sm text-black hover:bg-white/90"
          >
            <Wallet className="mr-2 h-4 w-4" />
            {address ? formatAddress(address) : isConnecting ? "Connecting" : "Connect"}
          </Button>
        </div>
      </div>
    </header>
  );
}
