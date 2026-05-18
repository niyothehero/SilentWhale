"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Eye, RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/app/empty-state";
import { PageFrame } from "@/components/app/page-frame";
import { useSilentWhale } from "@/hooks/use-silent-whale";
import { decryptHandle } from "@/lib/cofhe";
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
} from "@/lib/silent-whale";

type RevealedSignal = {
  whale?: string;
  amountUsd?: string;
  confidence?: string;
  entry?: string;
  risk?: string;
};

export default function DashboardPage() {
  const { address, connect, getWriteContract, configured } = useSilentWhale();
  const [signals, setSignals] = useState<SignalRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [revealed, setRevealed] = useState<Record<number, RevealedSignal>>({});

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
        ids.slice(0, 24).map(async (id) => {
          const signal = await contract.getSignal(id);
          return {
            id,
            analyst: signal.analyst,
            feedId: Number(signal.feedId),
            headline: signal.headline,
            publicSummary: signal.publicSummary,
            tokenSymbol: signal.tokenSymbol,
            sector: signal.sector,
            minTier: Number(signal.minTier),
            createdAt: Number(signal.createdAt),
            active: signal.active,
            encryptedWhale: signal.encryptedWhale,
            encryptedAmountUsd: signal.encryptedAmountUsd,
            encryptedConfidenceBps: signal.encryptedConfidenceBps,
            encryptedEntryPriceBps: signal.encryptedEntryPriceBps,
            encryptedRiskBps: signal.encryptedRiskBps,
          } satisfies SignalRecord;
        })
      );
      setSignals(nextSignals);
    } catch (error: any) {
      setStatus(error?.message || "Could not load on-chain signals.");
    } finally {
      setLoading(false);
    }
  }, []);

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
      title="Encrypted signal room."
      copy="Read public context, grant ACL access on-chain, then decrypt the sensitive handles locally."
    >
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="text-sm text-white/45">
          {configured
            ? `${signals.length} signals on ${ACTIVE_CHAIN.shortName}`
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

      {!configured ? (
        <EmptyState
          title="Contract address is pending."
          copy="Deploy SilentWhale and set NEXT_PUBLIC_SILENT_WHALE_ADDRESS to turn this into a live encrypted feed."
          href="/roadmap"
          action="Open deployment notes"
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
          {signals.map((signal) => {
            const unlocked = revealed[signal.id];
            return (
              <article
                key={signal.id}
                className="grid gap-8 py-8 lg:grid-cols-[1.15fr_0.85fr]"
              >
                <div>
                  <div className="mb-4 flex flex-wrap items-center gap-3 font-mono text-xs uppercase tracking-widest text-white/40">
                    <span>#{signal.id}</span>
                    <span>{formatDate(signal.createdAt)}</span>
                    <span>{formatTier(signal.minTier)}</span>
                    <span>{signal.sector}</span>
                  </div>
                  <h2 className="font-display text-4xl leading-tight">
                    {signal.headline}
                  </h2>
                  <p className="mt-4 max-w-3xl text-white/55">
                    {signal.publicSummary}
                  </p>
                  <div className="mt-6 flex flex-wrap gap-x-8 gap-y-2 text-sm text-white/45">
                    <span>Token: {signal.tokenSymbol}</span>
                    <span>Analyst: {formatAddress(signal.analyst)}</span>
                    <Link
                      href={`${ACTIVE_CHAIN.explorer}/address/${signal.analyst}`}
                      target="_blank"
                      className="border-b border-white/25 text-white/65"
                    >
                      Explorer
                    </Link>
                  </div>
                </div>

                <div className="self-stretch border-l border-white/10 pl-6">
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
                    <div className="flex h-full flex-col justify-between gap-8">
                      <div className="flex items-start gap-3 text-white/55">
                        <ShieldCheck className="mt-1 h-5 w-5 text-[#67e8f9]" />
                        <p>
                          Sensitive fields are stored as FHE handles. Your wallet
                          must be granted access before local decrypt.
                        </p>
                      </div>
                      <Button
                        onClick={() => unlockSignal(signal)}
                        className="rounded-full bg-white text-black hover:bg-white/90"
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        Unlock encrypted details
                      </Button>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {status ? <p className="mt-6 text-sm text-white/50">{status}</p> : null}
    </PageFrame>
  );
}
