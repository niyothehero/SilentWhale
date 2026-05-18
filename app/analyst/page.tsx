"use client";

import { FormEvent, useState } from "react";
import { ethers } from "ethers";
import { Radio, Send, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageFrame } from "@/components/app/page-frame";
import { useSilentWhale } from "@/hooks/use-silent-whale";
import { encryptSignalInputs } from "@/lib/cofhe";
import { formatAddress, formatTier } from "@/lib/silent-whale";

const defaultForm = {
  feedId: "0",
  minTier: "1",
  headline: "Tier-1 wallet accumulated an AI sector token",
  publicSummary:
    "A smart wallet is building a position while public attention is still low.",
  tokenSymbol: "AI",
  sector: "Artificial Intelligence",
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

  const update = (key: keyof typeof defaultForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
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
            disabled={busy}
            className="h-12 rounded-full bg-white px-8 text-black hover:bg-white/90"
          >
            {address ? (
              <>
                <Send className="mr-2 h-4 w-4" />
                {busy ? "Publishing" : "Publish signal"}
              </>
            ) : (
              <>
                <Radio className="mr-2 h-4 w-4" />
                Connect wallet
              </>
            )}
          </Button>

          {status ? <p className="text-sm text-white/50">{status}</p> : null}
        </div>
      </form>
    </PageFrame>
  );
}
