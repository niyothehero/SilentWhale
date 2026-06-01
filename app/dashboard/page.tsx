"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Eye, RefreshCw, Search, ShieldCheck } from "lucide-react";
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
  "h-11 w-full border border-white/10 bg-background px-3 text-sm text-white outline-none transition-colors focus:border-white/40";

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
      eyebrow="Live Intelligence"
      title="Signal dashboard."
      copy="Browse live signals, unlock private fields with your wallet, and open details when you need the full context."
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="text-sm text-white/45">
          {configured
            ? `${filteredSignals.length} of ${signals.length} signals on ${ACTIVE_CHAIN.shortName}`
            : "No deployed contract configured"}
        </div>
        <Button
          onClick={loadSignals}
          variant="outline"
          className="rounded-full border-white/20 bg-transparent"
          disabled={loading || !configured}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          {loading ? "Refreshing" : "Refresh"}
        </Button>
      </div>

      {signals.length > 0 ? (
        <div className="mb-6 grid gap-3 border-y border-white/10 py-4 md:grid-cols-2 xl:grid-cols-[minmax(240px,1.5fr)_repeat(4,minmax(120px,1fr))_auto]">
          <label className="flex h-11 items-center gap-3 border border-white/10 px-3">
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
          <label className="flex h-11 items-center justify-between gap-3 border border-white/10 px-3 text-sm text-white/55">
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
        </div>
      ) : null}

      {!configured ? (
        <EmptyState
          title="Contract address is pending."
          copy="Deploy SilentWhale and set NEXT_PUBLIC_SILENT_WHALE_ADDRESS to turn this into a live encrypted feed."
          href="/admin"
          action="Open admin"
        />
      ) : signals.length === 0 ? (
        <EmptyState
          title="No signal has been published yet."
          copy="The analyst console can publish the first encrypted whale signal once your wallet is connected."
          href="/analyst"
          action="Publish a signal"
        />
      ) : (
        <div className="divide-y divide-white/10 border-y border-white/10">
          {pagedSignals.map((signal) => {
            const unlocked = revealed[signal.id];
            return (
              <article
                key={signal.id}
                className="grid gap-6 py-6 lg:grid-cols-[minmax(0,1fr)_280px]"
              >
                <div>
                  <div className="mb-3 flex flex-wrap items-center gap-2 font-mono text-xs uppercase text-white/40">
                    <span>#{signal.id}</span>
                    <span>{formatDate(signal.createdAt)}</span>
                    <span>{formatTier(signal.minTier)}</span>
                    <span>{signal.sector}</span>
                    <span>{signal.movementType}</span>
                    <span>{signal.venue}</span>
                    {!signal.active ? <span>Inactive</span> : null}
                  </div>
                  <h2 className="font-display text-3xl leading-tight md:text-4xl">
                    {signal.headline}
                  </h2>
                  <p className="mt-3 max-w-3xl text-sm leading-relaxed text-white/55 md:text-base">
                    {signal.publicSummary}
                  </p>
                  <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/45">
                    <span>Token: {signal.tokenSymbol}</span>
                    <span>Analyst: {formatAddress(signal.analyst)}</span>
                    <Link
                      href={`${ACTIVE_CHAIN.explorer}/address/${signal.analyst}`}
                      target="_blank"
                      className="border-b border-white/25 text-white/65"
                    >
                      Explorer
                    </Link>
                    <Link
                      href={`/signals/${signal.id}`}
                      className="border-b border-white/25 text-white/65"
                    >
                      Details
                    </Link>
                  </div>
                  <div className="mt-4 text-xs text-white/35">
                    Source: {signal.sourceChain || ACTIVE_CHAIN.shortName}
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
                    <div className="flex h-full flex-col justify-between gap-6">
                      <div className="flex items-start gap-3 text-white/55">
                        <ShieldCheck className="mt-1 h-5 w-5 text-[#67e8f9]" />
                        <p className="text-sm leading-relaxed">
                          Private fields unlock only after an on-chain ACL grant.
                        </p>
                      </div>
                      <Button
                        onClick={() => unlockSignal(signal)}
                        className="rounded-full bg-white text-black hover:bg-white/90"
                        disabled={!signal.active}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        {signal.active ? "Unlock encrypted details" : "Signal archived"}
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
