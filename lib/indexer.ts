import type { SignalRecord } from "@/lib/silent-whale";

export type SignalFilters = {
  query: string;
  token: string;
  sector: string;
  minTier: string;
  movement: string;
  activeOnly: boolean;
};

export const defaultSignalFilters: SignalFilters = {
  query: "",
  token: "",
  sector: "",
  minTier: "",
  movement: "",
  activeOnly: true,
};

function includes(value: string, query: string) {
  return value.toLowerCase().includes(query.toLowerCase());
}

export function filterSignals(
  signals: SignalRecord[],
  filters: SignalFilters
) {
  return signals.filter((signal) => {
    const query = filters.query.trim();
    const matchesQuery =
      !query ||
      [
        signal.headline,
        signal.publicSummary,
        signal.tokenSymbol,
        signal.sector,
        signal.movementType,
        signal.venue,
        signal.eventRef,
      ].some((field) => includes(field || "", query));

    return (
      matchesQuery &&
      (!filters.token || signal.tokenSymbol === filters.token) &&
      (!filters.sector || signal.sector === filters.sector) &&
      (!filters.movement || signal.movementType === filters.movement) &&
      (!filters.minTier || signal.minTier >= Number(filters.minTier)) &&
      (!filters.activeOnly || signal.active)
    );
  });
}

export function uniqueSignalValues(
  signals: SignalRecord[],
  key: "tokenSymbol" | "sector" | "movementType"
) {
  return Array.from(new Set(signals.map((signal) => signal[key]).filter(Boolean)));
}

export function paginateSignals(
  signals: SignalRecord[],
  page: number,
  pageSize: number
) {
  const start = (page - 1) * pageSize;
  return signals.slice(start, start + pageSize);
}
