"use client";

import { useCallback, useEffect, useState } from "react";
import { formatEther } from "ethers";
import { Check, Crown, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageFrame } from "@/components/app/page-frame";
import { useSilentWhale } from "@/hooks/use-silent-whale";
import {
  SubscriptionRecord,
  formatDate,
  formatTier,
  getReadOnlyContract,
  tierCopy,
} from "@/lib/silent-whale";

export default function SubscriptionPage() {
  const { address, connect, getWriteContract, configured } = useSilentWhale();
  const [prices, setPrices] = useState<Record<number, bigint>>({});
  const [subscription, setSubscription] = useState<SubscriptionRecord>();
  const [status, setStatus] = useState("");
  const [busyTier, setBusyTier] = useState<number>();

  const loadAccess = useCallback(async () => {
    if (!configured) return;
    try {
      const contract = getReadOnlyContract();
      if (!contract) return;
      const [pro, elite, dao] = await Promise.all([
        contract.tierPriceWei(1),
        contract.tierPriceWei(2),
        contract.tierPriceWei(3),
      ]);
      setPrices({ 1: pro, 2: elite, 3: dao });

      if (address) {
        const sub = await contract.subscriptionOf(address);
        setSubscription({
          tier: Number(sub.tier),
          expiresAt: Number(sub.expiresAt),
          active: sub.active,
        });
      }
    } catch (error: any) {
      setStatus(error?.message || "Could not load subscription state.");
    }
  }, [address, configured]);

  useEffect(() => {
    loadAccess();
  }, [loadAccess]);

  const subscribe = async (tier: number) => {
    if (!address) {
      await connect();
      return;
    }
    if (!configured) {
      setStatus("Set NEXT_PUBLIC_SILENT_WHALE_ADDRESS after deployment.");
      return;
    }
    const price = prices[tier];
    if (!price) {
      setStatus("Tier price is not available yet.");
      return;
    }

    setBusyTier(tier);
    setStatus(`Subscribing to ${formatTier(tier)}`);
    try {
      const contract = await getWriteContract();
      const tx = await contract.subscribe(tier, 1, { value: price });
      await tx.wait();
      setStatus(`${formatTier(tier)} access is active`);
      await loadAccess();
    } catch (error: any) {
      setStatus(error?.shortMessage || error?.message || "Subscription failed.");
    } finally {
      setBusyTier(undefined);
    }
  };

  return (
    <PageFrame
      eyebrow="Access Market"
      title="Subscribe on-chain."
      copy="Native ETH subscriptions determine which encrypted handles your wallet can unlock."
    >
      <div className="mb-10 flex flex-wrap items-center justify-between gap-4 border-y border-white/10 py-5">
        <div>
          <p className="text-sm text-white/45">Current access</p>
          <p className="font-display text-3xl">
            {subscription?.active ? formatTier(subscription.tier) : "Free"}
          </p>
        </div>
        <div className="text-sm text-white/45">
          {subscription?.active
            ? `Expires ${formatDate(subscription.expiresAt)}`
            : "No active paid tier"}
        </div>
        <Button
          onClick={loadAccess}
          variant="outline"
          className="rounded-full border-white/20 bg-transparent"
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="grid gap-0 divide-y divide-white/10 border-y border-white/10 lg:grid-cols-4 lg:divide-x lg:divide-y-0">
        {tierCopy.map((tier, index) => {
          const price = index === 0 ? BigInt(0) : prices[index] || BigInt(0);
          return (
            <section key={tier.name} className="p-7 lg:min-h-[460px]">
              <div className="mb-8 flex items-center justify-between">
                <span className="font-mono text-xs text-white/35">
                  {String(index).padStart(2, "0")}
                </span>
                {subscription?.active && subscription.tier === index ? (
                  <Crown className="h-5 w-5 text-[#fbbf24]" />
                ) : null}
              </div>
              <h2 className="font-display text-4xl">{tier.name}</h2>
              <p className="mt-3 min-h-14 text-sm text-white/50">
                {tier.summary}
              </p>
              <p className="mt-8 font-display text-5xl">
                {index === 0 ? "0" : price ? formatEther(price) : "..."}
                <span className="ml-2 font-sans text-sm text-white/40">ETH</span>
              </p>
              <ul className="mt-8 space-y-3">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-3 text-sm text-white/55">
                    <Check className="h-4 w-4 text-[#67e8f9]" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Button
                disabled={index === 0 || busyTier === index}
                onClick={() => subscribe(index)}
                className={
                  index === 0
                    ? "mt-10 h-11 w-full rounded-full border border-white/15 bg-transparent text-white/35"
                    : "mt-10 h-11 w-full rounded-full bg-white text-black hover:bg-white/90"
                }
              >
                {index === 0
                  ? "Included"
                  : busyTier === index
                    ? "Subscribing"
                    : `Choose ${tier.name}`}
              </Button>
            </section>
          );
        })}
      </div>
      {status ? <p className="mt-6 text-sm text-white/50">{status}</p> : null}
    </PageFrame>
  );
}
