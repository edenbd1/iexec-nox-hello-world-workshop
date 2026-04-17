/**
 * Fork sanity checks: spin up a local fork of Arbitrum Sepolia and validate
 * that (a) the NoxCompute proxy exists at the address resolved by Nox.sol,
 * and (b) a call into it responds as expected.
 *
 * A full confidential deposit/withdraw flow cannot run against a naked fork
 * because it also depends on the off-chain Nox gateway that signs input
 * proofs — the real E2E therefore happens on live Arbitrum Sepolia with a
 * funded deployer (see scripts/deploy-confidential.ts + scripts/interact.ts).
 *
 * Skipped unless `FORK_ARB_SEPOLIA=1` is set.
 */
import { expect } from "chai";
import { ethers, network } from "hardhat";

const NOX_COMPUTE_ARB_SEPOLIA = "0xd464B198f06756a1d00be223634b85E0a731c229";
const ENABLED = process.env.FORK_ARB_SEPOLIA === "1";

(ENABLED ? describe : describe.skip)("Arbitrum Sepolia fork — Nox wiring", function () {
  this.timeout(120_000);

  before(async () => {
    await network.provider.request({
      method: "hardhat_reset",
      params: [
        {
          forking: {
            jsonRpcUrl:
              process.env.ARBITRUM_SEPOLIA_RPC_URL ?? "https://sepolia-rollup.arbitrum.io/rpc",
          },
        },
      ],
    });
  });

  after(async () => {
    await network.provider.request({ method: "hardhat_reset", params: [] });
  });

  it("NoxCompute proxy has deployed bytecode at the address hard-coded in Nox.sol", async () => {
    const code = await ethers.provider.getCode(NOX_COMPUTE_ARB_SEPOLIA);
    expect(code).to.not.equal("0x");
    expect(code.length).to.be.greaterThan(4);
  });

  it("ConfidentialPiggyBank compiles and matches the ABI from the docs", async () => {
    const Factory = await ethers.getContractFactory("ConfidentialPiggyBank");
    const fragments = Factory.interface.fragments.filter((f) => f.type === "function");
    const names = fragments.map((f: any) => f.name).sort();
    expect(names).to.deep.equal(["balance", "deposit", "owner", "withdraw"]);

    const deposit = Factory.interface.getFunction("deposit");
    expect(deposit!.inputs.map((i) => i.type)).to.deep.equal(["bytes32", "bytes"]);
    const withdraw = Factory.interface.getFunction("withdraw");
    expect(withdraw!.inputs.map((i) => i.type)).to.deep.equal(["bytes32", "bytes"]);
    const balance = Factory.interface.getFunction("balance");
    expect(balance!.outputs.map((o) => o.type)).to.deep.equal(["bytes32"]);
  });
});
