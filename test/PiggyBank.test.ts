import { expect } from "chai";
import { ethers } from "hardhat";
import { PiggyBank } from "../typechain-types";

describe("PiggyBank (classic)", () => {
  let piggy: PiggyBank;
  let ownerAddress: string;
  let otherAddress: string;

  beforeEach(async () => {
    const [owner, other] = await ethers.getSigners();
    ownerAddress = owner.address;
    otherAddress = other.address;
    const Factory = await ethers.getContractFactory("PiggyBank", owner);
    piggy = (await Factory.deploy()) as unknown as PiggyBank;
    await piggy.waitForDeployment();
  });

  it("sets the deployer as owner", async () => {
    expect(await piggy.owner()).to.equal(ownerAddress);
  });

  it("starts with a zero balance", async () => {
    expect(await piggy.getBalance()).to.equal(0n);
  });

  it("accumulates deposits", async () => {
    await piggy.deposit(100n);
    await piggy.deposit(50n);
    expect(await piggy.getBalance()).to.equal(150n);
  });

  it("lets the owner withdraw up to the balance", async () => {
    await piggy.deposit(100n);
    await piggy.withdraw(30n);
    expect(await piggy.getBalance()).to.equal(70n);
  });

  it("reverts when a non-owner tries to withdraw", async () => {
    await piggy.deposit(100n);
    const other = await ethers.getSigner(otherAddress);
    await expect(piggy.connect(other).withdraw(10n)).to.be.revertedWith("not owner");
  });

  it("reverts when withdrawing more than the balance", async () => {
    await piggy.deposit(10n);
    await expect(piggy.withdraw(999n)).to.be.revertedWith("insufficient balance");
  });

  it("exposes 'private' balance via eth_getStorageAt — the whole point of the workshop", async () => {
    await piggy.deposit(12345n);
    // `balance` is at storage slot 0.
    const raw = await ethers.provider.getStorage(await piggy.getAddress(), 0);
    expect(BigInt(raw)).to.equal(12345n);
  });
});
