import { ethers, network } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Network : ${network.name}`);
  console.log(`Deployer: ${deployer.address}`);

  const Factory = await ethers.getContractFactory("PiggyBank");
  const piggy = await Factory.deploy();
  await piggy.waitForDeployment();

  const address = await piggy.getAddress();
  console.log(`PiggyBank deployed at: ${address}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
