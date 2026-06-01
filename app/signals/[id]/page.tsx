"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Archive, Eye, Save } from "lucide-react";
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
  readSignalRecord,
} from "@/lib/silent-whale";

type RevealedSignal = {
  whale?: string;
  amountUsd?: string;
  confidence?: string;
  entry?: string;
  risk?: string;
};

export default function SignalDetailPage() {
  const params = useParams<{ id: string }>();
  const signalId = Number(params.id);
  const { address, connect, getWriteContract, configured } = useSilentWhale();
  const [signal, setSignal] = useState<SignalRecord>();
  const [owner, setOwner] = useState("");
  const [revealed, setRevealed] = useState<RevealedSignal>();
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const loadSignal = useCallback(async () => {
    if (!configured || Number.isNaN(signalId)) return;
    try {
      const contract = getReadOnlyContract();
      if (!contract) return;
      const [nextSignal, contractOwner] = await Promise.all([
        readSignalRecord(contract, signalId),
        contract.owner(),
      ]);
      setSignal(nextSignal);
      setOwner(contractOwner);
    } catch (error: any) {
      setStatus(error?.message || "Could not load signal.");
    }
  }, [configured, signalId]);

  useEffect(() => {
    loadSignal();
  }, [loadSignal]);

  const updateField = (key: keyof SignalRecord, value: string | boolean) => {
    setSignal((current) =>
      current ? ({ ...current, [key]: value } as SignalRecord) : current
    );
  };

  const canEdit = Boolean(
    address &&
      signal &&
      (address.toLowerCase() === signal.analyst.toLowerCase() ||
        address.toLowerCase() === owner.toLowerCase())
  );

  const unlockSignal = async () => {
    if (!signal) return;
    if (!address) {
      await connect();
      return;
    }
    setBusy(true);
    setStatus(`Granting access for signal #${signal.id}`);
    try {
      const contract = await getWriteContract();
      const tx = await contract.grantSignalAccess(signal.id);
      await tx.wait();
      const [whale, amountUsd, confidence, entry, risk] = await Promise.all([
        decryptHandle(address, signal.encryptedWhale, "address"),
        decryptHandle(address, signal.encryptedAmountUsd, "uint64"),
        decryptHandle(address, signal.encryptedConfidenceBps, "uint32"),
        decryptHandle(address, signal.encryptedEntryPriceBps, "uint32"),
        decryptHandle(address, signal.encryptedRiskBps, "uint32"),
      ]);
      setRevealed({
        whale: String(whale),
        amountUsd: formatUsd(amountUsd as bigint),
        confidence: formatBps(confidence as bigint),
        entry: formatBps(entry as bigint),
        risk: formatBps(risk as bigint),
      });
      setStatus("Encrypted details unlocked");
    } catch (error: any) {
      setStatus(error?.shortMessage || error?.message || "Unlock failed.");
    } finally {
      setBusy(false);
    }
  };

  const saveMetadata = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!signal) return;
    if (!canEdit) {
      setStatus("Only the protocol owner or signal analyst can edit this signal.");
      return;
    }
    if (!address) {
      await connect();
      return;
    }
    setBusy(true);
    setStatus("Writing lifecycle update");
    try {
      const contract = await getWriteContract();
      const tx = await contract.updateSignalMetadata(
        signal.id,
        signal.headline,
        signal.publicSummary,
        signal.tokenSymbol,
        signal.sector,
        signal.movementType,
        signal.venue,
        signal.sourceChain,
        signal.eventRef,
        signal.aiModel,
        signal.scoreProvenance,
        signal.minTier,
        signal.active
      );
      await tx.wait();
      setStatus("Signal metadata updated");
      await loadSignal();
    } catch (error: any) {
      setStatus(error?.shortMessage || error?.message || "Update failed.");
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async () => {
    if (!signal) return;
    if (!canEdit) {
      setStatus("Only the protocol owner or signal analyst can update lifecycle state.");
      return;
    }
    if (!address) {
      await connect();
      return;
    }
    setBusy(true);
    setStatus(signal.active ? "Archiving signal" : "Reactivating signal");
    try {
      const contract = await getWriteContract();
      const tx = await contract.setSignalActive(signal.id, !signal.active);
      await tx.wait();
      await loadSignal();
      setStatus(signal.active ? "Signal archived" : "Signal reactivated");
    } catch (error: any) {
      setStatus(error?.shortMessage || error?.message || "Lifecycle update failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageFrame
      eyebrow="Signal Detail"
      title={signal ? `Signal #${signal.id}.` : "Loading signal."}
      copy="Inspect indexed metadata, unlock encrypted fields, and manage lifecycle state from publish to archive."
    >
      {!configured ? (
        <EmptyState title="Contract is not configured." copy="Set the deployed SilentWhale address before opening signal details." />
      ) : !signal ? (
        <EmptyState title="Signal not found." copy="Refresh the dashboard and choose a current signal." />
      ) : (
        <div className="grid gap-12 lg:grid-cols-12">
          <form onSubmit={saveMetadata} className="space-y-7 lg:col-span-7">
            <div className="grid gap-5 md:grid-cols-2">
              {[
                ["headline", "Headline"],
                ["tokenSymbol", "Token"],
                ["sector", "Sector"],
                ["movementType", "Movement"],
                ["venue", "Venue"],
                ["sourceChain", "Source chain"],
                ["eventRef", "Indexer ref"],
                ["aiModel", "Model"],
                ["scoreProvenance", "Score provenance"],
              ].map(([key, label]) => (
                <label key={key} className={key === "headline" ? "md:col-span-2" : ""}>
                  <span className="mb-2 block text-sm text-white/45">{label}</span>
                  <input
                    disabled={!canEdit}
                    value={String(signal[key as keyof SignalRecord] || "")}
                    onChange={(event) =>
                      updateField(key as keyof SignalRecord, event.target.value)
                    }
                    className="w-full border-b border-white/20 bg-transparent py-3 outline-none focus:border-white"
                  />
                </label>
              ))}
            </div>
            <label className="block">
              <span className="mb-2 block text-sm text-white/45">Public summary</span>
              <textarea
                disabled={!canEdit}
                value={signal.publicSummary}
                onChange={(event) => updateField("publicSummary", event.target.value)}
                className="min-h-28 w-full resize-none border-b border-white/20 bg-transparent py-3 outline-none focus:border-white"
              />
            </label>
            <div className="grid gap-5 md:grid-cols-2">
              <label>
                <span className="mb-2 block text-sm text-white/45">Minimum tier</span>
                <select
                  disabled={!canEdit}
                  value={signal.minTier}
                  onChange={(event) =>
                    setSignal((current) =>
                      current
                        ? { ...current, minTier: Number(event.target.value) }
                        : current
                    )
                  }
                  className="w-full border-b border-white/20 bg-background py-3 outline-none"
                >
                  {[1, 2, 3].map((tier) => (
                    <option key={tier} value={tier}>
                      {formatTier(tier)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center justify-between border-y border-white/10 py-4 text-sm text-white/60">
                Active signal
                <input
                  type="checkbox"
                  disabled={!canEdit}
                  checked={signal.active}
                  onChange={(event) => updateField("active", event.target.checked)}
                  className="h-5 w-5 accent-white"
                />
              </label>
            </div>
            {canEdit ? (
            <div className="flex flex-wrap gap-3">
              <Button
                type="submit"
                disabled={busy}
                className="h-11 rounded-full bg-white px-6 text-black hover:bg-white/90"
              >
                <Save className="mr-2 h-4 w-4" />
                Save metadata
              </Button>
              <Button
                type="button"
                disabled={busy}
                onClick={toggleActive}
                variant="outline"
                className="h-11 rounded-full border-white/20 bg-transparent px-6"
              >
                <Archive className="mr-2 h-4 w-4" />
                {signal.active ? "Archive" : "Reactivate"}
              </Button>
            </div>
            ) : (
              <p className="text-sm text-white/45">
                Metadata controls are available only to the analyst or protocol owner.
              </p>
            )}
          </form>

          <aside className="space-y-7 border-t border-white/10 pt-8 lg:col-span-5 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
            <div className="grid gap-3 text-sm text-white/55">
              <p>Analyst: {formatAddress(signal.analyst)}</p>
              <p>Created: {formatDate(signal.createdAt)}</p>
              <p>Updated: {formatDate(signal.updatedAt)}</p>
              <Link
                href={`${ACTIVE_CHAIN.explorer}/address/${signal.analyst}`}
                target="_blank"
                className="w-fit border-b border-white/25 text-white/70"
              >
                Analyst explorer
              </Link>
            </div>
            {revealed ? (
              <div className="grid gap-4">
                {[
                  ["Wallet", formatAddress(revealed.whale)],
                  ["Amount", revealed.amountUsd],
                  ["Confidence", revealed.confidence],
                  ["Entry score", revealed.entry],
                  ["Risk", revealed.risk],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-4 border-b border-white/10 pb-3 text-sm">
                    <span className="text-white/45">{label}</span>
                    <span className="font-mono">{value}</span>
                  </div>
                ))}
              </div>
            ) : (
              <Button
                onClick={unlockSignal}
                disabled={busy || !signal.active}
                className="h-11 rounded-full bg-white px-6 text-black hover:bg-white/90"
              >
                <Eye className="mr-2 h-4 w-4" />
                Unlock encrypted details
              </Button>
            )}
          </aside>
        </div>
      )}
      {status ? <p className="mt-8 text-sm text-white/50">{status}</p> : null}
    </PageFrame>
  );
}
