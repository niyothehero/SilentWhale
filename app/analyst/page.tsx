"use client";

import { FormEvent, useEffect, useState } from "react";
import { ethers } from "ethers";
import { BrainCircuit, Radio, Send, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageFrame } from "@/components/app/page-frame";
import { useSilentWhale } from "@/hooks/use-silent-whale";
import { encryptSignalInputs } from "@/lib/cofhe";
import { scoreSignalDraft } from "@/lib/signal-engine";
import { formatAddress, formatTier, getReadOnlyContract } from "@/lib/silent-whale";

const defaultForm = {
  feedId: "0",
  minTier: "1",
  headline: "Tier-1 wallet accumulated an AI sector token",
  publicSummary:
    "A smart wallet is building a position while public attention is still low.",
  tokenSymbol: "AI",
  sector: "Artificial Intelligence",
  movementType: "Accumulation",
  venue: "DEX",
  sourceChain: "Ethereum Sepolia",
  eventRef: "manual-review",
  aiModel: "silent-score-v1.1",
  scoreProvenance: "manual analyst inputs",
  whale: "0x000000000000000000000000000000000000dEaD",
  amountUsd: "500000",
  confidence: "92",
  entry: "14.4",
  risk: "18",
};

function percentToBps(value: string) {
  return String(Math.round(Number(value || "0") * 100));
}

export default function AnalystPage() {
  const { address, connect, getWriteContract, configured } = useSilentWhale();
  const [form, setForm] = useState(defaultForm);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [canPublish, setCanPublish] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadPublishAccess() {
      if (!address || !configured) {
        setCanPublish(false);
        return;
      }
      try {
        const contract = getReadOnlyContract();
        if (!contract) return;
        const [owner, approved, feed] = await Promise.all([
          contract.owner(),
          contract.approvedAnalysts(address),
          contract.getFeed(Number(form.feedId || "0")),
        ]);
        const account = address.toLowerCase();
        if (active) {
          setCanPublish(
            approved ||
              account === owner.toLowerCase() ||
              account === feed.curator.toLowerCase()
          );
        }
      } catch {
        if (active) setCanPublish(false);
      }
    }
    loadPublishAccess();
    return () => {
      active = false;
    };
  }, [address, configured, form.feedId]);

  const update = (key: keyof typeof defaultForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const runSignalReview = () => {
    if (!ethers.isAddress(form.whale)) {
      setStatus("Enter a valid whale wallet before scoring.");
      return;
    }
    const score = scoreSignalDraft({
      tokenSymbol: form.tokenSymbol,
      sector: form.sector,
      amountUsd: form.amountUsd,
      whale: form.whale,
      venue: form.venue,
      movementType: form.movementType,
    });
    setForm((current) => ({
      ...current,
      confidence: score.confidence,
      entry: score.entry,
      risk: score.risk,
      movementType: score.movementType,
      venue: score.venue,
      sourceChain: score.sourceChain,
      eventRef: score.eventRef,
      aiModel: score.model,
      scoreProvenance: score.provenance,
      publicSummary: current.publicSummary.includes(score.narrative)
        ? current.publicSummary
        : `${current.publicSummary} ${score.narrative}`,
    }));
    setStatus("Signal review generated.");
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!address) {
      await connect();
      return;
    }
    if (!configured) {
      setStatus("Set NEXT_PUBLIC_SILENT_WHALE_ADDRESS after deployment.");
      return;
    }
    if (!ethers.isAddress(form.whale)) {
      setStatus("Enter a valid whale wallet address.");
      return;
    }
    if (!canPublish) {
      setStatus("This wallet is not approved to publish to the selected feed.");
      return;
    }

    setBusy(true);
    setStatus("Preparing encrypted signal inputs");
    try {
      const encrypted = await encryptSignalInputs(
        address,
        {
          whale: form.whale,
          amountUsd: form.amountUsd,
          confidenceBps: percentToBps(form.confidence),
          entryPriceBps: percentToBps(form.entry),
          riskBps: percentToBps(form.risk),
        },
        setStatus
      );

      setStatus("Publishing encrypted handles on-chain");
      const contract = await getWriteContract();
      const tx = await contract.publishSignal(
        BigInt(form.feedId),
        form.headline,
        form.publicSummary,
        form.tokenSymbol,
        form.sector,
        form.movementType,
        form.venue,
        form.sourceChain,
        form.eventRef,
        form.aiModel,
        form.scoreProvenance,
        Number(form.minTier),
        encrypted[0],
        encrypted[1],
        encrypted[2],
        encrypted[3],
        encrypted[4]
      );
      const receipt = await tx.wait();
      setStatus(`Signal published in block ${receipt.blockNumber}`);
    } catch (error: any) {
      setStatus(error?.shortMessage || error?.message || "Publish failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageFrame
      eyebrow="Analyst Console"
      title="Publish encrypted alpha."
      copy="Signal metadata is visible. Wallet, size, confidence, entry, and risk are encrypted client-side before the transaction."
    >
      <form onSubmit={submit} className="grid gap-10 lg:grid-cols-12">
        <div className="space-y-8 lg:col-span-7">
          <label className="block">
            <span className="mb-2 block text-sm text-white/45">Headline</span>
            <input
              value={form.headline}
              onChange={(event) => update("headline", event.target.value)}
              className="w-full border-b border-white/20 bg-transparent py-4 text-3xl font-display outline-none transition-colors focus:border-white"
              required
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm text-white/45">Public summary</span>
            <textarea
              value={form.publicSummary}
              onChange={(event) => update("publicSummary", event.target.value)}
              className="min-h-32 w-full resize-none border-b border-white/20 bg-transparent py-4 text-lg outline-none transition-colors focus:border-white"
              required
            />
          </label>

          <div className="grid gap-6 md:grid-cols-2">
            <label>
              <span className="mb-2 block text-sm text-white/45">Token symbol</span>
              <input
                value={form.tokenSymbol}
                onChange={(event) => update("tokenSymbol", event.target.value)}
                className="w-full border-b border-white/20 bg-transparent py-3 outline-none focus:border-white"
                required
              />
            </label>
            <label>
              <span className="mb-2 block text-sm text-white/45">Sector</span>
              <input
                value={form.sector}
                onChange={(event) => update("sector", event.target.value)}
                className="w-full border-b border-white/20 bg-transparent py-3 outline-none focus:border-white"
                required
              />
            </label>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <label>
              <span className="mb-2 block text-sm text-white/45">Movement</span>
              <select
                value={form.movementType}
                onChange={(event) => update("movementType", event.target.value)}
                className="w-full border-b border-white/20 bg-background py-3 outline-none focus:border-white"
              >
                {["Accumulation", "CEX outflow", "CEX inflow", "Bridge", "LP movement", "Distribution"].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="mb-2 block text-sm text-white/45">Venue</span>
              <select
                value={form.venue}
                onChange={(event) => update("venue", event.target.value)}
                className="w-full border-b border-white/20 bg-background py-3 outline-none focus:border-white"
              >
                {["DEX", "CEX", "Bridge", "LP", "OTC"].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="mb-2 block text-sm text-white/45">Source chain</span>
              <input
                value={form.sourceChain}
                onChange={(event) => update("sourceChain", event.target.value)}
                className="w-full border-b border-white/20 bg-transparent py-3 outline-none focus:border-white"
                required
              />
            </label>
            <label>
              <span className="mb-2 block text-sm text-white/45">Indexer ref</span>
              <input
                value={form.eventRef}
                onChange={(event) => update("eventRef", event.target.value)}
                className="w-full border-b border-white/20 bg-transparent py-3 outline-none focus:border-white"
                required
              />
            </label>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <label>
              <span className="mb-2 block text-sm text-white/45">Feed</span>
              <select
                value={form.feedId}
                onChange={(event) => update("feedId", event.target.value)}
                className="w-full border-b border-white/20 bg-background py-3 outline-none focus:border-white"
              >
                <option value="0">Whale Rotation</option>
                <option value="1">Smart Money Wallets</option>
                <option value="2">DAO Intelligence</option>
              </select>
            </label>
            <label>
              <span className="mb-2 block text-sm text-white/45">Minimum tier</span>
              <select
                value={form.minTier}
                onChange={(event) => update("minTier", event.target.value)}
                className="w-full border-b border-white/20 bg-background py-3 outline-none focus:border-white"
              >
                {[1, 2, 3].map((tier) => (
                  <option key={tier} value={tier}>
                    {formatTier(tier)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <label>
              <span className="mb-2 block text-sm text-white/45">AI model</span>
              <input
                value={form.aiModel}
                onChange={(event) => update("aiModel", event.target.value)}
                className="w-full border-b border-white/20 bg-transparent py-3 outline-none focus:border-white"
                required
              />
            </label>
            <label>
              <span className="mb-2 block text-sm text-white/45">Score provenance</span>
              <input
                value={form.scoreProvenance}
                onChange={(event) => update("scoreProvenance", event.target.value)}
                className="w-full border-b border-white/20 bg-transparent py-3 outline-none focus:border-white"
                required
              />
            </label>
          </div>
        </div>

        <div className="space-y-7 border-t border-white/10 pt-8 lg:col-span-5 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
          <div className="flex items-center gap-3 text-sm text-white/50">
            <Shield className="h-5 w-5 text-[#67e8f9]" />
            Wallet: {formatAddress(address)}
          </div>

          <label className="block">
            <span className="mb-2 block text-sm text-white/45">Whale wallet</span>
            <input
              value={form.whale}
              onChange={(event) => update("whale", event.target.value)}
              className="w-full border-b border-white/20 bg-transparent py-3 font-mono text-sm outline-none focus:border-white"
              required
            />
          </label>

          <div className="grid gap-6 md:grid-cols-2">
            <label>
              <span className="mb-2 block text-sm text-white/45">Amount USD</span>
              <input
                type="number"
                min="0"
                value={form.amountUsd}
                onChange={(event) => update("amountUsd", event.target.value)}
                className="w-full border-b border-white/20 bg-transparent py-3 outline-none focus:border-white"
                required
              />
            </label>
            <label>
              <span className="mb-2 block text-sm text-white/45">Confidence %</span>
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={form.confidence}
                onChange={(event) => update("confidence", event.target.value)}
                className="w-full border-b border-white/20 bg-transparent py-3 outline-none focus:border-white"
                required
              />
            </label>
            <label>
              <span className="mb-2 block text-sm text-white/45">Entry score %</span>
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={form.entry}
                onChange={(event) => update("entry", event.target.value)}
                className="w-full border-b border-white/20 bg-transparent py-3 outline-none focus:border-white"
                required
              />
            </label>
            <label>
              <span className="mb-2 block text-sm text-white/45">Risk %</span>
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={form.risk}
                onChange={(event) => update("risk", event.target.value)}
                className="w-full border-b border-white/20 bg-transparent py-3 outline-none focus:border-white"
                required
              />
            </label>
          </div>

          <Button
            type="submit"
            disabled={busy || Boolean(address && configured && !canPublish)}
            className="h-12 rounded-full bg-white px-8 text-black hover:bg-white/90"
          >
            {address ? (
              <>
                <Send className="mr-2 h-4 w-4" />
                {busy
                  ? "Publishing"
                  : canPublish
                    ? "Publish signal"
                    : "Approval required"}
              </>
            ) : (
              <>
                <Radio className="mr-2 h-4 w-4" />
                Connect wallet
              </>
            )}
          </Button>

          <Button
            type="button"
            onClick={runSignalReview}
            disabled={busy}
            variant="outline"
            className="ml-0 h-12 rounded-full border-white/20 bg-transparent px-8 md:ml-3"
          >
            <BrainCircuit className="mr-2 h-4 w-4" />
            Generate scores
          </Button>

          {status ? <p className="text-sm text-white/50">{status}</p> : null}
        </div>
      </form>
    </PageFrame>
  );
}
