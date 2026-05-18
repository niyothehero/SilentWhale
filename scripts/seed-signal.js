require("dotenv").config({ path: ".env.local" });
require("dotenv").config();

const { ethers } = require("ethers");
const { createCofheConfig, createCofheClient } = require("@cofhe/sdk/node");
const { Encryptable } = require("@cofhe/sdk");
const { Ethers6Adapter } = require("@cofhe/sdk/adapters");
const { chains } = require("@cofhe/sdk/chains");
const artifact = require("../artifacts/contracts/SilentWhale.sol/SilentWhale.json");

async function main() {
  const privateKey = process.env.PRIVATE_KEY;
  const address = process.env.NEXT_PUBLIC_SILENT_WHALE_ADDRESS;
  const rpcUrl =
    process.env.SEPOLIA_RPC_URL ||
    process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ||
    "https://ethereum-sepolia-rpc.publicnode.com";

  if (!privateKey) throw new Error("PRIVATE_KEY is required.");
  if (!address) throw new Error("NEXT_PUBLIC_SILENT_WHALE_ADDRESS is required.");

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(
    privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`,
    provider
  );
  const contract = new ethers.Contract(address, artifact.abi, wallet);

  const config = createCofheConfig({ supportedChains: [chains.sepolia] });
  const client = createCofheClient(config);
  const { publicClient, walletClient } = await Ethers6Adapter(provider, wallet);
  await client.connect(publicClient, walletClient);
  await client.permits.getOrCreateSelfPermit();

  console.log("Encrypting seed signal as", wallet.address);
  const encrypted = await client
    .encryptInputs([
      Encryptable.address("0x000000000000000000000000000000000000dEaD"),
      Encryptable.uint64(500000n),
      Encryptable.uint32(9200n),
      Encryptable.uint32(1440n),
      Encryptable.uint32(1800n),
    ])
    .onStep((step, ctx) => {
      if (ctx?.isStart) console.log("Starting", step);
      if (ctx?.isEnd) console.log("Finished", step);
    })
    .execute();

  const tx = await contract.publishSignal(
    0,
    "Tier-1 wallet accumulated an AI sector token",
    "A smart wallet is building a position while public attention is still low.",
    "AI",
    "Artificial Intelligence",
    1,
    encrypted[0],
    encrypted[1],
    encrypted[2],
    encrypted[3],
    encrypted[4]
  );
  console.log("Transaction:", tx.hash);
  const receipt = await tx.wait();
  console.log("Seed signal mined in block", receipt.blockNumber);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
