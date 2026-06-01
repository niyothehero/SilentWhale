"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Contract, JsonRpcProvider, ethers, formatEther, parseEther, parseUnits } from "ethers";
import { Bell, Coins, Settings, ShieldCheck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/app/empty-state";
import { PageFrame } from "@/components/app/page-frame";
import { useSilentWhale } from "@/hooks/use-silent-whale";
import {
  ACTIVE_CHAIN,
  ERC20_ABI,
  FeedRecord,
  SILENT_WHALE_ADDRESS,
  formatAddress,
  formatTokenAmount,
  formatTier,
  getReadOnlyContract,
} from "@/lib/silent-whale";

const zeroAddress = "0x0000000000000000000000000000000000000000";

type AdminConfirmation = {
  title: string;
  details: string;
  actionLabel: string;
  run: () => Promise<void>;
};

export default function AdminPage() {
  const { address, connect, getWriteContract, configured } = useSilentWhale();
  const [analyst, setAnalyst] = useState("");
  const [approved, setApproved] = useState(true);
  const [tier, setTier] = useState("1");
  const [price, setPrice] = useState("0.001");
  const [tokenAddress, setTokenAddress] = useState("");
  const [tokenEnabled, setTokenEnabled] = useState(false);
  const [tokenTier, setTokenTier] = useState("1");
  const [tokenPrice, setTokenPrice] = useState("19");
  const [tokenDecimals, setTokenDecimals] = useState("6");
  const [grantAccount, setGrantAccount] = useState("");
  const [grantTier, setGrantTier] = useState("1");
  const [grantDays, setGrantDays] = useState("30");
  const [withdrawRecipient, setWithdrawRecipient] = useState("");
  const [withdrawTokenAmount, setWithdrawTokenAmount] = useState("");
  const [feed, setFeed] = useState({
    id: "",
    name: "Wave 5 Feed",
    description: "Curated encrypted whale movement feed.",
    minTier: "1",
    monthlyPrice: "0.001",
    curator: "",
    active: true,
  });
  const [alertForm, setAlertForm] = useState({
    account: "",
    signalId: "",
    ruleHash: "",
    channel: "in-app",
    deliveryRef: "",
  });
  const [cooldown, setCooldown] = useState("0");
  const [feeds, setFeeds] = useState<FeedRecord[]>([]);
  const [stats, setStats] = useState({
    owner: "",
    signals: 0,
    feeds: 0,
    teams: 0,
    nativeBalance: BigInt(0),
    tokenBalance: BigInt(0),
  });
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState<AdminConfirmation | null>(null);
  const isOwner = Boolean(
    address &&
      stats.owner &&
      address.toLowerCase() === stats.owner.toLowerCase()
  );

  const loadAdmin = useCallback(async () => {
    if (!configured) return;
    try {
      const contract = getReadOnlyContract();
      if (!contract) return;
      const [owner, signalCount, feedCount, teamCount, token, decimals, enabled, currentCooldown] =
        await Promise.all([
          contract.owner(),
          contract.signalCount(),
          contract.feedCount(),
          contract.teamCount(),
          contract.paymentToken(),
          contract.paymentTokenDecimals(),
          contract.paymentTokenEnabled(),
          contract.publishCooldownSeconds(),
        ]);
      setTokenAddress(token === zeroAddress ? "" : token);
      setTokenEnabled(Boolean(enabled));
      setTokenDecimals(String(Number(decimals || 6)));
      setCooldown(String(Number(currentCooldown)));

      const nextFeeds = await Promise.all(
        Array.from({ length: Number(feedCount) }, (_, id) => id).map(async (id) => {
          const row = await contract.getFeed(id);
          return {
            id,
            name: row.name,
            description: row.description,
            minTier: Number(row.minTier),
            monthlyPriceWei: row.monthlyPriceWei,
            active: row.active,
            curator: row.curator,
          } satisfies FeedRecord;
        })
      );
      setFeeds(nextFeeds);

      const provider = new JsonRpcProvider(ACTIVE_CHAIN.rpcUrl, ACTIVE_CHAIN.id);
      const nativeBalance = await provider.getBalance(SILENT_WHALE_ADDRESS);
      let tokenBalance = BigInt(0);
      if (token !== zeroAddress) {
        const erc20 = new Contract(token, ERC20_ABI, provider);
        tokenBalance = await erc20.balanceOf(SILENT_WHALE_ADDRESS);
      }
      setStats({
        owner,
        signals: Number(signalCount),
        feeds: Number(feedCount),
        teams: Number(teamCount),
        nativeBalance,
        tokenBalance,
      });
    } catch (error: any) {
      setStatus(error?.message || "Could not load admin state.");
    }
  }, [configured]);

  useEffect(() => {
    loadAdmin();
  }, [loadAdmin]);

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

  const runWrite = async (label: string, action: () => Promise<void>) => {
    if (!(await requireReady())) return;
    setBusy(true);
    setStatus(label);
    try {
      await action();
      await loadAdmin();
    } catch (error: any) {
      setStatus(error?.shortMessage || error?.message || `${label} failed.`);
    } finally {
      setBusy(false);
    }
  };

  const confirmWrite = (
    title: string,
    details: string,
    actionLabel: string,
    action: () => Promise<void>
  ) => {
    setConfirmation({
      title,
      details,
      actionLabel,
      run: () => runWrite(title, action),
    });
  };

  const executeConfirmation = async () => {
    const pending = confirmation;
    if (!pending) return;
    setConfirmation(null);
    await pending.run();
  };

  const updateAnalyst = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!ethers.isAddress(analyst)) {
      setStatus("Enter a valid analyst wallet.");
      return;
    }
    confirmWrite(
      `${approved ? "Approving" : "Revoking"} analyst`,
      `${approved ? "Approve" : "Revoke"} analyst access for ${analyst}.`,
      "Confirm analyst update",
      async () => {
      const contract = await getWriteContract();
      const tx = await contract.setAnalystStatus(analyst, approved);
      await tx.wait();
      setStatus(`${approved ? "Approved" : "Revoked"} ${analyst}`);
    });
  };

  const updatePrice = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    confirmWrite(
      `Updating ${formatTier(Number(tier))} price`,
      `Set ${formatTier(Number(tier))} monthly ETH price to ${price || "0"} ETH.`,
      "Confirm ETH price",
      async () => {
      const contract = await getWriteContract();
      const tx = await contract.setTierPrice(Number(tier), parseEther(price || "0"));
      await tx.wait();
      setStatus(`${formatTier(Number(tier))} price updated`);
    });
  };

  const updatePaymentToken = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (tokenEnabled && !ethers.isAddress(tokenAddress)) {
      setStatus("Enter a valid ERC20 token address.");
      return;
    }
    confirmWrite(
      "Updating payment token",
      tokenEnabled
        ? `Enable ERC20 settlement for ${tokenAddress} with ${tokenDecimals || "6"} decimals.`
        : "Disable ERC20 settlement and fall back to ETH subscriptions.",
      "Confirm token config",
      async () => {
      const contract = await getWriteContract();
      const tx = await contract.setPaymentToken(
        tokenEnabled ? tokenAddress : zeroAddress,
        Number(tokenDecimals || "6"),
        tokenEnabled
      );
      await tx.wait();
      setStatus("Payment token updated");
    });
  };

  const updateTokenPrice = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    confirmWrite(
      "Updating token tier price",
      `Set ${formatTier(Number(tokenTier))} monthly ERC20 price to ${tokenPrice || "0"} units.`,
      "Confirm ERC20 price",
      async () => {
      const contract = await getWriteContract();
      const tx = await contract.setTierTokenPrice(
        Number(tokenTier),
        parseUnits(tokenPrice || "0", Number(tokenDecimals || "6"))
      );
      await tx.wait();
      setStatus("Token tier price updated");
    });
  };

  const saveFeed = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const curator = feed.curator || address || "";
    if (!ethers.isAddress(curator)) {
      setStatus("Enter a valid curator wallet.");
      return;
    }
    confirmWrite(
      feed.id ? "Updating feed" : "Creating feed",
      `${feed.id ? "Update" : "Create"} feed "${feed.name}" with ${formatTier(Number(feed.minTier))} minimum access.`,
      feed.id ? "Confirm feed update" : "Confirm feed creation",
      async () => {
      const contract = await getWriteContract();
      const args = [
        feed.name,
        feed.description,
        Number(feed.minTier),
        parseEther(feed.monthlyPrice || "0"),
        curator,
      ] as const;
      const tx = feed.id
        ? await contract.updateFeed(
            Number(feed.id),
            feed.name,
            feed.description,
            Number(feed.minTier),
            parseEther(feed.monthlyPrice || "0"),
            feed.active,
            curator
          )
        : await contract.createFeed(...args);
      await tx.wait();
      setStatus(feed.id ? "Feed updated" : "Feed created");
    });
  };

  const grantSubscription = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!ethers.isAddress(grantAccount)) {
      setStatus("Enter a valid recipient wallet.");
      return;
    }
    const expiry = Math.floor(Date.now() / 1000) + Number(grantDays || "30") * 86400;
    confirmWrite(
      "Granting subscription",
      `Grant ${formatTier(Number(grantTier))} access to ${grantAccount} for ${grantDays || "30"} days.`,
      "Confirm access grant",
      async () => {
      const contract = await getWriteContract();
      const tx = await contract.grantSubscription(
        grantAccount,
        Number(grantTier),
        expiry
      );
      await tx.wait();
      setStatus("Subscription granted");
    });
  };

  const withdrawNative = async () => {
    const recipient = withdrawRecipient || address || "";
    if (!ethers.isAddress(recipient)) {
      setStatus("Enter a valid withdrawal recipient.");
      return;
    }
    confirmWrite(
      "Withdrawing ETH treasury",
      `Withdraw the full ETH treasury balance to ${recipient}.`,
      "Confirm ETH withdrawal",
      async () => {
      const contract = await getWriteContract();
      const tx = await contract.withdraw(recipient);
      await tx.wait();
      setStatus("ETH treasury withdrawn");
    });
  };

  const withdrawToken = async () => {
    const recipient = withdrawRecipient || address || "";
    if (!ethers.isAddress(recipient) || !ethers.isAddress(tokenAddress)) {
      setStatus("Enter a valid token and recipient.");
      return;
    }
    const amount = withdrawTokenAmount
      ? parseUnits(withdrawTokenAmount, Number(tokenDecimals || "6"))
      : stats.tokenBalance;
    confirmWrite(
      "Withdrawing token treasury",
      `Withdraw ${formatTokenAmount(amount, Number(tokenDecimals || "6"), "USDC")} to ${recipient}.`,
      "Confirm token withdrawal",
      async () => {
      const contract = await getWriteContract();
      const tx = await contract.withdrawToken(tokenAddress, recipient, amount);
      await tx.wait();
      setStatus("Token treasury withdrawn");
    });
  };

  const recordAlert = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!ethers.isAddress(alertForm.account)) {
      setStatus("Enter a valid alert recipient.");
      return;
    }
    confirmWrite(
      "Recording alert receipt",
      `Record an alert receipt for ${alertForm.account} on signal ${alertForm.signalId || "0"}.`,
      "Confirm alert receipt",
      async () => {
      const contract = await getWriteContract();
      const tx = await contract.recordAlert(
        alertForm.account,
        alertForm.ruleHash || ethers.id(`${alertForm.account}:${Date.now()}`),
        BigInt(alertForm.signalId || "0"),
        alertForm.channel,
        alertForm.deliveryRef || `manual:${Date.now()}`
      );
      await tx.wait();
      setStatus("Alert receipt recorded");
    });
  };

  const updateCooldown = async () => {
    confirmWrite(
      "Updating publish cooldown",
      `Set analyst publish cooldown to ${cooldown || "0"} seconds.`,
      "Confirm cooldown",
      async () => {
      const contract = await getWriteContract();
      const tx = await contract.setPublishCooldown(Number(cooldown || "0"));
      await tx.wait();
      setStatus("Publish cooldown updated");
    });
  };

  return (
    <PageFrame
      eyebrow="Protocol Admin"
      title="Operate the protocol."
      copy="Owner-only controls for feeds, analysts, subscriptions, payments, treasury, alerts, and anti-spam settings."
    >
      <div className="mb-10 grid gap-4 border-y border-white/10 py-5 text-sm text-white/55 md:grid-cols-5">
        <span>Owner: {formatAddress(stats.owner)}</span>
        <span>Signals: {stats.signals}</span>
        <span>Feeds: {stats.feeds}</span>
        <span>Teams: {stats.teams}</span>
        <span>ETH: {formatEther(stats.nativeBalance)}</span>
      </div>

      {!configured ? (
        <EmptyState
          title="Contract is not configured."
          copy="Set the deployed SilentWhale address before operating the protocol."
        />
      ) : !address ? (
        <EmptyState
          title="Connect the owner wallet."
          copy="Admin writes are hidden until a wallet is connected."
        />
      ) : !isOwner ? (
        <EmptyState
          title="Read-only admin view."
          copy="This wallet is not the protocol owner, so owner transaction controls are hidden."
        />
      ) : (
      <div className="grid gap-12 lg:grid-cols-12">
        <form onSubmit={updateAnalyst} className="space-y-6 lg:col-span-6">
          <SectionTitle icon={<ShieldCheck className="h-5 w-5 text-[#67e8f9]" />} title="Analyst allowlist" />
          <TextInput label="Analyst wallet" value={analyst} onChange={setAnalyst} mono />
          <label className="flex items-center justify-between border-y border-white/10 py-4 text-sm text-white/60">
            Approved analyst
            <input type="checkbox" checked={approved} onChange={(event) => setApproved(event.target.checked)} className="h-5 w-5 accent-white" />
          </label>
          <PrimaryButton busy={busy} label={address ? "Update analyst" : "Connect wallet"} />
        </form>

        <form onSubmit={updatePrice} className="space-y-6 border-t border-white/10 pt-8 lg:col-span-6 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
          <SectionTitle icon={<Settings className="h-5 w-5 text-[#fbbf24]" />} title="ETH pricing" />
          <TierSelect value={tier} onChange={setTier} />
          <TextInput label="Monthly price ETH" value={price} onChange={setPrice} type="number" step="0.0001" />
          <PrimaryButton busy={busy} label="Update ETH price" outline />
        </form>

        <form onSubmit={saveFeed} className="space-y-6 border-t border-white/10 pt-8 lg:col-span-6">
          <SectionTitle icon={<Users className="h-5 w-5 text-[#67e8f9]" />} title="Feed controls" />
          <label className="block text-sm text-white/45">
            Existing feed
            <select
              value={feed.id}
              onChange={(event) => {
                const selected = feeds.find((row) => row.id === Number(event.target.value));
                setFeed(
                  selected
                    ? {
                        id: String(selected.id),
                        name: selected.name,
                        description: selected.description,
                        minTier: String(selected.minTier),
                        monthlyPrice: formatEther(selected.monthlyPriceWei),
                        curator: selected.curator,
                        active: selected.active,
                      }
                    : { ...feed, id: "" }
                );
              }}
              className="mt-2 w-full border-b border-white/20 bg-background py-3 text-white outline-none"
            >
              <option value="">Create new feed</option>
              {feeds.map((row) => (
                <option key={row.id} value={row.id}>
                  #{row.id} {row.name}
                </option>
              ))}
            </select>
          </label>
          <TextInput label="Name" value={feed.name} onChange={(value) => setFeed((current) => ({ ...current, name: value }))} />
          <TextInput label="Description" value={feed.description} onChange={(value) => setFeed((current) => ({ ...current, description: value }))} />
          <TierSelect value={feed.minTier} onChange={(value) => setFeed((current) => ({ ...current, minTier: value }))} />
          <TextInput label="Monthly price ETH" value={feed.monthlyPrice} onChange={(value) => setFeed((current) => ({ ...current, monthlyPrice: value }))} type="number" step="0.0001" />
          <TextInput label="Curator" value={feed.curator} onChange={(value) => setFeed((current) => ({ ...current, curator: value }))} mono />
          <label className="flex items-center justify-between border-y border-white/10 py-4 text-sm text-white/60">
            Active feed
            <input type="checkbox" checked={feed.active} onChange={(event) => setFeed((current) => ({ ...current, active: event.target.checked }))} className="h-5 w-5 accent-white" />
          </label>
          <PrimaryButton busy={busy} label={feed.id ? "Update feed" : "Create feed"} />
        </form>

        <div className="space-y-8 border-t border-white/10 pt-8 lg:col-span-6 lg:border-l lg:pl-10">
          <form onSubmit={updatePaymentToken} className="space-y-6">
            <SectionTitle icon={<Coins className="h-5 w-5 text-[#fbbf24]" />} title="USDC settlement" />
            <TextInput label="ERC20 token" value={tokenAddress} onChange={setTokenAddress} mono />
            <TextInput label="Decimals" value={tokenDecimals} onChange={setTokenDecimals} type="number" />
            <label className="flex items-center justify-between border-y border-white/10 py-4 text-sm text-white/60">
              Token payments enabled
              <input type="checkbox" checked={tokenEnabled} onChange={(event) => setTokenEnabled(event.target.checked)} className="h-5 w-5 accent-white" />
            </label>
            <PrimaryButton busy={busy} label="Save token config" />
          </form>
          <form onSubmit={updateTokenPrice} className="space-y-6">
            <TierSelect value={tokenTier} onChange={setTokenTier} />
            <TextInput label="Monthly price USDC" value={tokenPrice} onChange={setTokenPrice} type="number" step="0.01" />
            <PrimaryButton busy={busy} label="Update USDC price" outline />
          </form>
        </div>

        <form onSubmit={grantSubscription} className="space-y-6 border-t border-white/10 pt-8 lg:col-span-4">
          <SectionTitle icon={<Users className="h-5 w-5 text-[#67e8f9]" />} title="Access grant" />
          <TextInput label="Recipient" value={grantAccount} onChange={setGrantAccount} mono />
          <TierSelect value={grantTier} onChange={setGrantTier} />
          <TextInput label="Days" value={grantDays} onChange={setGrantDays} type="number" />
          <PrimaryButton busy={busy} label="Grant subscription" />
        </form>

        <div className="space-y-6 border-t border-white/10 pt-8 lg:col-span-4 lg:border-l lg:pl-10">
          <SectionTitle icon={<Coins className="h-5 w-5 text-[#fbbf24]" />} title="Treasury" />
          <p className="text-sm text-white/50">
            Token balance: {formatTokenAmount(stats.tokenBalance, Number(tokenDecimals || "6"), "USDC")}
          </p>
          <TextInput label="Recipient" value={withdrawRecipient} onChange={setWithdrawRecipient} mono />
          <TextInput label="Token amount" value={withdrawTokenAmount} onChange={setWithdrawTokenAmount} type="number" step="0.01" />
          <div className="flex flex-wrap gap-3">
            <Button onClick={withdrawNative} disabled={busy} className="rounded-full bg-white px-5 text-black hover:bg-white/90">Withdraw ETH</Button>
            <Button onClick={withdrawToken} disabled={busy || !tokenAddress} variant="outline" className="rounded-full border-white/20 bg-transparent px-5">Withdraw USDC</Button>
          </div>
        </div>

        <div className="space-y-6 border-t border-white/10 pt-8 lg:col-span-4 lg:border-l lg:pl-10">
          <SectionTitle icon={<Settings className="h-5 w-5 text-[#67e8f9]" />} title="Anti-spam" />
          <TextInput label="Publish cooldown seconds" value={cooldown} onChange={setCooldown} type="number" />
          <Button onClick={updateCooldown} disabled={busy} className="rounded-full bg-white px-5 text-black hover:bg-white/90">Update cooldown</Button>
        </div>

        <form onSubmit={recordAlert} className="space-y-6 border-t border-white/10 pt-8 lg:col-span-12">
          <SectionTitle icon={<Bell className="h-5 w-5 text-[#fbbf24]" />} title="Alert receipt" />
          <div className="grid gap-6 md:grid-cols-5">
            <TextInput label="Account" value={alertForm.account} onChange={(value) => setAlertForm((current) => ({ ...current, account: value }))} mono />
            <TextInput label="Signal ID" value={alertForm.signalId} onChange={(value) => setAlertForm((current) => ({ ...current, signalId: value }))} type="number" />
            <TextInput label="Rule hash" value={alertForm.ruleHash} onChange={(value) => setAlertForm((current) => ({ ...current, ruleHash: value }))} mono />
            <TextInput label="Channel" value={alertForm.channel} onChange={(value) => setAlertForm((current) => ({ ...current, channel: value }))} />
            <TextInput label="Delivery ref" value={alertForm.deliveryRef} onChange={(value) => setAlertForm((current) => ({ ...current, deliveryRef: value }))} />
          </div>
          <PrimaryButton busy={busy} label="Record alert" />
        </form>
      </div>
      )}
      {confirmation ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4">
          <div className="w-full max-w-lg border border-white/15 bg-background p-6 shadow-2xl">
            <p className="text-sm text-white/45">Confirm owner transaction</p>
            <h2 className="mt-2 font-display text-3xl">{confirmation.title}</h2>
            <p className="mt-4 text-sm leading-6 text-white/60">{confirmation.details}</p>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setConfirmation(null)}
                className="rounded-full border-white/20 bg-transparent px-5"
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={busy}
                onClick={executeConfirmation}
                className="rounded-full bg-white px-5 text-black hover:bg-white/90"
              >
                {confirmation.actionLabel}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
      {status ? <p className="mt-8 text-sm text-white/50">{status}</p> : null}
    </PageFrame>
  );
}

function SectionTitle({ icon, title }: { icon: ReactNode; title: string }) {
  return <div className="flex items-center gap-3 text-sm text-white/50">{icon}{title}</div>;
}

function TextInput({
  label,
  value,
  onChange,
  type = "text",
  step,
  mono = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  step?: string;
  mono?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm text-white/45">{label}</span>
      <input
        type={type}
        step={step}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`w-full border-b border-white/20 bg-transparent py-3 outline-none focus:border-white ${mono ? "font-mono text-sm" : ""}`}
      />
    </label>
  );
}

function TierSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm text-white/45">Tier</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full border-b border-white/20 bg-background py-3 outline-none focus:border-white"
      >
        {[1, 2, 3].map((item) => (
          <option key={item} value={item}>
            {formatTier(item)}
          </option>
        ))}
      </select>
    </label>
  );
}

function PrimaryButton({
  busy,
  label,
  outline = false,
}: {
  busy: boolean;
  label: string;
  outline?: boolean;
}) {
  return (
    <Button
      type="submit"
      disabled={busy}
      variant={outline ? "outline" : "default"}
      className={
        outline
          ? "h-12 rounded-full border-white/20 bg-transparent px-8"
          : "h-12 rounded-full bg-white px-8 text-black hover:bg-white/90"
      }
    >
      {label}
    </Button>
  );
}
