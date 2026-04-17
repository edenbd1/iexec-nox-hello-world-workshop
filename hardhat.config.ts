import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const PRIVATE_KEY = process.env.PRIVATE_KEY ?? "";
const ARBITRUM_SEPOLIA_RPC_URL =
  process.env.ARBITRUM_SEPOLIA_RPC_URL ?? "https://sepolia-rollup.arbitrum.io/rpc";
const ARBISCAN_API_KEY = process.env.ARBISCAN_API_KEY ?? "";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.27",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      viaIR: true,
    },
  },
  networks: {
    hardhat: { chainId: 31337 },
    arbitrumSepolia: {
      url: ARBITRUM_SEPOLIA_RPC_URL,
      chainId: 421614,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    },
  },
  etherscan: {
    apiKey: ARBISCAN_API_KEY,
  },
  sourcify: {
    enabled: false,
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};

export default config;
