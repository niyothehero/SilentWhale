"use client";

import { useCallback, useEffect, useState } from "react";
import { BrowserProvider, Contract, formatEther, formatUnits } from "ethers";
import { Check, Crown, ReceiptText, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageFrame } from "@/components/app/page-frame";
import { useSilentWhale } from "@/hooks/use-silent-whale";
import {
  ERC20_ABI,
  PaymentReceiptRecord,
  SILENT_WHALE_ADDRESS,
  SubscriptionRecord,
  formatDate,
  formatTokenAmount,
  formatTier,
  getReadOnlyContract,
  tierCopy,
} from "@/lib/silent-whale";

export default function SubscriptionPage() {
  const { address, connect, getWriteContract, configured } = useSilentWhale();
  const [prices, setPrices] = useState<Record<number, bigint>>({});
  const [tokenPrices, setTokenPrices] = useState<Record<number, bigint>>({});
  const [tokenEnabled, setTokenEnabled] = useState(false);
  const [paymentToken, setPaymentToken] = useState("");
  const [paymentTokenDecimals, setPaymentTokenDecimals] = useState(6);
  const [receipts, setReceipts] = useState<PaymentReceiptRecord[]>([]);
  const [subscription, setSubscription] = useState<SubscriptionRecord>();
  const [status, setStatus] = useState("");
  const [busyTier, setBusyTier] = useState<string>();

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
      const [token, decimals, enabled, tokenPro, tokenElite, tokenDao] =
        await Promise.all([
          contract.paymentToken(),
          contract.paymentTokenDecimals(),
          contract.paymentTokenEnabled(),
          contract.tierTokenPrice(1),
          contract.tierTokenPrice(2),
          contract.tierTokenPrice(3),
        ]);
      setPaymentToken(token);
      setPaymentTokenDecimals(Number(decimals || 6));
      setTokenEnabled(Boolean(enabled));
      setTokenPrices({ 1: tokenPro, 2: tokenElite, 3: tokenDao });

      if (address) {
        const sub = await contract.subscriptionOf(address);
        setSubscription({
          tier: Number(sub.tier),
          expiresAt: Number(sub.expiresAt),
          active: sub.active,
        });
        const count = Number(await contract.receiptCount(address));
        const ids = Array.from({ length: count }, (_, index) => count - index - 1);
        const nextReceipts = await Promise.all(
          ids.slice(0, 8).map(async (index) => {
            const receipt = await contract.getPaymentReceipt(address, index);
            return {
              index,
              payer: receipt.payer,
              token: receipt.token,
              tier: Number(receipt.tier),
              monthCount: Number(receipt.monthCount),
              amount: receipt.amount,
              paidAt: Number(receipt.paidAt),
              expiresAt: Number(receipt.expiresAt),
            } satisfies PaymentReceiptRecord;
          })
        );
        setReceipts(nextReceipts);
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

    setBusyTier(`eth-${tier}`);
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

  const subscribeWithToken = async (tier: number) => {
    if (!address) {
      await connect();
      return;
    }
    if (!configured || !tokenEnabled || !paymentToken) {
      setStatus("USDC payment is not configured yet.");
      return;
    }
    const price = tokenPrices[tier];
    if (!price) {
      setStatus("Token tier price is not available yet.");
      return;
    }

    setBusyTier(`token-${tier}`);
    setStatus(`Preparing USDC approval for ${formatTier(tier)}`);
    try {
      if (!window.ethereum) throw new Error("Wallet extension not found.");
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const token = new Contract(paymentToken, ERC20_ABI, signer);
      const allowance = await token.allowance(address, SILENT_WHALE_ADDRESS);
      if (allowance < price) {
        const approveTx = await token.approve(SILENT_WHALE_ADDRESS, price);
        await approveTx.wait();
      }
      setStatus(`Subscribing to ${formatTier(tier)} with USDC`);
      const contract = await getWriteContract();
      const tx = await contract.subscribeWithToken(tier, 1);
      await tx.wait();
      setStatus(`${formatTier(tier)} access is active`);
      await loadAccess();
    } catch (error: any) {
      setStatus(error?.shortMessage || error?.message || "USDC subscription failed.");
    } finally {
      setBusyTier(undefined);
    }
  };

  return (
    <PageFrame
      eyebrow="Access"
      title="Subscription"
      copy="Choose the tier your wallet uses to unlock encrypted signals."
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

      <div className="divide-y divide-white/10 border-y border-white/10">
        {tierCopy.map((tier, index) => {
          const price = index === 0 ? BigInt(0) : prices[index] || BigInt(0);
          return (
            <section
              key={tier.name}
              className="grid gap-6 py-7 lg:grid-cols-[220px_180px_minmax(0,1fr)_220px] lg:items-start"
            >
              <div>
                <div className="mb-3 flex items-center gap-3">
                  <span className="font-mono text-xs text-white/35">
                    {String(index).padStart(2, "0")}
                  </span>
                  {subscription?.active && subscription.tier === index ? (
                    <Crown className="h-4 w-4 text-[#fbbf24]" />
                  ) : null}
                </div>
                <h2 className="font-display text-3xl">{tier.name}</h2>
                <p className="mt-2 text-sm text-white/50">{tier.summary}</p>
              </div>
              <p className="font-display text-4xl lg:text-right">
                {index === 0 ? "0" : price ? formatEther(price) : "..."}
                <span className="ml-2 font-sans text-sm text-white/40">ETH</span>
              </p>
              <ul className="grid gap-2 md:grid-cols-2">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-3 text-sm text-white/55">
                    <Check className="h-4 w-4 text-[#67e8f9]" />
                    {feature}
                  </li>
                ))}
              </ul>
              <div className="space-y-3">
                <Button
                  disabled={index === 0 || busyTier === `eth-${index}`}
                  onClick={() => subscribe(index)}
                  className={
                    index === 0
                      ? "h-11 w-full rounded-full border border-white/15 bg-transparent text-white/35"
                      : "h-11 w-full rounded-full bg-white text-black hover:bg-white/90"
                  }
                >
                  {index === 0
                    ? "Included"
                    : busyTier === `eth-${index}`
                      ? "Subscribing"
                      : `Pay ETH`}
                </Button>
                {index > 0 ? (
                  <Button
                    disabled={
                      !tokenEnabled ||
                      !paymentToken ||
                      busyTier === `token-${index}`
                    }
                    onClick={() => subscribeWithToken(index)}
                    variant="outline"
                    className="h-11 w-full rounded-full border-white/20 bg-transparent"
                  >
                    {busyTier === `token-${index}`
                      ? "Subscribing"
                      : tokenPrices[index]
                        ? `Pay ${formatUnits(tokenPrices[index], paymentTokenDecimals)} USDC`
                        : "USDC unavailable"}
                  </Button>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>

      <section className="mt-12 border-y border-white/10 py-8">
        <div className="mb-6 flex items-center gap-3 text-sm text-white/50">
          <ReceiptText className="h-5 w-5 text-[#67e8f9]" />
          Billing history
        </div>
        {receipts.length === 0 ? (
          <p className="text-sm text-white/45">
            Receipts appear after an ETH or USDC subscription settles on-chain.
          </p>
        ) : (
          <div className="divide-y divide-white/10">
            {receipts.map((receipt) => (
              <div
                key={receipt.index}
                className="grid gap-3 py-4 text-sm text-white/55 md:grid-cols-5"
              >
                <span>#{receipt.index}</span>
                <span>{formatTier(receipt.tier)}</span>
                <span>{receipt.monthCount} month</span>
                <span>
                  {receipt.token === "0x0000000000000000000000000000000000000000"
                    ? `${formatEther(receipt.amount)} ETH`
                    : formatTokenAmount(
                        receipt.amount,
                        paymentTokenDecimals,
                        "USDC"
                      )}
                </span>
                <span>{formatDate(receipt.paidAt)}</span>
              </div>
            ))}
          </div>
        )}
      </section>
      {status ? <p className="mt-6 text-sm text-white/50">{status}</p> : null}
    </PageFrame>
  );
}
