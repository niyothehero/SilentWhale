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
  console.log("SilentWhale deployed:", address);

  const deployment = {
    contract: "SilentWhale",
    address,
    network: hre.network.name,
    chainId: Number(network.chainId),
    deployer: deployer.address,
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
