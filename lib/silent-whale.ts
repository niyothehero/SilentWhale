import { Contract, JsonRpcProvider, ethers } from "ethers";

export const SUPPORTED_CHAIN_ID = Number(
  process.env.NEXT_PUBLIC_CHAIN_ID || 11155111
);

export const SUPPORTED_CHAIN = {
  11155111: {
    id: 11155111,
    hexId: "0xaa36a7",
    name: "Ethereum Sepolia",
    shortName: "Sepolia",
    rpcUrl:
      process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ||
      "https://ethereum-sepolia-rpc.publicnode.com",
    explorer: "https://sepolia.etherscan.io",
    nativeCurrency: { name: "Sepolia ETH", symbol: "ETH", decimals: 18 },
  },
  421614: {
    id: 421614,
    hexId: "0x66eee",
    name: "Arbitrum Sepolia",
    shortName: "Arb Sepolia",
    rpcUrl:
      process.env.NEXT_PUBLIC_ARBITRUM_SEPOLIA_RPC_URL ||
      "https://sepolia-rollup.arbitrum.io/rpc",
    explorer: "https://sepolia.arbiscan.io",
    nativeCurrency: { name: "Arbitrum Sepolia ETH", symbol: "ETH", decimals: 18 },
  },
  84532: {
    id: 84532,
    hexId: "0x14a34",
    name: "Base Sepolia",
    shortName: "Base Sepolia",
    rpcUrl:
      process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL ||
      "https://sepolia.base.org",
    explorer: "https://sepolia.basescan.org",
    nativeCurrency: { name: "Base Sepolia ETH", symbol: "ETH", decimals: 18 },
  },
} as const;

export const ACTIVE_CHAIN =
  SUPPORTED_CHAIN[SUPPORTED_CHAIN_ID as keyof typeof SUPPORTED_CHAIN] ||
  SUPPORTED_CHAIN[11155111];

export const SILENT_WHALE_ADDRESS =
  process.env.NEXT_PUBLIC_SILENT_WHALE_ADDRESS || "";

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export const isContractConfigured = () =>
  ethers.isAddress(SILENT_WHALE_ADDRESS) &&
  SILENT_WHALE_ADDRESS.toLowerCase() !== ZERO_ADDRESS;

const encryptedInput =
  "(uint256 ctHash,uint8 securityZone,uint8 utype,bytes signature)";

export const SILENT_WHALE_ABI = [
  "function feedCount() view returns (uint256)",
  "function signalCount() view returns (uint256)",
  "function watchlistCount(address account) view returns (uint256)",
  "function tierPriceWei(uint8 tier) view returns (uint256)",
  "function effectiveTier(address account) view returns (uint8)",
  "function canAccessSignal(address account,uint256 signalId) view returns (bool)",
  "function getFeed(uint256 feedId) view returns (string name,string description,uint8 minTier,uint256 monthlyPriceWei,bool active,address curator)",
  "function getSignal(uint256 signalId) view returns (address analyst,uint256 feedId,string headline,string publicSummary,string tokenSymbol,string sector,uint8 minTier,uint64 createdAt,bool active,bytes32 encryptedWhale,bytes32 encryptedAmountUsd,bytes32 encryptedConfidenceBps,bytes32 encryptedEntryPriceBps,bytes32 encryptedRiskBps)",
  "function getWatchlistItem(address account,uint256 index) view returns (bytes32 labelHash,string publicNote,uint64 createdAt,bool active,bytes32 encryptedWallet,bytes32 encryptedMinConfidenceBps)",
  "function subscriptionOf(address account) view returns (uint8 tier,uint64 expiresAt,bool active)",
  "function approvedAnalysts(address analyst) view returns (bool)",
  "function setAnalystStatus(address analyst,bool approved)",
  "function setTierPrice(uint8 tier,uint256 monthlyPriceWei)",
  "function publishSignal(uint256 feedId,string headline,string publicSummary,string tokenSymbol,string sector,uint8 minTier," +
    `${encryptedInput} encryptedWhale,${encryptedInput} encryptedAmountUsd,${encryptedInput} encryptedConfidenceBps,${encryptedInput} encryptedEntryPriceBps,${encryptedInput} encryptedRiskBps) returns (uint256 signalId)`,
  "function subscribe(uint8 tier,uint8 monthCount) payable",
  "function grantSignalAccess(uint256 signalId)",
  "function addWatchlistItem(bytes32 labelHash,string publicNote," +
    `${encryptedInput} encryptedWallet,${encryptedInput} encryptedMinConfidenceBps) returns (uint256 index)`,
  "function grantWatchlistAccess(uint256 index)",
  "function grantAnalystScoreAccess(address analyst)",
  "event SignalPublished(uint256 indexed signalId,address indexed analyst,uint256 indexed feedId,uint8 minTier,string tokenSymbol,string sector)",
  "event SignalAccessGranted(uint256 indexed signalId,address indexed account)",
  "event Subscribed(address indexed account,uint8 tier,uint64 expiresAt,uint256 paid)",
  "event WatchlistItemAdded(address indexed account,uint256 indexed index)",
] as const;

export const tierNames = ["Free", "Pro", "Elite", "DAO"] as const;

export const tierCopy = [
  {
    name: "Free",
    price: "0 ETH",
    summary: "Delayed public signal surface.",
    features: ["Public headlines", "Delayed summaries", "Protocol status"],
  },
  {
    name: "Pro",
    price: "0.001 ETH",
    summary: "Live encrypted signals for solo traders.",
    features: ["Signal unlocks", "Private decrypt permits", "Signal history"],
  },
  {
    name: "Elite",
    price: "0.003 ETH",
    summary: "Full whale analytics and private watchlists.",
    features: ["Elite feeds", "Encrypted watchlists", "Analyst reputation"],
  },
  {
    name: "DAO",
    price: "0.01 ETH",
    summary: "Team-grade intelligence and governance ops.",
    features: ["DAO feeds", "Team intelligence", "Institutional roadmap"],
  },
];

export type FeedRecord = {
  id: number;
  name: string;
  description: string;
  minTier: number;
  monthlyPriceWei: bigint;
  active: boolean;
  curator: string;
};

export type SignalRecord = {
  id: number;
  analyst: string;
  feedId: number;
  headline: string;
  publicSummary: string;
  tokenSymbol: string;
  sector: string;
  minTier: number;
  createdAt: number;
  active: boolean;
  encryptedWhale: string;
  encryptedAmountUsd: string;
  encryptedConfidenceBps: string;
  encryptedEntryPriceBps: string;
  encryptedRiskBps: string;
};

export type WatchlistRecord = {
  index: number;
  labelHash: string;
  publicNote: string;
  createdAt: number;
  active: boolean;
  encryptedWallet: string;
  encryptedMinConfidenceBps: string;
};

export type SubscriptionRecord = {
  tier: number;
  expiresAt: number;
  active: boolean;
};

export function getReadOnlyContract() {
  if (!isContractConfigured()) return undefined;
  const provider = new JsonRpcProvider(ACTIVE_CHAIN.rpcUrl, ACTIVE_CHAIN.id);
  return new Contract(SILENT_WHALE_ADDRESS, SILENT_WHALE_ABI, provider);
}

export function formatTier(tier: number) {
  return tierNames[tier as 0 | 1 | 2 | 3] || "Free";
}

export function formatAddress(address?: string) {
  if (!address) return "Not connected";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function formatUsd(value: bigint | number | string) {
  const numberValue = Number(value);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(numberValue);
}

export function formatBps(value: bigint | number | string) {
  return `${(Number(value) / 100).toFixed(2)}%`;
}

export function formatDate(timestamp: number) {
  if (!timestamp) return "Pending";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp * 1000));
}
