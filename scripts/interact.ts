/**
 * Encrypts a deposit amount using the Nox handle SDK, submits it to the
 * ConfidentialPiggyBank contract, then decrypts the resulting balance handle.
 *
 * Usage:
 *   export CONFIDENTIAL_PIGGY=0xYourDeployedAddress
 *   export AMOUNT=100              # optional, defaults to 100
 *   npm run interact:sepolia
 */
import { ethers, network } from "hardhat";
import { createEthersHandleClient } from "@iexec-nox/handle";

async function main() {
  if (network.config.chainId !== 421614) {
    throw new Error("This script only runs on Arbitrum Sepolia (chainId 421614).");
  }

  const contractAddress = process.env.CONFIDENTIAL_PIGGY;
  if (!contractAddress) {
    throw new Error("Set CONFIDENTIAL_PIGGY env var to the deployed contract address.");
  }

  const amount = BigInt(process.env.AMOUNT ?? "100");
  const [signer] = await ethers.getSigners();
  console.log(`Signer   : ${signer.address}`);
  console.log(`Contract : ${contractAddress}`);
  console.log(`Amount   : ${amount}`);

  const piggy = await ethers.getContractAt("ConfidentialPiggyBank", contractAddress, signer);

  const handleClient = await createEthersHandleClient(signer);

  console.log("\n[1/3] Encrypting amount via Nox gateway…");
  const { handle, handleProof } = await handleClient.encryptInput(
    amount,
    "uint256",
    contractAddress,
  );
  console.log(`      handle      : ${handle}`);
  console.log(`      handleProof : ${handleProof.slice(0, 66)}… (${handleProof.length / 2 - 1} bytes)`);

  console.log("\n[2/3] Calling deposit(handle, handleProof)…");
  const tx = await piggy.deposit(handle, handleProof);
  console.log(`      tx hash: ${tx.hash}`);
  await tx.wait();

  console.log("\n[3/3] Reading and decrypting balance handle…");
  const balanceHandle: string = await piggy.balance();
  console.log(`      balance handle: ${balanceHandle}`);
  const { value } = await handleClient.decrypt(balanceHandle);
  console.log(`\n  Decrypted balance: ${value}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
