"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Save, ShieldCheck, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/app/empty-state";
import { PageFrame } from "@/components/app/page-frame";
import { useSilentWhale } from "@/hooks/use-silent-whale";
import { decryptHandle } from "@/lib/cofhe";
import {
  ACTIVE_CHAIN,
  AnalystProfileRecord,
  SignalRecord,
  formatAddress,
  formatBps,
  getReadOnlyContract,
  readSignalRecord,
} from "@/lib/silent-whale";

type AnalystCard = AnalystProfileRecord & {
  signalCount: number;
  sectors: string[];
  score?: string;
  hasScore: boolean;
};

export default function AnalystsPage() {
  const { address, connect, getWriteContract, configured } = useSilentWhale();
  const [signals, setSignals] = useState<SignalRecord[]>([]);
  const [profiles, setProfiles] = useState<Record<string, AnalystProfileRecord>>({});
  const [scoreAvailability, setScoreAvailability] = useState<Record<string, boolean>>({});
  const [scores, setScores] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    displayName: "Wave Analyst",
    bio: "Encrypted whale intelligence desk.",
    strategy: "Accumulation, exchange flows, and bridge concentration.",
    uri: "ipfs://silentwhale/profile",
  });
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState("");

  const loadMarketplace = useCallback(async () => {
    if (!configured) return;
    try {
      const contract = getReadOnlyContract();
      if (!contract) return;
      const count = Number(await contract.signalCount());
      const ids = Array.from({ length: count }, (_, index) => count - index - 1);
      const nextSignals = await Promise.all(
        ids.slice(0, 100).map((id) => readSignalRecord(contract, id))
      );
      setSignals(nextSignals);

      const analysts = Array.from(new Set(nextSignals.map((signal) => signal.analyst)));
      const nextProfiles: Record<string, AnalystProfileRecord> = {};
      const nextScoreAvailability: Record<string, boolean> = {};
      await Promise.all(
        analysts.map(async (analyst) => {
          const [profile, hasScore] = await Promise.all([
            contract.getAnalystProfile(analyst),
            contract.hasAnalystScore(analyst),
          ]);
          const key = analyst.toLowerCase();
          nextProfiles[analyst.toLowerCase()] = {
            analyst,
            displayName: profile.displayName || `Analyst ${formatAddress(analyst)}`,
            bio: profile.bio || "No public profile has been published yet.",
            strategy: profile.strategy || "Curated encrypted signal flow.",
            uri: profile.uri,
            updatedAt: Number(profile.updatedAt),
            active: profile.active,
          };
          nextScoreAvailability[key] = Boolean(hasScore);
        })
      );
      setProfiles(nextProfiles);
      setScoreAvailability(nextScoreAvailability);
    } catch (error: any) {
      setStatus(error?.message || "Could not load analyst marketplace.");
    }
  }, [configured]);

  useEffect(() => {
    loadMarketplace();
  }, [loadMarketplace]);

  const analysts = useMemo(() => {
    const byAnalyst = new Map<string, SignalRecord[]>();
    signals.forEach((signal) => {
      const key = signal.analyst.toLowerCase();
      byAnalyst.set(key, [...(byAnalyst.get(key) || []), signal]);
    });
    return Array.from(byAnalyst.entries()).map(([key, rows]) => {
      const profile = profiles[key];
      return {
        analyst: rows[0].analyst,
        displayName: profile?.displayName || `Analyst ${formatAddress(rows[0].analyst)}`,
        bio: profile?.bio || "No public profile has been published yet.",
        strategy: profile?.strategy || "Curated encrypted signal flow.",
        uri: profile?.uri || "",
        updatedAt: profile?.updatedAt || 0,
        active: profile?.active ?? true,
        signalCount: rows.length,
        sectors: Array.from(new Set(rows.map((row) => row.sector))).slice(0, 4),
        score: scores[key],
        hasScore: Boolean(scoreAvailability[key]),
      } satisfies AnalystCard;
    });
  }, [profiles, scoreAvailability, scores, signals]);

  const unlockScore = async (analyst: string) => {
    const key = analyst.toLowerCase();
    if (!scoreAvailability[key]) {
      setStatus("No encrypted reputation score has been published for this analyst yet.");
      return;
    }
    if (!address) {
      await connect();
      return;
    }
    setBusy(analyst);
    setStatus("Granting analyst reputation access");
    try {
      const writeContract = await getWriteContract();
      const tx = await writeContract.grantAnalystScoreAccess(analyst);
      await tx.wait();
      const readContract = getReadOnlyContract();
      if (!readContract) return;
      const handle = await readContract.getAnalystScore(analyst);
      const score = await decryptHandle(address, handle, "uint32");
      setScores((current) => ({
        ...current,
        [analyst.toLowerCase()]: formatBps(score as bigint),
      }));
      setStatus("Analyst reputation unlocked");
    } catch (error: any) {
      setStatus(error?.shortMessage || error?.message || "Reputation unlock failed.");
    } finally {
      setBusy("");
    }
  };

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!address) {
      await connect();
      return;
    }
    setBusy("profile");
    setStatus("Saving analyst profile");
    try {
      const contract = await getWriteContract();
      const tx = await contract.setAnalystProfile(
        form.displayName,
        form.bio,
        form.strategy,
        form.uri
      );
      await tx.wait();
      setStatus("Analyst profile saved");
      await loadMarketplace();
    } catch (error: any) {
      setStatus(error?.shortMessage || error?.message || "Profile save failed.");
    } finally {
      setBusy("");
    }
  };

  return (
    <PageFrame
      eyebrow="Marketplace"
      title="Analyst desks."
      copy="Browse public analyst profiles, feed coverage, signal counts, and encrypted reputation scores unlocked through CoFHE permits."
    >
      {!configured ? (
        <EmptyState title="Contract is not configured." copy="Deploy the Wave 5 contract to enable the analyst marketplace." />
      ) : analysts.length === 0 ? (
        <EmptyState title="No analysts yet." copy="Published signals will create marketplace rows automatically." />
      ) : (
        <div className="grid gap-0 divide-y divide-white/10 border-y border-white/10 lg:grid-cols-3 lg:divide-x lg:divide-y-0">
          {analysts.map((analyst) => (
            <article key={analyst.analyst} className="p-7">
              <div className="mb-6 flex items-center justify-between">
                <ShieldCheck className="h-5 w-5 text-[#67e8f9]" />
                <span className="font-mono text-xs text-white/35">
                  {analyst.signalCount} signals
                </span>
              </div>
              <h2 className="font-display text-4xl">{analyst.displayName}</h2>
              <p className="mt-3 min-h-16 text-sm text-white/50">{analyst.bio}</p>
              <p className="mt-5 text-sm text-white/60">{analyst.strategy}</p>
              <div className="mt-6 flex flex-wrap gap-2">
                {analyst.sectors.map((sector) => (
                  <span key={sector} className="border border-white/10 px-3 py-1 text-xs text-white/45">
                    {sector}
                  </span>
                ))}
              </div>
              <div className="mt-7 space-y-3 text-sm text-white/50">
                <p>Wallet: {formatAddress(analyst.analyst)}</p>
                <Link
                  href={`${ACTIVE_CHAIN.explorer}/address/${analyst.analyst}`}
                  target="_blank"
                  className="inline-flex border-b border-white/25 text-white/70"
                >
                  Explorer
                </Link>
              </div>
              <Button
                onClick={() => unlockScore(analyst.analyst)}
                disabled={busy === analyst.analyst || !analyst.hasScore}
                variant={analyst.hasScore ? "default" : "outline"}
                className={
                  analyst.hasScore
                    ? "mt-8 h-11 w-full rounded-full bg-white text-black hover:bg-white/90"
                    : "mt-8 h-11 w-full rounded-full border-white/20 bg-transparent text-white/45"
                }
              >
                <Star className="mr-2 h-4 w-4" />
                {analyst.score || (analyst.hasScore ? "Unlock reputation" : "No reputation yet")}
              </Button>
            </article>
          ))}
        </div>
      )}

      <form onSubmit={saveProfile} className="mt-12 grid gap-6 border-t border-white/10 pt-8 lg:grid-cols-4">
        <div className="flex items-center gap-3 text-sm text-white/50">
          <Save className="h-5 w-5 text-[#fbbf24]" />
          Publish your profile
        </div>
        {[
          ["displayName", "Display name"],
          ["bio", "Bio"],
          ["strategy", "Strategy"],
          ["uri", "URI"],
        ].map(([key, label]) => (
          <label key={key}>
            <span className="mb-2 block text-sm text-white/45">{label}</span>
            <input
              value={form[key as keyof typeof form]}
              onChange={(event) =>
                setForm((current) => ({ ...current, [key]: event.target.value }))
              }
              className="w-full border-b border-white/20 bg-transparent py-3 outline-none focus:border-white"
            />
          </label>
        ))}
        <Button disabled={busy === "profile"} className="h-11 rounded-full bg-white px-6 text-black hover:bg-white/90 lg:col-start-4">
          {address ? "Save profile" : "Connect wallet"}
        </Button>
      </form>
      {status ? <p className="mt-6 text-sm text-white/50">{status}</p> : null}
    </PageFrame>
  );
}
