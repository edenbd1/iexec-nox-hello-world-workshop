import { ethers, network } from "hardhat";

async function main() {
  if (network.config.chainId !== 421614) {
    throw new Error(
      `ConfidentialPiggyBank requires Arbitrum Sepolia (chainId 421614). Current: ${network.config.chainId}`,
    );
  }

  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Network : ${network.name} (chainId ${network.config.chainId})`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance : ${ethers.formatEther(balance)} ETH`);

  if (balance === 0n) {
    throw new Error(
      "Deployer has 0 ETH on Arbitrum Sepolia. Top up via https://faucet.quicknode.com/arbitrum/sepolia",
    );
  }

  const Factory = await ethers.getContractFactory("ConfidentialPiggyBank");
  const piggy = await Factory.deploy();
  await piggy.waitForDeployment();

  const address = await piggy.getAddress();
  const tx = piggy.deploymentTransaction();
  console.log(`ConfidentialPiggyBank deployed at: ${address}`);
  console.log(`Tx hash: ${tx?.hash}`);
  console.log(`Arbiscan: https://sepolia.arbiscan.io/address/${address}`);
  console.log(`\nNext step — export this address and run the interact script:\n`);
  console.log(`  export CONFIDENTIAL_PIGGY=${address}`);
  console.log(`  npm run interact:sepolia`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
