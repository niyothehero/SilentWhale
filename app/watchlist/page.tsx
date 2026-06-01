"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { ethers } from "ethers";
import { Eye, Plus, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/app/empty-state";
import { PageFrame } from "@/components/app/page-frame";
import { useSilentWhale } from "@/hooks/use-silent-whale";
import { decryptHandle, encryptWatchlistInputs } from "@/lib/cofhe";
import {
  WatchlistRecord,
  formatAddress,
  formatBps,
  formatDate,
  getReadOnlyContract,
  isContractConfigured,
} from "@/lib/silent-whale";

export default function WatchlistPage() {
  const { address, connect, getWriteContract, configured } = useSilentWhale();
  const [wallet, setWallet] = useState("");
  const [note, setNote] = useState("");
  const [threshold, setThreshold] = useState("85");
  const [items, setItems] = useState<WatchlistRecord[]>([]);
  const [revealed, setRevealed] = useState<Record<number, { wallet: string; threshold: string }>>({});
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const loadWatchlist = useCallback(async () => {
    if (!address || !isContractConfigured()) return;
    try {
      const contract = getReadOnlyContract();
      if (!contract) return;
      const count = Number(await contract.watchlistCount(address));
      const nextItems = await Promise.all(
        Array.from({ length: count }, (_, index) => index).map(async (index) => {
          const item = await contract.getWatchlistItem(address, index);
          return {
            index,
            labelHash: item.labelHash,
            publicNote: item.publicNote,
            createdAt: Number(item.createdAt),
            active: item.active,
            encryptedWallet: item.encryptedWallet,
            encryptedMinConfidenceBps: item.encryptedMinConfidenceBps,
          } satisfies WatchlistRecord;
        })
      );
      setItems(nextItems);
    } catch (error: any) {
      setStatus(error?.message || "Could not load watchlist.");
    }
  }, [address]);

  useEffect(() => {
    loadWatchlist();
  }, [loadWatchlist]);

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
    if (!ethers.isAddress(wallet)) {
      setStatus("Enter a valid wallet address.");
      return;
    }

    setBusy(true);
    setStatus("Encrypting watchlist item");
    try {
      const encrypted = await encryptWatchlistInputs(
        address,
        wallet,
        String(Math.round(Number(threshold || "0") * 100)),
        setStatus
      );
      const labelHash = ethers.id(`${address}:${note}:${Date.now()}`);
      const contract = await getWriteContract();
      const tx = await contract.addWatchlistItem(
        labelHash,
        note,
        encrypted[0],
        encrypted[1]
      );
      await tx.wait();
      setStatus("Watchlist item stored on-chain");
      await loadWatchlist();
    } catch (error: any) {
      setStatus(error?.shortMessage || error?.message || "Watchlist write failed.");
    } finally {
      setBusy(false);
    }
  };

  const revealItem = async (item: WatchlistRecord) => {
    if (!address) return connect();
    setStatus(`Decrypting watchlist item #${item.index}`);
    try {
      const [decryptedWallet, minConfidence] = await Promise.all([
        decryptHandle(address, item.encryptedWallet, "address"),
        decryptHandle(address, item.encryptedMinConfidenceBps, "uint32"),
      ]);
      setRevealed((current) => ({
        ...current,
        [item.index]: {
          wallet: String(decryptedWallet),
          threshold: formatBps(minConfidence as bigint),
        },
      }));
      setStatus("Watchlist item decrypted");
    } catch (error: any) {
      setStatus(error?.shortMessage || error?.message || "Decrypt failed.");
    }
  };

  const toggleItem = async (item: WatchlistRecord) => {
    if (!address) return connect();
    setStatus(item.active ? "Archiving watchlist item" : "Reactivating watchlist item");
    try {
      const contract = await getWriteContract();
      const tx = await contract.setWatchlistItemActive(item.index, !item.active);
      await tx.wait();
      await loadWatchlist();
      setStatus(item.active ? "Watchlist item archived" : "Watchlist item reactivated");
    } catch (error: any) {
      setStatus(error?.shortMessage || error?.message || "Watchlist update failed.");
    }
  };

  return (
    <PageFrame
      eyebrow="Private data"
      title="Watchlist"
      copy="Store watched wallets and confidence thresholds as encrypted on-chain handles."
    >
      <div className="grid gap-12 lg:grid-cols-12">
        <form onSubmit={submit} className="space-y-7 lg:col-span-5">
          <div className="flex items-center gap-3 text-sm text-white/50">
            <Shield className="h-5 w-5 text-[#67e8f9]" />
            Owner: {formatAddress(address)}
          </div>
          <label className="block">
            <span className="mb-2 block text-sm text-white/45">Wallet</span>
            <input
              value={wallet}
              onChange={(event) => setWallet(event.target.value)}
              placeholder="0x..."
              className="w-full border-b border-white/20 bg-transparent py-3 font-mono text-sm outline-none focus:border-white"
              required
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm text-white/45">Public note</span>
            <input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Smart-money alert"
              className="w-full border-b border-white/20 bg-transparent py-3 outline-none focus:border-white"
              required
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm text-white/45">Min confidence %</span>
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={threshold}
              onChange={(event) => setThreshold(event.target.value)}
              className="w-full border-b border-white/20 bg-transparent py-3 outline-none focus:border-white"
              required
            />
          </label>
          <Button
            type="submit"
            disabled={busy}
            className="h-12 rounded-full bg-white px-8 text-black hover:bg-white/90"
          >
            <Plus className="mr-2 h-4 w-4" />
            {address ? (busy ? "Saving" : "Add encrypted item") : "Connect wallet"}
          </Button>
        </form>

        <div className="lg:col-span-7">
          {!address ? (
            <EmptyState
              title="Connect to read your watchlist."
              copy="Watchlist rows are scoped to the connected account."
            />
          ) : items.length === 0 ? (
            <EmptyState
              title="No private watchlist items yet."
              copy="Add a wallet and confidence threshold to store the first encrypted watch."
            />
          ) : (
            <div className="divide-y divide-white/10 border-y border-white/10">
              {items.map((item) => {
                const unlocked = revealed[item.index];
                return (
                  <article key={item.index} className="grid gap-6 py-7 md:grid-cols-2">
                    <div>
                      <div className="mb-3 font-mono text-xs uppercase tracking-widest text-white/40">
                        #{item.index} / {formatDate(item.createdAt)} / {item.active ? "Active" : "Inactive"}
                      </div>
                      <h2 className="font-display text-3xl">{item.publicNote}</h2>
                      <p className="mt-3 break-all font-mono text-xs text-white/35">
                        {item.labelHash}
                      </p>
                    </div>
                    <div className="border-t border-white/10 pt-5 md:border-l md:border-t-0 md:pl-6 md:pt-0">
                      {unlocked ? (
                        <div className="space-y-3 text-sm">
                          <p className="flex justify-between gap-4 border-b border-white/10 pb-3">
                            <span className="text-white/45">Wallet</span>
                            <span>{formatAddress(unlocked.wallet)}</span>
                          </p>
                          <p className="flex justify-between gap-4 border-b border-white/10 pb-3">
                            <span className="text-white/45">Threshold</span>
                            <span>{unlocked.threshold}</span>
                          </p>
                        </div>
                      ) : (
                        <Button
                          onClick={() => revealItem(item)}
                          disabled={!item.active}
                          variant="outline"
                          className="rounded-full border-white/20 bg-transparent"
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          Decrypt
                        </Button>
                      )}
                      <Button
                        onClick={() => toggleItem(item)}
                        variant="outline"
                        className="mt-3 rounded-full border-white/20 bg-transparent"
                      >
                        {item.active ? "Archive" : "Reactivate"}
                      </Button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
      {status ? <p className="mt-6 text-sm text-white/50">{status}</p> : null}
    </PageFrame>
  );
}
