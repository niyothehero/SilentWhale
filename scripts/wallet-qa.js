require("dotenv").config({ path: ".env.local" });
require("dotenv").config();

const { ethers } = require("ethers");
const artifact = require("../artifacts/contracts/SilentWhale.sol/SilentWhale.json");

async function main() {
  const rpcUrl =
    process.env.SEPOLIA_RPC_URL ||
    process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ||
    "https://ethereum-sepolia-rpc.publicnode.com";
  const address = process.env.NEXT_PUBLIC_SILENT_WHALE_ADDRESS;
  const expectedChainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 11155111);

  if (!address || !ethers.isAddress(address)) {
    throw new Error("NEXT_PUBLIC_SILENT_WHALE_ADDRESS is not configured.");
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== expectedChainId) {
    throw new Error(
      `RPC chain ${network.chainId} does not match NEXT_PUBLIC_CHAIN_ID ${expectedChainId}.`
    );
  }

  const code = await provider.getCode(address);
  if (code === "0x") {
    throw new Error("No contract bytecode at NEXT_PUBLIC_SILENT_WHALE_ADDRESS.");
  }

  const contract = new ethers.Contract(address, artifact.abi, provider);
  const [owner, feedCount, signalCount] = await Promise.all([
    contract.owner(),
    contract.feedCount(),
    contract.signalCount(),
  ]);

  const hasWalletRecoveryCopy = [
    "Wallet extension not found.",
    "wallet_switchEthereumChain",
    "wallet_addEthereumChain",
  ].every((needle) =>
    require("fs")
      .readFileSync(require("path").join(__dirname, "..", "hooks", "use-silent-whale.ts"), "utf8")
      .includes(needle)
  );
  if (!hasWalletRecoveryCopy) {
    throw new Error("Wallet recovery paths are missing from use-silent-whale.ts.");
  }

  console.log("WALLET_QA_OK");
  console.log("Chain:", Number(network.chainId));
  console.log("Owner:", owner);
  console.log("Feeds:", feedCount.toString());
  console.log("Signals:", signalCount.toString());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
