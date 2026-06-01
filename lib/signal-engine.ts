export const SCORE_MODEL_VERSION = "silent-score-v1.1";

type SignalDraft = {
  tokenSymbol: string;
  sector: string;
  amountUsd: string;
  whale: string;
  venue?: string;
  movementType?: string;
};

export type SignalScore = {
  confidence: string;
  entry: string;
  risk: string;
  movementType: string;
  venue: string;
  sourceChain: string;
  eventRef: string;
  model: string;
  provenance: string;
  narrative: string;
};

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

export function scoreSignalDraft(draft: SignalDraft): SignalScore {
  const amount = Number(draft.amountUsd || "0");
  const sector = draft.sector.toLowerCase();
  const token = draft.tokenSymbol.toUpperCase();

  const sizeScore = amount >= 1_000_000 ? 18 : amount >= 500_000 ? 12 : 6;
  const narrativeScore =
    sector.includes("ai") || sector.includes("privacy") || sector.includes("rwa")
      ? 10
      : sector.includes("meme")
        ? -8
        : 3;
  const walletEntropy = Number.parseInt(draft.whale.slice(-4), 16) % 11;
  const venue = draft.venue || (amount > 750_000 ? "CEX" : "DEX");
  const movementType =
    draft.movementType ||
    (venue === "Bridge"
      ? "Bridge"
      : venue === "CEX"
        ? "CEX outflow"
        : "Accumulation");

  const confidence = clamp(64 + sizeScore + narrativeScore + walletEntropy / 2);
  const entry = clamp(38 + narrativeScore + (amount > 750_000 ? 8 : 3));
  const risk = clamp(28 + (venue === "Bridge" ? 14 : 0) - narrativeScore / 2);
  const eventRef = `silent-index:${token}:${Date.now().toString(36)}`;

  return {
    confidence: confidence.toFixed(2),
    entry: entry.toFixed(2),
    risk: risk.toFixed(2),
    movementType,
    venue,
    sourceChain: "Ethereum Sepolia",
    eventRef,
    model: SCORE_MODEL_VERSION,
    provenance: `amount=${amount};sector=${sector || "unknown"};venue=${venue}`,
    narrative: `${token || "Asset"} ${movementType.toLowerCase()} scored from size, sector momentum, venue risk, and deterministic wallet entropy.`,
  };
}
