const hre = require("hardhat");
const { expect } = require("chai");
const { Encryptable, FheTypes } = require("@cofhe/sdk");

describe("SilentWhale", function () {
  let owner;
  let analyst;
  let subscriber;
  let outsider;
  let teamMember;
  let ownerClient;
  let analystClient;
  let subscriberClient;
  let outsiderClient;
  let contract;
  let usdc;

  const whaleAddress = "0x0000000000000000000000000000000000001001";
  const watchedWallet = "0x0000000000000000000000000000000000001002";

  async function encryptSignal(client, values = {}) {
    return client
      .encryptInputs([
        Encryptable.address(values.whale || whaleAddress),
        Encryptable.uint64(values.amount || 500000n),
        Encryptable.uint32(values.confidence || 9200n),
        Encryptable.uint32(values.entry || 1440n),
        Encryptable.uint32(values.risk || 1800n),
      ])
      .execute();
  }

  async function publishSignal(signer, encrypted, overrides = {}) {
    const tx = await contract.connect(signer).publishSignal(
      overrides.feedId ?? 0,
      overrides.headline || "Test encrypted signal",
      overrides.summary ||
        "Contract test signal for encrypted publish and decrypt flows.",
      overrides.token || "TEST",
      overrides.sector || "Testing",
      overrides.movementType || "Accumulation",
      overrides.venue || "DEX",
      overrides.sourceChain || "Ethereum Sepolia",
      overrides.eventRef || "mock:indexer:1",
      overrides.aiModel || "silent-score-v1",
      overrides.scoreProvenance || "cofhe-mock-test",
      overrides.minTier ?? 1,
      encrypted[0],
      encrypted[1],
      encrypted[2],
      encrypted[3],
      encrypted[4]
    );
    await tx.wait();
    return (await contract.signalCount()) - 1n;
  }

  before(async function () {
    [owner, analyst, subscriber, outsider, teamMember] =
      await hre.ethers.getSigners();
    ownerClient = await hre.cofhe.createClientWithBatteries(owner);
    analystClient = await hre.cofhe.createClientWithBatteries(analyst);
    subscriberClient = await hre.cofhe.createClientWithBatteries(subscriber);
    outsiderClient = await hre.cofhe.createClientWithBatteries(outsider);
  });

  beforeEach(async function () {
    const SilentWhale = await hre.ethers.getContractFactory("SilentWhale");
    contract = await SilentWhale.deploy(owner.address);
    await contract.waitForDeployment();

    const MockUSDC = await hre.ethers.getContractFactory("MockUSDC");
    usdc = await MockUSDC.deploy();
    await usdc.waitForDeployment();
  });

  it("publishes encrypted whale signals and grants subscribers decrypt access", async function () {
    await contract.connect(owner).setAnalystStatus(analyst.address, true);

    const encrypted = await encryptSignal(analystClient);
    await publishSignal(analyst, encrypted);

    expect(await contract.signalCount()).to.equal(1n);

    let rejected = false;
    try {
      await contract.connect(outsider).grantSignalAccess(0);
    } catch (error) {
      rejected = true;
      expect(error.message).to.include("TierTooLow");
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
    const encrypted = await encryptSignal(analystClient, {
      amount: 125000n,
      confidence: 8100n,
      entry: 2200n,
      risk: 3500n,
    });

    let rejected = false;
    try {
      await publishSignal(analyst, encrypted, {
        headline: "Unapproved signal",
        summary: "This should not land in a curated feed.",
        token: "BAD",
        sector: "Test",
      });
    } catch (error) {
      rejected = true;
      expect(error.message).to.include("AnalystNotApproved");
    }
    expect(rejected).to.equal(true);

    await contract.connect(owner).setAnalystStatus(analyst.address, true);
    await publishSignal(analyst, encrypted, {
      headline: "Approved signal",
      summary: "Approved analysts can publish after the owner grants status.",
      token: "OK",
      sector: "Test",
    });

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

  it("lets the owner write encrypted analyst reputation and profiles", async function () {
    const [encryptedScore] = await ownerClient
      .encryptInputs([Encryptable.uint32(9700n)])
      .execute();

    const scoreTx = await contract
      .connect(owner)
      .setAnalystScore(analyst.address, encryptedScore);
    await scoreTx.wait();

    await contract
      .connect(owner)
      .setAnalystProfileFor(
        analyst.address,
        "Whale Desk",
        "Tracks repeat smart-money accumulation.",
        "Large-cap rotation and privacy infrastructure.",
        "ipfs://silentwhale/analysts/whale-desk",
        true
      );

    await contract.connect(analyst).grantAnalystScoreAccess(analyst.address);
    const handle = await contract.getAnalystScore(analyst.address);
    const score = await analystClient
      .decryptForView(handle, FheTypes.Uint32)
      .execute();
    const profile = await contract.getAnalystProfile(analyst.address);

    expect(score).to.equal(9700n);
    expect(profile.displayName).to.equal("Whale Desk");
    expect(await contract.hasAnalystProfile(analyst.address)).to.equal(true);
  });

  it("settles subscriptions in ERC20, records receipts, and withdraws token treasury", async function () {
    const usdcAddress = await usdc.getAddress();
    await contract.connect(owner).setPaymentToken(usdcAddress, 6, true);
    await contract.connect(owner).setTierTokenPrice(1, 19000000n);

    await usdc.mint(subscriber.address, 19000000n);
    await usdc
      .connect(subscriber)
      .approve(await contract.getAddress(), 19000000n);

    const subscribeTx = await contract.connect(subscriber).subscribeWithToken(1, 1);
    await subscribeTx.wait();

    expect(await contract.effectiveTier(subscriber.address)).to.equal(1n);
    expect(await contract.receiptCount(subscriber.address)).to.equal(1n);
    expect(await usdc.balanceOf(await contract.getAddress())).to.equal(19000000n);

    const receipt = await contract.getPaymentReceipt(subscriber.address, 0);
    expect(receipt.token).to.equal(usdcAddress);
    expect(receipt.amount).to.equal(19000000n);

    const ownerBefore = await usdc.balanceOf(owner.address);
    await contract
      .connect(owner)
      .withdrawToken(usdcAddress, owner.address, 19000000n);
    expect(await usdc.balanceOf(owner.address)).to.equal(ownerBefore + 19000000n);
  });

  it("does not turn remaining lower-tier time into higher-tier access", async function () {
    await contract
      .connect(subscriber)
      .subscribe(1, 12, { value: hre.ethers.parseEther("0.012") });
    const proSub = await contract.subscriptionOf(subscriber.address);

    await contract
      .connect(subscriber)
      .subscribe(3, 1, { value: hre.ethers.parseEther("0.01") });
    const daoSub = await contract.subscriptionOf(subscriber.address);

    expect(daoSub.tier).to.equal(3n);
    expect(daoSub.expiresAt < proSub.expiresAt).to.equal(true);

    const now = BigInt((await hre.ethers.provider.getBlock("latest")).timestamp);
    const month = 30n * 24n * 60n * 60n;
    expect(daoSub.expiresAt <= now + month + 5n).to.equal(true);
  });

  it("shares DAO-tier signal access with team seats", async function () {
    await contract
      .connect(subscriber)
      .subscribe(3, 1, { value: hre.ethers.parseEther("0.01") });

    const createTx = await contract
      .connect(subscriber)
      .createTeam(hre.ethers.id("DAO intelligence desk"), 3);
    await createTx.wait();

    await contract.connect(subscriber).addTeamMember(0, outsider.address);
    expect(await contract.effectiveTier(outsider.address)).to.equal(3n);

    const encrypted = await encryptSignal(ownerClient, {
      amount: 1250000n,
      confidence: 9600n,
      entry: 2400n,
      risk: 3100n,
    });
    const signalId = await publishSignal(owner, encrypted, {
      feedId: 2,
      minTier: 3,
      headline: "DAO desk saw bridge concentration",
      sector: "Cross-chain Liquidity",
      movementType: "Bridge",
      venue: "Bridge",
    });

    await contract.connect(outsider).grantSignalAccess(signalId);
    const signal = await contract.getSignal(signalId);
    const amount = await outsiderClient
      .decryptForView(signal.encryptedAmountUsd, FheTypes.Uint64)
      .execute();

    expect(amount).to.equal(1250000n);

    await contract.connect(subscriber).removeTeamMember(0, outsider.address);
    expect(await contract.effectiveTier(outsider.address)).to.equal(0n);
  });

  it("updates signal lifecycle metadata and blocks inactive unlocks", async function () {
    await contract.connect(owner).setAnalystStatus(analyst.address, true);
    const encrypted = await encryptSignal(analystClient);
    const signalId = await publishSignal(analyst, encrypted);

    await contract.connect(analyst).updateSignalMetadata(
      signalId,
      "Updated signal",
      "Updated public thesis after analyst review.",
      "FHE",
      "Privacy Infrastructure",
      "CEX outflow",
      "CEX",
      "Ethereum Sepolia",
      "mock:indexer:2",
      "silent-score-v1.1",
      "manual-review:analyst",
      1,
      true
    );

    let signal = await contract.getSignal(signalId);
    expect(signal.headline).to.equal("Updated signal");
    expect(signal.movementType).to.equal("CEX outflow");

    await contract.connect(analyst).setSignalActive(signalId, false);
    signal = await contract.getSignal(signalId);
    expect(signal.active).to.equal(false);

    await contract
      .connect(subscriber)
      .subscribe(1, 1, { value: hre.ethers.parseEther("0.001") });
    expect(await contract.canAccessSignal(subscriber.address, signalId)).to.equal(
      false
    );
  });

  it("records alert history without exposing private watchlist strategy", async function () {
    const encrypted = await encryptSignal(ownerClient);
    const signalId = await publishSignal(owner, encrypted);
    const ruleHash = hre.ethers.id("subscriber:private-rule");

    await contract
      .connect(owner)
      .recordAlert(subscriber.address, ruleHash, signalId, "telegram", "sent:1");

    expect(await contract.alertCount(subscriber.address)).to.equal(1n);
    const alert = await contract.getAlert(subscriber.address, 0);
    expect(alert.ruleHash).to.equal(ruleHash);
    expect(alert.read).to.equal(false);

    await contract.connect(subscriber).markAlertRead(0, true);
    const updated = await contract.getAlert(subscriber.address, 0);
    expect(updated.read).to.equal(true);
  });
});
