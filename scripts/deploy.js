const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = await hre.ethers.provider.getNetwork();
  const balance = await hre.ethers.provider.getBalance(deployer.address);

  console.log("Deploying SilentWhale");
  console.log("Network:", hre.network.name, Number(network.chainId));
  console.log("Deployer:", deployer.address);
  console.log("Balance:", hre.ethers.formatEther(balance), "ETH");

  const SilentWhale = await hre.ethers.getContractFactory("SilentWhale");
  const silentWhale = await SilentWhale.deploy(deployer.address);
  await silentWhale.waitForDeployment();

  const address = await silentWhale.getAddress();
  const deployTx = silentWhale.deploymentTransaction();
  const deployReceipt = deployTx ? await deployTx.wait() : undefined;
  console.log("SilentWhale deployed:", address);

  const defaultSepoliaUsdc =
    hre.network.name === "eth-sepolia"
      ? "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"
      : undefined;
  const paymentToken =
    process.env.NEXT_PUBLIC_USDC_ADDRESS ||
    process.env.USDC_ADDRESS ||
    defaultSepoliaUsdc;
  if (paymentToken && hre.ethers.isAddress(paymentToken)) {
    const decimals = Number(process.env.USDC_DECIMALS || "6");
    const configTx = await silentWhale.setPaymentToken(paymentToken, decimals, true);
    await configTx.wait();
    console.log("Payment token enabled:", paymentToken, "decimals", decimals);
  }

  const deployment = {
    contract: "SilentWhale",
    address,
    network: hre.network.name,
    chainId: Number(network.chainId),
    deployer: deployer.address,
    deployTx: deployTx?.hash || null,
    deployedBlock: deployReceipt?.blockNumber || null,
    paymentToken: paymentToken || null,
    features: [
      "encrypted-signals",
      "erc20-subscriptions",
      "payment-receipts",
      "dao-teams",
      "analyst-marketplace",
      "signal-lifecycle",
      "alert-receipts",
    ],
    deployedAt: new Date().toISOString(),
  };

  const deploymentsDir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(deploymentsDir, { recursive: true });
  fs.writeFileSync(
    path.join(deploymentsDir, `silentwhale.${hre.network.name}.json`),
    JSON.stringify(deployment, null, 2)
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
