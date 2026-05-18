const hre = require("hardhat");
const { expect } = require("chai");
const { Encryptable, FheTypes } = require("@cofhe/sdk");

describe("SilentWhale", function () {
  let owner;
  let analyst;
  let subscriber;
  let outsider;
  let ownerClient;
  let analystClient;
  let subscriberClient;
  let contract;

  const whaleAddress = "0x000000000000000000000000000000000000dEaD";
  const watchedWallet = "0x000000000000000000000000000000000000bEEF";

  before(async function () {
    [owner, analyst, subscriber, outsider] = await hre.ethers.getSigners();
    ownerClient = await hre.cofhe.createClientWithBatteries(owner);
    analystClient = await hre.cofhe.createClientWithBatteries(analyst);
    subscriberClient = await hre.cofhe.createClientWithBatteries(subscriber);
  });

  beforeEach(async function () {
    const SilentWhale = await hre.ethers.getContractFactory("SilentWhale");
    contract = await SilentWhale.deploy(owner.address);
    await contract.waitForDeployment();
  });

  it("publishes encrypted whale signals and grants subscribers decrypt access", async function () {
    await contract.connect(owner).setAnalystStatus(analyst.address, true);

    const [
      encryptedWhale,
      encryptedAmount,
      encryptedConfidence,
      encryptedEntry,
      encryptedRisk,
    ] = await analystClient
      .encryptInputs([
        Encryptable.address(whaleAddress),
        Encryptable.uint64(500000n),
        Encryptable.uint32(9200n),
        Encryptable.uint32(1440n),
        Encryptable.uint32(1800n),
      ])
      .execute();

    const publishTx = await contract.connect(analyst).publishSignal(
      0,
      "Tier-1 wallet accumulated an AI sector token",
      "A smart wallet is building a position while public attention is still low.",
      "AI",
      "Artificial Intelligence",
      1,
      encryptedWhale,
      encryptedAmount,
      encryptedConfidence,
      encryptedEntry,
      encryptedRisk
    );
    await publishTx.wait();

    expect(await contract.signalCount()).to.equal(1n);

    let rejected = false;
    try {
      await contract.connect(outsider).grantSignalAccess(0);
    } catch (error) {
      rejected = true;
      expect(error.message).to.include("tier too low");
    }
    expect(rejected).to.equal(true);

    await contract
      .connect(subscriber)
      .subscribe(1, 1, { value: hre.ethers.parseEther("0.001") });

    const grantTx = await contract.connect(subscriber).grantSignalAccess(0);
    await grantTx.wait();

    const signal = await contract.getSignal(0);
    const whale = await subscriberClient
      .decryptForView(signal.encryptedWhale, FheTypes.Uint160)
      .execute();
    const amount = await subscriberClient
      .decryptForView(signal.encryptedAmountUsd, FheTypes.Uint64)
      .execute();
    const confidence = await subscriberClient
      .decryptForView(signal.encryptedConfidenceBps, FheTypes.Uint32)
      .execute();

    expect(whale.toLowerCase()).to.equal(whaleAddress.toLowerCase());
    expect(amount).to.equal(500000n);
    expect(confidence).to.equal(9200n);
  });

  it("rejects unapproved analysts before allowing curated publishing", async function () {
    const [
      encryptedWhale,
      encryptedAmount,
      encryptedConfidence,
      encryptedEntry,
      encryptedRisk,
    ] = await analystClient
      .encryptInputs([
        Encryptable.address(whaleAddress),
        Encryptable.uint64(125000n),
        Encryptable.uint32(8100n),
        Encryptable.uint32(2200n),
        Encryptable.uint32(3500n),
      ])
      .execute();

    let rejected = false;
    try {
      await contract.connect(analyst).publishSignal(
        0,
        "Unapproved signal",
        "This should not land in a curated feed.",
        "BAD",
        "Test",
        1,
        encryptedWhale,
        encryptedAmount,
        encryptedConfidence,
        encryptedEntry,
        encryptedRisk
      );
    } catch (error) {
      rejected = true;
      expect(error.message).to.include("analyst not approved");
    }
    expect(rejected).to.equal(true);

    await contract.connect(owner).setAnalystStatus(analyst.address, true);
    const publishTx = await contract.connect(analyst).publishSignal(
      0,
      "Approved signal",
      "Approved analysts can publish after the owner grants status.",
      "OK",
      "Test",
      1,
      encryptedWhale,
      encryptedAmount,
      encryptedConfidence,
      encryptedEntry,
      encryptedRisk
    );
    await publishTx.wait();

    expect(await contract.signalCount()).to.equal(1n);
  });

  it("stores private watchlists as encrypted on-chain handles", async function () {
    const [encryptedWallet, encryptedThreshold] = await subscriberClient
      .encryptInputs([
        Encryptable.address(watchedWallet),
        Encryptable.uint32(8500n),
      ])
      .execute();

    const labelHash = hre.ethers.id("AI accumulation watch");

    const watchTx = await contract
      .connect(subscriber)
      .addWatchlistItem(
        labelHash,
        "AI sector smart-money alerts",
        encryptedWallet,
        encryptedThreshold
      );
    await watchTx.wait();

    expect(await contract.watchlistCount(subscriber.address)).to.equal(1n);

    const item = await contract.getWatchlistItem(subscriber.address, 0);
    const wallet = await subscriberClient
      .decryptForView(item.encryptedWallet, FheTypes.Uint160)
      .execute();
    const threshold = await subscriberClient
      .decryptForView(item.encryptedMinConfidenceBps, FheTypes.Uint32)
      .execute();

    expect(item.labelHash).to.equal(labelHash);
    expect(wallet.toLowerCase()).to.equal(watchedWallet.toLowerCase());
    expect(threshold).to.equal(8500n);
  });

  it("lets the owner write encrypted analyst reputation", async function () {
    const [encryptedScore] = await ownerClient
      .encryptInputs([Encryptable.uint32(9700n)])
      .execute();

    const scoreTx = await contract
      .connect(owner)
      .setAnalystScore(analyst.address, encryptedScore);
    await scoreTx.wait();

    await contract.connect(analyst).grantAnalystScoreAccess(analyst.address);
    const handle = await contract.getAnalystScore(analyst.address);
    const score = await analystClient
      .decryptForView(handle, FheTypes.Uint32)
      .execute();

    expect(score).to.equal(9700n);
  });
});
