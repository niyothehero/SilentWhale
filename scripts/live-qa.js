require("dotenv").config({ path: ".env.local" });
require("dotenv").config();

const { ethers } = require("ethers");
const { createCofheConfig, createCofheClient } = require("@cofhe/sdk/node");
const { Encryptable, FheTypes } = require("@cofhe/sdk");
const { Ethers6Adapter } = require("@cofhe/sdk/adapters");
const { chains } = require("@cofhe/sdk/chains");
const artifact = require("../artifacts/contracts/SilentWhale.sol/SilentWhale.json");

const normalizeKey = (key) => (key.startsWith("0x") ? key : `0x${key}`);

async function createClient(provider, wallet) {
  const config = createCofheConfig({ supportedChains: [chains.sepolia] });
  const client = createCofheClient(config);
  const { publicClient, walletClient } = await Ethers6Adapter(provider, wallet);
  await client.connect(publicClient, walletClient);
  await client.permits.getOrCreateSelfPermit();
  return client;
}

async function main() {
  const privateKey = process.env.PRIVATE_KEY;
  const contractAddress = process.env.NEXT_PUBLIC_SILENT_WHALE_ADDRESS;
  const rpcUrl =
    process.env.SEPOLIA_RPC_URL ||
    process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ||
    "https://ethereum-sepolia-rpc.publicnode.com";

  if (!privateKey) throw new Error("PRIVATE_KEY is required.");
  if (!contractAddress) {
    throw new Error("NEXT_PUBLIC_SILENT_WHALE_ADDRESS is required.");
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const owner = new ethers.Wallet(normalizeKey(privateKey), provider);
  const subscriber = ethers.Wallet.createRandom().connect(provider);
  const ownerContract = new ethers.Contract(contractAddress, artifact.abi, owner);

  console.log("QA contract:", contractAddress);
  console.log("Owner:", owner.address);
  console.log("Ephemeral subscriber:", subscriber.address);

  const fundTx = await owner.sendTransaction({
    to: subscriber.address,
    value: ethers.parseEther("0.006"),
  });
  await fundTx.wait();
  console.log("Subscriber funded:", fundTx.hash);

  const ownerClient = await createClient(provider, owner);
  const subscriberClient = await createClient(provider, subscriber);

  const [whale, amount, confidence, entry, risk] = await ownerClient
    .encryptInputs([
      Encryptable.address("0x000000000000000000000000000000000000dEaD"),
      Encryptable.uint64(777000n),
      Encryptable.uint32(9300n),
      Encryptable.uint32(1610n),
      Encryptable.uint32(2100n),
    ])
    .execute();

  const publishTx = await ownerContract.publishSignal(
    0,
    "QA smart wallet accumulated privacy infrastructure",
    "A seeded QA signal proves publish, subscription, ACL grant, and decrypt on Sepolia.",
    "FHE",
    "Privacy Infrastructure",
    1,
    whale,
    amount,
    confidence,
    entry,
    risk
  );
  await publishTx.wait();
  const signalId = (await ownerContract.signalCount()) - 1n;
  console.log("Signal published:", publishTx.hash, "id", signalId.toString());

  const subscriberContract = new ethers.Contract(
    contractAddress,
    artifact.abi,
    subscriber
  );

  let deniedBeforeSubscribe = false;
  try {
    await subscriberContract.grantSignalAccess(signalId);
  } catch {
    deniedBeforeSubscribe = true;
  }
  if (!deniedBeforeSubscribe) {
    throw new Error("grantSignalAccess should fail before subscription.");
  }
  console.log("Pre-subscription access correctly denied");

  const price = await ownerContract.tierPriceWei(1);
  const subscribeTx = await subscriberContract.subscribe(1, 1, { value: price });
  await subscribeTx.wait();
  console.log("Subscriber subscribed:", subscribeTx.hash);

  const grantTx = await subscriberContract.grantSignalAccess(signalId);
  await grantTx.wait();
  console.log("Signal access granted:", grantTx.hash);

  const signal = await subscriberContract.getSignal(signalId);
  const decryptedWhale = await subscriberClient
    .decryptForView(signal.encryptedWhale, FheTypes.Uint160)
    .execute();
  const decryptedAmount = await subscriberClient
    .decryptForView(signal.encryptedAmountUsd, FheTypes.Uint64)
    .execute();
  const decryptedConfidence = await subscriberClient
    .decryptForView(signal.encryptedConfidenceBps, FheTypes.Uint32)
    .execute();

  if (decryptedWhale.toLowerCase() !== "0x000000000000000000000000000000000000dead") {
    throw new Error("Wrong decrypted whale address.");
  }
  if (decryptedAmount !== 777000n || decryptedConfidence !== 9300n) {
    throw new Error("Wrong decrypted signal values.");
  }
  console.log("Signal decrypted:", {
    whale: decryptedWhale,
    amount: decryptedAmount.toString(),
    confidence: decryptedConfidence.toString(),
  });

  const [watchWallet, watchConfidence] = await subscriberClient
    .encryptInputs([
      Encryptable.address("0x000000000000000000000000000000000000bEEF"),
      Encryptable.uint32(8800n),
    ])
    .execute();
  const watchTx = await subscriberContract.addWatchlistItem(
    ethers.id(`qa:${subscriber.address}`),
    "QA encrypted watchlist",
    watchWallet,
    watchConfidence
  );
  await watchTx.wait();
  const watchIndex = (await subscriberContract.watchlistCount(subscriber.address)) - 1n;
  const watchItem = await subscriberContract.getWatchlistItem(
    subscriber.address,
    watchIndex
  );
  const decryptedWatchWallet = await subscriberClient
    .decryptForView(watchItem.encryptedWallet, FheTypes.Uint160)
    .execute();
  const decryptedWatchConfidence = await subscriberClient
    .decryptForView(watchItem.encryptedMinConfidenceBps, FheTypes.Uint32)
    .execute();
  if (
    decryptedWatchWallet.toLowerCase() !==
      "0x000000000000000000000000000000000000beef" ||
    decryptedWatchConfidence !== 8800n
  ) {
    throw new Error("Wrong decrypted watchlist values.");
  }
  console.log("Watchlist decrypted:", {
    wallet: decryptedWatchWallet,
    threshold: decryptedWatchConfidence.toString(),
  });

  const [score] = await ownerClient
    .encryptInputs([Encryptable.uint32(9700n)])
    .execute();
  const scoreTx = await ownerContract.setAnalystScore(owner.address, score);
  await scoreTx.wait();
  const scoreGrantTx = await subscriberContract.grantAnalystScoreAccess(owner.address);
  await scoreGrantTx.wait();
  const scoreHandle = await subscriberContract.getAnalystScore(owner.address);
  const decryptedScore = await subscriberClient
    .decryptForView(scoreHandle, FheTypes.Uint32)
    .execute();
  if (decryptedScore !== 9700n) {
    throw new Error("Wrong decrypted analyst score.");
  }
  console.log("Analyst score decrypted:", decryptedScore.toString());
  console.log("LIVE_QA_OK");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
