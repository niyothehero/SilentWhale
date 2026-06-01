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
  if (process.env.ALLOW_LIVE_QA_MUTATION !== "true") {
    throw new Error(
      "Live QA mutates the configured contract. Set ALLOW_LIVE_QA_MUTATION=true only for a disposable QA deployment."
    );
  }

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

  const qaWhaleAddress =
    process.env.QA_SIGNAL_WALLET || ethers.Wallet.createRandom().address;
  const qaWatchWallet =
    process.env.QA_WATCH_WALLET || ethers.Wallet.createRandom().address;
  const subscriberFundEth = process.env.QA_SUBSCRIBER_FUND_ETH || "0.03";
  const fundTx = await owner.sendTransaction({
    to: subscriber.address,
    value: ethers.parseEther(subscriberFundEth),
  });
  await fundTx.wait();
  console.log("Subscriber funded:", fundTx.hash, `${subscriberFundEth} ETH`);

  const ownerClient = await createClient(provider, owner);
  const subscriberClient = await createClient(provider, subscriber);

  const [whale, amount, confidence, entry, risk] = await ownerClient
    .encryptInputs([
      Encryptable.address(qaWhaleAddress),
      Encryptable.uint64(777000n),
      Encryptable.uint32(9300n),
      Encryptable.uint32(1610n),
      Encryptable.uint32(2100n),
    ])
    .execute();

  const publishTx = await ownerContract.publishSignal(
    0,
    "QA encrypted signal",
    "Disposable QA signal for publish, subscription, ACL grant, and decrypt checks.",
    "QA",
    "Testing",
    "Accumulation",
    "DEX",
    "Ethereum Sepolia",
    `qa:${Date.now()}`,
    "silent-score-v1.1",
    "live-qa",
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

  if (decryptedWhale.toLowerCase() !== qaWhaleAddress.toLowerCase()) {
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
      Encryptable.address(qaWatchWallet),
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
    decryptedWatchWallet.toLowerCase() !== qaWatchWallet.toLowerCase() ||
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

  const profileTx = await ownerContract.setAnalystProfileFor(
    owner.address,
    "SilentWhale QA Desk",
    "Live QA profile for Wave 5 analyst marketplace checks.",
    "Privacy infrastructure, exchange flows, and bridge concentration.",
    "ipfs://silentwhale/qa-desk",
    true
  );
  await profileTx.wait();
  console.log("Analyst profile recorded:", profileTx.hash);

  const daoExpiry = BigInt(Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60);
  const ownerGrantTx = await ownerContract.grantSubscription(owner.address, 3, daoExpiry);
  await ownerGrantTx.wait();
  const teamTx = await ownerContract.createTeam(ethers.id(`qa-team:${Date.now()}`), 5);
  await teamTx.wait();
  const teamId = (await ownerContract.teamCount()) - 1n;
  const seatTx = await ownerContract.addTeamMember(teamId, subscriber.address);
  await seatTx.wait();
  const teamTier = await ownerContract.effectiveTier(subscriber.address);
  if (teamTier < 3n) {
    throw new Error("DAO team tier was not inherited by the member.");
  }
  console.log("DAO team seat granted:", seatTx.hash, "team", teamId.toString());

  const alertTx = await ownerContract.recordAlert(
    subscriber.address,
    ethers.id(`qa-alert:${subscriber.address}`),
    signalId,
    "in-app",
    `qa:${Date.now()}`
  );
  await alertTx.wait();
  const alertId = (await ownerContract.alertCount(subscriber.address)) - 1n;
  const alertReadTx = await subscriberContract.markAlertRead(alertId, true);
  await alertReadTx.wait();
  const alert = await ownerContract.getAlert(subscriber.address, alertId);
  if (!alert.read) {
    throw new Error("Alert read state was not updated.");
  }
  console.log("Alert receipt recorded:", alertTx.hash);

  console.log("LIVE_QA_OK");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
