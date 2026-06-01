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
export const USDC_PAYMENT_TOKEN =
  process.env.NEXT_PUBLIC_USDC_ADDRESS || "";

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export const isContractConfigured = () =>
  ethers.isAddress(SILENT_WHALE_ADDRESS) &&
  SILENT_WHALE_ADDRESS.toLowerCase() !== ZERO_ADDRESS;

const encryptedInput =
  "(uint256 ctHash,uint8 securityZone,uint8 utype,bytes signature)";

export const SILENT_WHALE_ABI = [
  "function owner() view returns (address)",
  "function feedCount() view returns (uint256)",
  "function signalCount() view returns (uint256)",
  "function teamCount() view returns (uint256)",
  "function watchlistCount(address account) view returns (uint256)",
  "function receiptCount(address account) view returns (uint256)",
  "function alertCount(address account) view returns (uint256)",
  "function memberTeamCount(address account) view returns (uint256)",
  "function tierPriceWei(uint8 tier) view returns (uint256)",
  "function tierTokenPrice(uint8 tier) view returns (uint256)",
  "function paymentToken() view returns (address)",
  "function paymentTokenDecimals() view returns (uint8)",
  "function paymentTokenEnabled() view returns (bool)",
  "function publishCooldownSeconds() view returns (uint64)",
  "function effectiveTier(address account) view returns (uint8)",
  "function canAccessSignal(address account,uint256 signalId) view returns (bool)",
  "function getFeed(uint256 feedId) view returns (string name,string description,uint8 minTier,uint256 monthlyPriceWei,bool active,address curator)",
  "function getSignal(uint256 signalId) view returns (address analyst,uint256 feedId,string headline,string publicSummary,string tokenSymbol,string sector,string movementType,string venue,string sourceChain,string eventRef,string aiModel,string scoreProvenance,uint8 minTier,uint64 createdAt,uint64 updatedAt,bool active,bytes32 encryptedWhale,bytes32 encryptedAmountUsd,bytes32 encryptedConfidenceBps,bytes32 encryptedEntryPriceBps,bytes32 encryptedRiskBps)",
  "function getWatchlistItem(address account,uint256 index) view returns (bytes32 labelHash,string publicNote,uint64 createdAt,bool active,bytes32 encryptedWallet,bytes32 encryptedMinConfidenceBps)",
  "function getPaymentReceipt(address account,uint256 index) view returns (address payer,address token,uint8 tier,uint8 monthCount,uint256 amount,uint64 paidAt,uint64 expiresAt)",
  "function getTeam(uint256 teamId) view returns (address teamOwner,bytes32 nameHash,uint8 tier,uint16 seatLimit,uint16 memberCount,uint64 createdAt,bool active)",
  "function memberTeamAt(address account,uint256 index) view returns (uint256)",
  "function teamMembers(uint256 teamId,address member) view returns (bool)",
  "function getAlert(address account,uint256 index) view returns (bytes32 ruleHash,uint256 signalId,string channel,string deliveryRef,uint64 createdAt,bool read)",
  "function getAnalystProfile(address analyst) view returns (string displayName,string bio,string strategy,string uri,uint64 updatedAt,bool active)",
  "function hasAnalystProfile(address analyst) view returns (bool)",
  "function subscriptionOf(address account) view returns (uint8 tier,uint64 expiresAt,bool active)",
  "function approvedAnalysts(address analyst) view returns (bool)",
  "function hasAnalystScore(address analyst) view returns (bool)",
  "function getAnalystScore(address analyst) view returns (bytes32)",
  "function setAnalystStatus(address analyst,bool approved)",
  "function setAnalystProfile(string displayName,string bio,string strategy,string uri)",
  "function setAnalystProfileFor(address analyst,string displayName,string bio,string strategy,string uri,bool active)",
  "function setTierPrice(uint8 tier,uint256 monthlyPriceWei)",
  "function setPaymentToken(address token,uint8 decimals,bool enabled)",
  "function setTierTokenPrice(uint8 tier,uint256 monthlyPrice)",
  "function setPublishCooldown(uint64 secondsBetweenPublishes)",
  "function createFeed(string name,string description,uint8 minTier,uint256 monthlyPriceWei,address curator) returns (uint256 feedId)",
  "function updateFeed(uint256 feedId,string name,string description,uint8 minTier,uint256 monthlyPriceWei,bool active,address curator)",
  "function grantSubscription(address account,uint8 tier,uint64 expiresAt)",
  "function updateSignalMetadata(uint256 signalId,string headline,string publicSummary,string tokenSymbol,string sector,string movementType,string venue,string sourceChain,string eventRef,string aiModel,string scoreProvenance,uint8 minTier,bool active)",
  "function setSignalActive(uint256 signalId,bool active)",
  "function publishSignal(uint256 feedId,string headline,string publicSummary,string tokenSymbol,string sector,string movementType,string venue,string sourceChain,string eventRef,string aiModel,string scoreProvenance,uint8 minTier," +
    `${encryptedInput} encryptedWhale,${encryptedInput} encryptedAmountUsd,${encryptedInput} encryptedConfidenceBps,${encryptedInput} encryptedEntryPriceBps,${encryptedInput} encryptedRiskBps) returns (uint256 signalId)`,
  "function subscribe(uint8 tier,uint8 monthCount) payable",
  "function subscribeWithToken(uint8 tier,uint8 monthCount)",
  "function grantSignalAccess(uint256 signalId)",
  "function addWatchlistItem(bytes32 labelHash,string publicNote," +
    `${encryptedInput} encryptedWallet,${encryptedInput} encryptedMinConfidenceBps) returns (uint256 index)`,
  "function setWatchlistItemActive(uint256 index,bool active)",
  "function grantWatchlistAccess(uint256 index)",
  "function grantAnalystScoreAccess(address analyst)",
  "function createTeam(bytes32 nameHash,uint16 seatLimit) returns (uint256 teamId)",
  "function addTeamMember(uint256 teamId,address member)",
  "function removeTeamMember(uint256 teamId,address member)",
  "function setTeamActive(uint256 teamId,bool active)",
  "function setTeamSeatLimit(uint256 teamId,uint16 seatLimit)",
  "function recordAlert(address account,bytes32 ruleHash,uint256 signalId,string channel,string deliveryRef) returns (uint256 alertId)",
  "function markAlertRead(uint256 index,bool read)",
  "function withdraw(address payable recipient)",
  "function withdrawToken(address token,address recipient,uint256 amount)",
  "event SignalPublished(uint256 indexed signalId,address indexed analyst,uint256 indexed feedId,uint8 minTier,string tokenSymbol,string sector)",
  "event SignalAccessGranted(uint256 indexed signalId,address indexed account)",
  "event Subscribed(address indexed account,uint8 tier,uint64 expiresAt,uint256 paid)",
  "event WatchlistItemAdded(address indexed account,uint256 indexed index)",
] as const;

export const ERC20_ABI = [
  "function approve(address spender,uint256 amount) returns (bool)",
  "function allowance(address owner,address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
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
    features: ["Signal unlocks", "Private decrypt permits", "Billing receipts"],
  },
  {
    name: "Elite",
    price: "0.003 ETH",
    summary: "Full whale analytics and private watchlists.",
    features: ["Elite feeds", "Encrypted watchlists", "Alert history"],
  },
  {
    name: "DAO",
    price: "0.01 ETH",
    summary: "Team-grade intelligence and governance ops.",
    features: ["DAO feeds", "Team seats", "Shared decrypt access"],
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
  movementType: string;
  venue: string;
  sourceChain: string;
  eventRef: string;
  aiModel: string;
  scoreProvenance: string;
  minTier: number;
  createdAt: number;
  updatedAt: number;
  active: boolean;
  encryptedWhale: string;
  encryptedAmountUsd: string;
  encryptedConfidenceBps: string;
  encryptedEntryPriceBps: string;
  encryptedRiskBps: string;
};

export type PaymentReceiptRecord = {
  index: number;
  payer: string;
  token: string;
  tier: number;
  monthCount: number;
  amount: bigint;
  paidAt: number;
  expiresAt: number;
};

export type TeamRecord = {
  id: number;
  teamOwner: string;
  nameHash: string;
  tier: number;
  seatLimit: number;
  memberCount: number;
  createdAt: number;
  active: boolean;
};

export type AlertRecord = {
  index: number;
  ruleHash: string;
  signalId: number;
  channel: string;
  deliveryRef: string;
  createdAt: number;
  read: boolean;
};

export type AnalystProfileRecord = {
  analyst: string;
  displayName: string;
  bio: string;
  strategy: string;
  uri: string;
  updatedAt: number;
  active: boolean;
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

export function formatTokenAmount(
  value: bigint,
  decimals: number,
  symbol = "USDC"
) {
  const safeDecimals = Math.max(0, Math.min(decimals, 36));
  const [whole, fraction = ""] = ethers.formatUnits(value, safeDecimals).split(".");
  const formattedWhole = BigInt(whole || "0").toLocaleString("en-US");
  const trimmedFraction = fraction.slice(0, safeDecimals > 6 ? 6 : safeDecimals).replace(/0+$/, "");
  return `${formattedWhole}${trimmedFraction ? `.${trimmedFraction}` : ""} ${symbol}`;
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

export async function readSignalRecord(contract: any, id: number) {
  const signal = await contract.getSignal(id);
  return {
    id,
    analyst: signal.analyst,
    feedId: Number(signal.feedId),
    headline: signal.headline,
    publicSummary: signal.publicSummary,
    tokenSymbol: signal.tokenSymbol,
    sector: signal.sector,
    movementType: signal.movementType,
    venue: signal.venue,
    sourceChain: signal.sourceChain,
    eventRef: signal.eventRef,
    aiModel: signal.aiModel,
    scoreProvenance: signal.scoreProvenance,
    minTier: Number(signal.minTier),
    createdAt: Number(signal.createdAt),
    updatedAt: Number(signal.updatedAt),
    active: signal.active,
    encryptedWhale: signal.encryptedWhale,
    encryptedAmountUsd: signal.encryptedAmountUsd,
    encryptedConfidenceBps: signal.encryptedConfidenceBps,
    encryptedEntryPriceBps: signal.encryptedEntryPriceBps,
    encryptedRiskBps: signal.encryptedRiskBps,
  } satisfies SignalRecord;
}
