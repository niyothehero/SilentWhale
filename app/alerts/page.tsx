"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bell, CheckCheck, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/app/empty-state";
import { PageFrame } from "@/components/app/page-frame";
import { useSilentWhale } from "@/hooks/use-silent-whale";
import {
  AlertRecord,
  formatDate,
  getReadOnlyContract,
  isContractConfigured,
} from "@/lib/silent-whale";

export default function AlertsPage() {
  const { address, connect, getWriteContract, configured } = useSilentWhale();
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState<number>();

  const loadAlerts = useCallback(async () => {
    if (!address || !isContractConfigured()) return;
    try {
      const contract = getReadOnlyContract();
      if (!contract) return;
      const count = Number(await contract.alertCount(address));
      const ids = Array.from({ length: count }, (_, index) => count - index - 1);
      const nextAlerts = await Promise.all(
        ids.map(async (index) => {
          const alert = await contract.getAlert(address, index);
          return {
            index,
            ruleHash: alert.ruleHash,
            signalId: Number(alert.signalId),
            channel: alert.channel,
            deliveryRef: alert.deliveryRef,
            createdAt: Number(alert.createdAt),
            read: alert.read,
          } satisfies AlertRecord;
        })
      );
      setAlerts(nextAlerts);
    } catch (error: any) {
      setStatus(error?.message || "Could not load alert history.");
    }
  }, [address]);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  const markRead = async (alert: AlertRecord) => {
    if (!address) {
      await connect();
      return;
    }
    setBusy(alert.index);
    setStatus("Updating alert state");
    try {
      const contract = await getWriteContract();
      const tx = await contract.markAlertRead(alert.index, !alert.read);
      await tx.wait();
      await loadAlerts();
      setStatus(alert.read ? "Alert marked unread" : "Alert marked read");
    } catch (error: any) {
      setStatus(error?.shortMessage || error?.message || "Alert update failed.");
    } finally {
      setBusy(undefined);
    }
  };

  return (
    <PageFrame
      eyebrow="Alerts"
      title="Private trigger history."
      copy="The indexer records alert receipts with hashed private rules, so delivery can be audited without exposing watchlist strategy."
    >
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 text-sm text-white/50">
          <Bell className="h-5 w-5 text-[#67e8f9]" />
          {address ? `${alerts.length} alerts` : "Connect to read alerts"}
        </div>
        <Button
          onClick={address ? loadAlerts : connect}
          variant="outline"
          className="rounded-full border-white/20 bg-transparent"
          disabled={!configured}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          {address ? "Refresh" : "Connect"}
        </Button>
      </div>

      {!configured ? (
        <EmptyState title="Contract is not configured." copy="Deploy the Wave 5 contract to enable alert receipts." />
      ) : !address ? (
        <EmptyState title="Connect wallet." copy="Alert rows are scoped to the connected account." />
      ) : alerts.length === 0 ? (
        <EmptyState title="No alert receipts yet." copy="Watchlist triggers recorded by the indexer will appear here." />
      ) : (
        <div className="divide-y divide-white/10 border-y border-white/10">
          {alerts.map((alert) => (
            <article key={alert.index} className="grid gap-5 py-6 md:grid-cols-[1fr_auto]">
              <div>
                <div className="mb-3 flex flex-wrap gap-3 font-mono text-xs uppercase tracking-widest text-white/35">
                  <span>#{alert.index}</span>
                  <span>{formatDate(alert.createdAt)}</span>
                  <span>{alert.channel}</span>
                  <span>{alert.read ? "Read" : "Unread"}</span>
                </div>
                <h2 className="font-display text-3xl">Signal #{alert.signalId} matched a private rule</h2>
                <div className="mt-4 grid gap-2 text-xs text-white/35 md:grid-cols-2">
                  <span className="break-all">Rule: {alert.ruleHash}</span>
                  <span className="break-all">Delivery: {alert.deliveryRef}</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Link href={`/signals/${alert.signalId}`} className="rounded-full border border-white/20 px-5 py-2 text-sm text-white/70">
                  Open signal
                </Link>
                <Button
                  onClick={() => markRead(alert)}
                  disabled={busy === alert.index}
                  className="rounded-full bg-white px-5 text-black hover:bg-white/90"
                >
                  <CheckCheck className="mr-2 h-4 w-4" />
                  {alert.read ? "Unread" : "Read"}
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
      {status ? <p className="mt-6 text-sm text-white/50">{status}</p> : null}
    </PageFrame>
  );
}
