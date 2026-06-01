require("dotenv").config();
require("@nomicfoundation/hardhat-ethers");
require("@cofhe/hardhat-plugin");

const normalizePrivateKey = (key) => {
  if (!key) return undefined;
  return key.startsWith("0x") ? key : `0x${key}`;
};

const accounts = process.env.PRIVATE_KEY
  ? [normalizePrivateKey(process.env.PRIVATE_KEY)]
  : [];

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.28",
    settings: {
      evmVersion: "cancun",
      viaIR: true,
      optimizer: {
        enabled: true,
        runs: 1,
      },
    },
  },
  networks: {
    "eth-sepolia": {
      url:
        process.env.SEPOLIA_RPC_URL ||
        "https://ethereum-sepolia-rpc.publicnode.com",
      chainId: 11155111,
      accounts,
    },
    "arb-sepolia": {
      url:
        process.env.ARBITRUM_SEPOLIA_RPC_URL ||
        "https://sepolia-rollup.arbitrum.io/rpc",
      chainId: 421614,
      accounts,
    },
    "base-sepolia": {
      url:
        process.env.BASE_SEPOLIA_RPC_URL ||
        "https://sepolia.base.org",
      chainId: 84532,
      accounts,
    },
  },
  cofhe: {
    logMocks: false,
    gasWarning: true,
  },
};
