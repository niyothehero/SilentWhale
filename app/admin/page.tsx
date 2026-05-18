"use client";

import { FormEvent, useState } from "react";
import { ethers, parseEther } from "ethers";
import { Settings, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageFrame } from "@/components/app/page-frame";
import { useSilentWhale } from "@/hooks/use-silent-whale";
import { formatTier } from "@/lib/silent-whale";

export default function AdminPage() {
  const { address, connect, getWriteContract, configured } = useSilentWhale();
  const [analyst, setAnalyst] = useState("");
  const [approved, setApproved] = useState(true);
  const [tier, setTier] = useState("1");
  const [price, setPrice] = useState("0.001");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const requireReady = async () => {
    if (!address) {
      await connect();
      return false;
    }
    if (!configured) {
      setStatus("Set NEXT_PUBLIC_SILENT_WHALE_ADDRESS after deployment.");
      return false;
    }
    return true;
  };

  const updateAnalyst = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!(await requireReady())) return;
    if (!ethers.isAddress(analyst)) {
      setStatus("Enter a valid analyst wallet.");
      return;
    }

    setBusy(true);
    setStatus(`${approved ? "Approving" : "Revoking"} analyst`);
    try {
      const contract = await getWriteContract();
      const tx = await contract.setAnalystStatus(analyst, approved);
      await tx.wait();
      setStatus(`${approved ? "Approved" : "Revoked"} ${analyst}`);
    } catch (error: any) {
      setStatus(error?.shortMessage || error?.message || "Analyst update failed.");
    } finally {
      setBusy(false);
    }
  };

  const updatePrice = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!(await requireReady())) return;

    setBusy(true);
    setStatus(`Updating ${formatTier(Number(tier))} price`);
    try {
      const contract = await getWriteContract();
      const tx = await contract.setTierPrice(Number(tier), parseEther(price || "0"));
      await tx.wait();
      setStatus(`${formatTier(Number(tier))} price updated`);
    } catch (error: any) {
      setStatus(error?.shortMessage || error?.message || "Price update failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageFrame
      eyebrow="Protocol Admin"
      title="Curate access."
      copy="Owner-only controls for analyst approvals and subscription pricing. The contract rejects non-owner writes."
    >
      <div className="grid gap-12 lg:grid-cols-12">
        <form onSubmit={updateAnalyst} className="space-y-7 lg:col-span-6">
          <div className="flex items-center gap-3 text-sm text-white/50">
            <ShieldCheck className="h-5 w-5 text-[#67e8f9]" />
            Analyst allowlist
          </div>
          <label className="block">
            <span className="mb-2 block text-sm text-white/45">Analyst wallet</span>
            <input
              value={analyst}
              onChange={(event) => setAnalyst(event.target.value)}
              placeholder="0x..."
              className="w-full border-b border-white/20 bg-transparent py-3 font-mono text-sm outline-none focus:border-white"
              required
            />
          </label>
          <label className="flex items-center justify-between border-y border-white/10 py-4 text-sm text-white/60">
            Approved analyst
            <input
              type="checkbox"
              checked={approved}
              onChange={(event) => setApproved(event.target.checked)}
              className="h-5 w-5 accent-white"
            />
          </label>
          <Button
            type="submit"
            disabled={busy}
            className="h-12 rounded-full bg-white px-8 text-black hover:bg-white/90"
          >
            <Settings className="mr-2 h-4 w-4" />
            {address ? "Update analyst" : "Connect wallet"}
          </Button>
        </form>

        <form onSubmit={updatePrice} className="space-y-7 border-t border-white/10 pt-8 lg:col-span-6 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
          <div className="flex items-center gap-3 text-sm text-white/50">
            <Settings className="h-5 w-5 text-[#fbbf24]" />
            Subscription prices
          </div>
          <label className="block">
            <span className="mb-2 block text-sm text-white/45">Tier</span>
            <select
              value={tier}
              onChange={(event) => setTier(event.target.value)}
              className="w-full border-b border-white/20 bg-background py-3 outline-none focus:border-white"
            >
              {[1, 2, 3].map((value) => (
                <option key={value} value={value}>
                  {formatTier(value)}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-2 block text-sm text-white/45">Monthly price ETH</span>
            <input
              type="number"
              min="0"
              step="0.0001"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              className="w-full border-b border-white/20 bg-transparent py-3 outline-none focus:border-white"
              required
            />
          </label>
          <Button
            type="submit"
            disabled={busy}
            variant="outline"
            className="h-12 rounded-full border-white/20 bg-transparent px-8"
          >
            Update price
          </Button>
        </form>
      </div>
      {status ? <p className="mt-8 text-sm text-white/50">{status}</p> : null}
    </PageFrame>
  );
}
