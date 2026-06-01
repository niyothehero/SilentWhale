"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Eye, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/app/empty-state";
import { PageFrame } from "@/components/app/page-frame";
import { useSilentWhale } from "@/hooks/use-silent-whale";
import { decryptHandle } from "@/lib/cofhe";
import {
  defaultSignalFilters,
  filterSignals,
  paginateSignals,
  uniqueSignalValues,
} from "@/lib/indexer";
import {
  ACTIVE_CHAIN,
  SignalRecord,
  formatAddress,
  formatBps,
  formatDate,
  formatTier,
  formatUsd,
  getReadOnlyContract,
  isContractConfigured,
  readSignalRecord,
} from "@/lib/silent-whale";

type RevealedSignal = {
  whale?: string;
  amountUsd?: string;
  confidence?: string;
  entry?: string;
  risk?: string;
};

const filterControlClass =
  "h-10 w-full border-0 border-b border-white/15 bg-transparent px-0 text-sm text-white outline-none transition-colors focus:border-white/45";

export default function DashboardPage() {
  const { address, connect, getWriteContract, configured } = useSilentWhale();
  const [signals, setSignals] = useState<SignalRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [revealed, setRevealed] = useState<Record<number, RevealedSignal>>({});
  const [filters, setFilters] = useState(defaultSignalFilters);
  const [page, setPage] = useState(1);
  const pageSize = 8;

  const loadSignals = useCallback(async () => {
    if (!isContractConfigured()) return;
    setLoading(true);
    setStatus("");
    try {
      const contract = getReadOnlyContract();
      if (!contract) return;
      const count = Number(await contract.signalCount());
      const ids = Array.from({ length: count }, (_, index) => count - index - 1);
      const nextSignals = await Promise.all(
        ids.slice(0, 80).map((id) => readSignalRecord(contract, id))
      );
      setSignals(nextSignals);
    } catch (error: any) {
      setStatus(error?.message || "Could not load on-chain signals.");
    } finally {
      setLoading(false);
    }
  }, []);

  const filteredSignals = useMemo(
    () => filterSignals(signals, filters),
    [signals, filters]
  );
  const pagedSignals = useMemo(
    () => paginateSignals(filteredSignals, page, pageSize),
    [filteredSignals, page]
  );
  const pageCount = Math.max(1, Math.ceil(filteredSignals.length / pageSize));
  const tokenOptions = uniqueSignalValues(signals, "tokenSymbol");
  const sectorOptions = uniqueSignalValues(signals, "sector");
  const movementOptions = uniqueSignalValues(signals, "movementType");
  const liveCount = signals.filter((signal) => signal.active).length;
  const gatedCount = signals.filter((signal) => signal.minTier > 0).length;
  const latestSignal = signals[0];
  const hasFilters = Boolean(
    filters.query ||
    filters.token ||
    filters.sector ||
    filters.movement ||
    filters.minTier ||
    !filters.activeOnly
  );

  useEffect(() => {
    setPage(1);
  }, [filters]);

  useEffect(() => {
    loadSignals();
  }, [loadSignals]);

  const unlockSignal = async (signal: SignalRecord) => {
    if (!address) {
      await connect();
      return;
    }
    setStatus(`Granting access for signal #${signal.id}`);
    try {
      const contract = await getWriteContract();
      const tx = await contract.grantSignalAccess(signal.id);
      await tx.wait();
      setStatus("Decrypting handles with your permit");
      const [whale, amountUsd, confidence, entry, risk] = await Promise.all([
        decryptHandle(address, signal.encryptedWhale, "address"),
        decryptHandle(address, signal.encryptedAmountUsd, "uint64"),
        decryptHandle(address, signal.encryptedConfidenceBps, "uint32"),
        decryptHandle(address, signal.encryptedEntryPriceBps, "uint32"),
        decryptHandle(address, signal.encryptedRiskBps, "uint32"),
      ]);
      setRevealed((current) => ({
        ...current,
        [signal.id]: {
          whale: String(whale),
          amountUsd: formatUsd(amountUsd as bigint),
          confidence: formatBps(confidence as bigint),
          entry: formatBps(entry as bigint),
          risk: formatBps(risk as bigint),
        },
      }));
      setStatus(`Signal #${signal.id} unlocked`);
    } catch (error: any) {
      setStatus(error?.shortMessage || error?.message || "Unlock failed.");
    }
  };

  return (
    <PageFrame
      eyebrow="On-chain signal desk"
      title="Whale signals"
      copy="Search the public feed, then unlock eligible encrypted fields with your wallet."
    >
      <div className="mb-8 flex flex-wrap items-end justify-between gap-6 border-b border-white/10 pb-6">
        <div className="grid w-full gap-5 sm:grid-cols-3 lg:w-auto lg:min-w-[560px]">
          {[
            ["Signals", configured ? String(signals.length) : "-"],
            ["Live", configured ? String(liveCount) : "-"],
            ["Gated", configured ? String(gatedCount) : "-"],
          ].map(([label, value]) => (
            <div key={label} className="border-l border-white/12 pl-4">
              <div className="font-display text-4xl leading-none">{value}</div>
              <div className="mt-2 text-xs uppercase tracking-[0.18em] text-white/35">
                {label}
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm text-white/45">
          <span>
            {configured
              ? `${filteredSignals.length} shown on ${ACTIVE_CHAIN.shortName}`
              : "Contract not configured"}
          </span>
          {latestSignal ? <span>Latest {formatDate(latestSignal.createdAt)}</span> : null}
        </div>
        <Button
          onClick={loadSignals}
          variant="outline"
          className="h-10 rounded-full border-white/20 bg-transparent px-4"
          disabled={loading || !configured}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          {loading ? "Refreshing" : "Refresh"}
        </Button>
      </div>

      {signals.length > 0 ? (
        <div className="mb-8 grid gap-x-6 gap-y-4 border-b border-white/10 pb-6 md:grid-cols-2 xl:grid-cols-[minmax(260px,1.4fr)_repeat(4,minmax(120px,1fr))_auto_auto]">
          <label className="flex h-10 items-center gap-3 border-b border-white/15">
            <Search className="h-4 w-4 text-white/35" />
            <input
              value={filters.query}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  query: event.target.value,
                }))
              }
              placeholder="Search signals"
              className="w-full bg-transparent text-sm outline-none placeholder:text-white/30"
            />
          </label>
          {[
            ["token", "Token", tokenOptions],
            ["sector", "Sector", sectorOptions],
            ["movement", "Movement", movementOptions],
          ].map(([key, label, options]) => (
            <label key={key as string}>
              <span className="sr-only">{label as string}</span>
              <select
                aria-label={label as string}
                value={filters[key as "token" | "sector" | "movement"]}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    [key as string]: event.target.value,
                  }))
                }
                className={filterControlClass}
              >
                <option value="">All</option>
                {(options as string[]).map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <label>
            <span className="sr-only">Minimum tier</span>
            <select
              aria-label="Minimum tier"
              value={filters.minTier}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  minTier: event.target.value,
                }))
              }
              className={filterControlClass}
            >
              <option value="">All tiers</option>
              {[1, 2, 3].map((tier) => (
                <option key={tier} value={tier}>
                  {formatTier(tier)}+
                </option>
              ))}
            </select>
          </label>
          <label className="flex h-10 items-center justify-between gap-3 border-b border-white/15 text-sm text-white/55">
            Live only
            <input
              type="checkbox"
              checked={filters.activeOnly}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  activeOnly: event.target.checked,
                }))
              }
              className="h-4 w-4 accent-white"
            />
          </label>
          <button
            type="button"
            onClick={() => setFilters(defaultSignalFilters)}
            disabled={!hasFilters}
            className="h-10 text-left text-sm text-white/45 transition-colors hover:text-white disabled:pointer-events-none disabled:opacity-30 xl:text-right"
          >
            Reset
          </button>
        </div>
      ) : null}

      {!configured ? (
        <EmptyState
          title="Contract not configured."
          copy="Set the deployed SilentWhale address before loading live signals."
          href="/admin"
          action="Open admin"
        />
      ) : signals.length === 0 ? (
        <EmptyState
          title="No signals yet."
          copy="This fresh deployment has no published signal history."
        />
      ) : (
        <div className="divide-y divide-white/10 border-y border-white/10">
          {pagedSignals.map((signal) => {
            const unlocked = revealed[signal.id];
            return (
              <article
                key={signal.id}
                className="grid gap-6 py-7 transition-colors hover:bg-white/[0.018] lg:grid-cols-[120px_minmax(0,1fr)_320px]"
              >
                <div className="flex items-start justify-between gap-4 lg:block">
                  <div>
                    <div className="font-mono text-xs text-white/35">#{signal.id}</div>
                    <div className="mt-2 text-sm text-white/55">{formatDate(signal.createdAt)}</div>
                  </div>
                  <div className="text-right lg:mt-5 lg:text-left">
                    <div className="text-xs uppercase tracking-[0.16em] text-white/35">
                      Tier
                    </div>
                    <div className="mt-1 text-sm text-white">{formatTier(signal.minTier)}</div>
                  </div>
                </div>

                <div className="min-w-0">
                  <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-white/40">
                    <span>{signal.tokenSymbol}</span>
                    <span>{signal.sector}</span>
                    <span>{signal.movementType}</span>
                    <span>{signal.venue}</span>
                    {!signal.active ? <span className="text-[#fbbf24]">Archived</span> : null}
                  </div>
                  <h2 className="font-display text-2xl leading-tight md:text-3xl">
                    {signal.headline}
                  </h2>
                  <p className="mt-3 max-w-3xl text-sm leading-relaxed text-white/50">
                    {signal.publicSummary}
                  </p>
                  <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/45">
                    <span>Analyst {formatAddress(signal.analyst)}</span>
                    <span>Source {signal.sourceChain || ACTIVE_CHAIN.shortName}</span>
                    <Link
                      href={`${ACTIVE_CHAIN.explorer}/address/${signal.analyst}`}
                      target="_blank"
                      className="inline-flex items-center gap-1 text-white/70 transition-colors hover:text-white"
                    >
                      Explorer
                      <ArrowUpRight className="h-3 w-3" />
                    </Link>
                    <Link
                      href={`/signals/${signal.id}`}
                      className="inline-flex items-center gap-1 text-white/70 transition-colors hover:text-white"
                    >
                      Details
                      <ArrowUpRight className="h-3 w-3" />
                    </Link>
                  </div>
                </div>

                <div className="self-stretch border-t border-white/10 pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
                  {unlocked ? (
                    <div className="grid gap-4">
                      {[
                        ["Wallet", formatAddress(unlocked.whale)],
                        ["Amount", unlocked.amountUsd],
                        ["Confidence", unlocked.confidence],
                        ["Entry score", unlocked.entry],
                        ["Risk", unlocked.risk],
                      ].map(([label, value]) => (
                        <div
                          key={label}
                          className="flex items-center justify-between gap-4 border-b border-white/10 pb-3"
                        >
                          <span className="text-sm text-white/45">{label}</span>
                          <span className="font-mono text-sm text-white">
                            {value}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex h-full flex-col justify-between gap-5">
                      <div>
                        <div className="text-xs uppercase tracking-[0.16em] text-white/35">
                          Encrypted fields
                        </div>
                        <p className="mt-2 text-sm leading-relaxed text-white/55">
                          Wallet, amount, confidence, entry, and risk stay sealed until access is granted on-chain.
                        </p>
                      </div>
                      <Button
                        onClick={() => unlockSignal(signal)}
                        className="h-10 rounded-full bg-white text-black hover:bg-white/90"
                        disabled={!signal.active}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        {signal.active ? "Unlock" : "Archived"}
                      </Button>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {filteredSignals.length > pageSize ? (
        <div className="mt-8 flex items-center justify-between text-sm text-white/45">
          <span>
            Page {page} of {pageCount}
          </span>
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="rounded-full border-white/20 bg-transparent"
              disabled={page === 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              className="rounded-full border-white/20 bg-transparent"
              disabled={page === pageCount}
              onClick={() =>
                setPage((current) => Math.min(pageCount, current + 1))
              }
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}

      {status ? <p className="mt-6 text-sm text-white/50">{status}</p> : null}
    </PageFrame>
  );
}
