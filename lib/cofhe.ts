"use client";

import { createPublicClient, createWalletClient, custom, http } from "viem";
import { arbitrumSepolia, baseSepolia, sepolia } from "viem/chains";
import { ACTIVE_CHAIN } from "@/lib/silent-whale";

type Address = `0x${string}`;

let cachedClient: any;
let cachedChainId: number | undefined;

function viemChain() {
  if (ACTIVE_CHAIN.id === 421614) return arbitrumSepolia;
  if (ACTIVE_CHAIN.id === 84532) return baseSepolia;
  return sepolia;
}

function cofheChain(chains: any) {
  if (ACTIVE_CHAIN.id === 421614) return chains.arbSepolia;
  if (ACTIVE_CHAIN.id === 84532) return chains.baseSepolia;
  return chains.sepolia;
}

export async function getCofheClient(account: string) {
  if (!window.ethereum) {
    throw new Error("Wallet extension not found.");
  }

  const [{ createCofheClient, createCofheConfig }, { chains }] =
    await Promise.all([
      import("@cofhe/sdk/web"),
      import("@cofhe/sdk/chains"),
    ]);

  if (!cachedClient || cachedChainId !== ACTIVE_CHAIN.id) {
    const config = createCofheConfig({
      supportedChains: [cofheChain(chains)],
      useWorkers: true,
    });
    cachedClient = createCofheClient(config);
    cachedChainId = ACTIVE_CHAIN.id;
  }

  const chain = viemChain();
  const publicClient = createPublicClient({
    chain,
    transport: http(ACTIVE_CHAIN.rpcUrl),
  });
  const walletClient = createWalletClient({
    account: account as Address,
    chain,
    transport: custom(window.ethereum),
  });

  await cachedClient.connect(publicClient, walletClient);
  await cachedClient.permits.getOrCreateSelfPermit();
  return cachedClient;
}

export async function encryptSignalInputs(
  account: string,
  values: {
    whale: string;
    amountUsd: string;
    confidenceBps: string;
    entryPriceBps: string;
    riskBps: string;
  },
  onStep?: (label: string) => void
) {
  const [{ Encryptable }, client] = await Promise.all([
    import("@cofhe/sdk"),
    getCofheClient(account),
  ]);

  return client
    .encryptInputs([
      Encryptable.address(values.whale),
      Encryptable.uint64(BigInt(values.amountUsd || "0")),
      Encryptable.uint32(BigInt(values.confidenceBps || "0")),
      Encryptable.uint32(BigInt(values.entryPriceBps || "0")),
      Encryptable.uint32(BigInt(values.riskBps || "0")),
    ])
    .onStep((step: unknown, ctx: { isStart?: boolean; isEnd?: boolean }) => {
      if (ctx?.isStart) onStep?.(`Encrypting ${String(step)}`);
      if (ctx?.isEnd) onStep?.(`Finished ${String(step)}`);
    })
    .execute();
}

export async function encryptWatchlistInputs(
  account: string,
  wallet: string,
  minConfidenceBps: string,
  onStep?: (label: string) => void
) {
  const [{ Encryptable }, client] = await Promise.all([
    import("@cofhe/sdk"),
    getCofheClient(account),
  ]);

  return client
    .encryptInputs([
      Encryptable.address(wallet),
      Encryptable.uint32(BigInt(minConfidenceBps || "0")),
    ])
    .onStep((step: unknown, ctx: { isStart?: boolean; isEnd?: boolean }) => {
      if (ctx?.isStart) onStep?.(`Encrypting ${String(step)}`);
      if (ctx?.isEnd) onStep?.(`Finished ${String(step)}`);
    })
    .execute();
}

export async function decryptHandle(
  account: string,
  handle: string,
  fheType: "address" | "uint32" | "uint64"
) {
  const [{ FheTypes }, client] = await Promise.all([
    import("@cofhe/sdk"),
    getCofheClient(account),
  ]);

  const typeMap = {
    address: FheTypes.Uint160,
    uint32: FheTypes.Uint32,
    uint64: FheTypes.Uint64,
  };

  return client.decryptForView(handle, typeMap[fheType]).execute();
}
