require("dotenv").config({ path: ".env.local" });
require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");
const artifact = require("../artifacts/contracts/SilentWhale.sol/SilentWhale.json");

const transferAbi = [
  "event Transfer(address indexed from,address indexed to,uint256 value)",
];

function numberEnv(name, fallback) {
  const value = process.env[name];
  return value ? Number(value) : fallback;
}

function deploymentFromBlock() {
  const deploymentPath = path.join(
    __dirname,
    "..",
    "deployments",
    "silentwhale.eth-sepolia.json"
  );
  if (!fs.existsSync(deploymentPath)) return undefined;
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  return deployment.deployedBlock ? Number(deployment.deployedBlock) : undefined;
}

function classifyTransfer(log, decimals) {
  const iface = new ethers.Interface(transferAbi);
  const parsed = iface.parseLog(log);
  const amount = Number(ethers.formatUnits(parsed.args.value, decimals));
  const movementType = amount >= 1_000_000 ? "Whale transfer" : "Large transfer";
  return {
    chainId: log.chainId,
    blockNumber: log.blockNumber,
    txHash: log.transactionHash,
    from: parsed.args.from,
    to: parsed.args.to,
    amount,
    movementType,
    venue: "ERC20",
    eventRef: `erc20:${log.transactionHash}:${log.index}`,
  };
}

async function indexTransfers(provider) {
  const token = process.env.INDEX_TOKEN_ADDRESS;
  if (!token) return [];

  const latest = await provider.getBlockNumber();
  const fromBlock = numberEnv("INDEX_FROM_BLOCK", Math.max(0, latest - 5_000));
  const minAmount = numberEnv("INDEX_MIN_TOKEN_AMOUNT", 100_000);
  const decimals = numberEnv("INDEX_TOKEN_DECIMALS", 18);
  const topic = ethers.id("Transfer(address,address,uint256)");
  const logs = await provider.getLogs({
    address: token,
    topics: [topic],
    fromBlock,
    toBlock: latest,
  });

  return logs
    .map((log) => classifyTransfer(log, decimals))
    .filter((event) => event.amount >= minAmount);
}

async function indexProtocolSignals(provider, contractAddress) {
  if (!contractAddress) return [];
  const contract = new ethers.Contract(contractAddress, artifact.abi, provider);
  const latest = await provider.getBlockNumber();
  const fromBlock = numberEnv(
    "INDEX_SIGNAL_FROM_BLOCK",
    deploymentFromBlock() ?? Math.max(0, latest - 20_000)
  );
  const chunkSize = numberEnv("INDEX_SIGNAL_BLOCK_CHUNK", 10_000);
  const filter = contract.filters.SignalPublished();
  const events = [];

  for (let start = fromBlock; start <= latest; start += chunkSize + 1) {
    const end = Math.min(latest, start + chunkSize);
    const chunk = await contract.queryFilter(filter, start, end);
    events.push(...chunk);
  }

  const indexedEvents = events.map((event) => ({
    source: "event-log",
    blockNumber: event.blockNumber,
    txHash: event.transactionHash,
    signalId: Number(event.args.signalId),
    analyst: event.args.analyst,
    feedId: Number(event.args.feedId),
    tokenSymbol: event.args.tokenSymbol,
    sector: event.args.sector,
    minTier: Number(event.args.minTier),
    eventRef: `signal:${event.transactionHash}:${event.index}`,
  }));

  if (indexedEvents.length > 0) return indexedEvents;

  const signalCount = Number(await contract.signalCount());
  const fallbackSignals = [];
  for (let signalId = 0; signalId < signalCount; signalId++) {
    const signal = await contract.getSignal(signalId);
    fallbackSignals.push({
      source: "contract-state",
      blockNumber: null,
      txHash: null,
      signalId,
      analyst: signal.analyst,
      feedId: Number(signal.feedId),
      tokenSymbol: signal.tokenSymbol,
      sector: signal.sector,
      minTier: Number(signal.minTier),
      eventRef: signal.eventRef || `signal:${signalId}`,
      active: signal.active,
      createdAt: Number(signal.createdAt),
      updatedAt: Number(signal.updatedAt),
    });
  }
  return fallbackSignals;
}

async function main() {
  const rpcUrl =
    process.env.SEPOLIA_RPC_URL ||
    process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ||
    "https://ethereum-sepolia-rpc.publicnode.com";
  const contractAddress = process.env.NEXT_PUBLIC_SILENT_WHALE_ADDRESS;
  const provider = new ethers.JsonRpcProvider(rpcUrl);

  const [transfers, signals] = await Promise.all([
    indexTransfers(provider),
    indexProtocolSignals(provider, contractAddress),
  ]);

  const output = {
    indexedAt: new Date().toISOString(),
    transferEvents: transfers,
    signalEvents: signals,
  };
  const cacheDir = path.join(__dirname, "..", "cache");
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(
    path.join(cacheDir, "indexed-events.json"),
    JSON.stringify(output, null, 2)
  );
  console.log("Indexed transfers:", transfers.length);
  console.log("Indexed protocol signals:", signals.length);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
