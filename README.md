# iExec Nox — Hello World Workshop

A 30-minute workshop that takes a classic Solidity `PiggyBank` and turns it into a **confidential** smart contract using the [iExec Nox protocol](https://docs.iex.ec/nox-protocol/getting-started/hello-world).

By the end you will have:

1. Deployed a **plain** PiggyBank whose "private" balance is trivially readable via `eth_getStorageAt` (the problem).
2. Upgraded it to a **ConfidentialPiggyBank** where the balance and deposit/withdraw amounts live as encrypted handles, processed inside an Intel TDX enclave (the solution).
3. Interacted with the confidential contract on **Arbitrum Sepolia**, encrypting inputs and decrypting the final balance with the `@iexec-nox/handle` SDK.

> **Confidentiality, not anonymity.** Addresses and function selectors remain public on-chain. Only the numeric values you choose to encrypt are protected.

---

## What's in the repo

```
contracts/
  PiggyBank.sol                 # Classic — the starting point
  ConfidentialPiggyBank.sol     # Nox — the goal
scripts/
  deploy-classic.ts             # Deploy plain PiggyBank (any network)
  deploy-confidential.ts        # Deploy ConfidentialPiggyBank (Arbitrum Sepolia only)
  interact.ts                   # Encrypt amount → deposit → decrypt balance
test/
  PiggyBank.test.ts             # 7 unit tests including the storage-leak demo
hardhat.config.ts
WORKSHOP_PLAN.md                # Speaker notes (30-min flow)
```

---

## Prerequisites

- **Node.js ≥ 18** and **npm**
- A **MetaMask** (or compatible) wallet
- Add **Arbitrum Sepolia** to MetaMask:
  - RPC: `https://sepolia-rollup.arbitrum.io/rpc`
  - Chain ID: `421614`
  - Explorer: `https://sepolia.arbiscan.io`
- A bit of Sepolia ETH: [QuickNode faucet](https://faucet.quicknode.com/arbitrum/sepolia) or [Alchemy faucet](https://www.alchemy.com/faucets/arbitrum-sepolia)

---

## Setup

```bash
git clone https://github.com/edenbd1/iexec-nox-hello-world-workshop.git
cd iexec-nox-hello-world-workshop
npm install
cp .env.example .env
# Edit .env and paste your PRIVATE_KEY
```

---

## Step 1 — Compile

```bash
npm run compile
```

Both `PiggyBank.sol` and `ConfidentialPiggyBank.sol` compile against Solidity `0.8.27` with viaIR enabled (required for Nox's heavy inlining).

---

## Step 2 — Run the tests on the classic version

```bash
npm test
```

The suite includes a test that reads the "private" `balance` directly from storage slot 0 — this is the motivation for the entire workshop.

```ts
it("exposes 'private' balance via eth_getStorageAt — the whole point of the workshop", async () => {
  await piggy.deposit(12345n);
  const raw = await ethers.provider.getStorage(await piggy.getAddress(), 0);
  expect(BigInt(raw)).to.equal(12345n);
});
```

---

## Step 3 — Deploy the classic PiggyBank (optional, for contrast)

### In Remix (fastest for a live demo)

1. Open <https://remix.ethereum.org>
2. Paste `contracts/PiggyBank.sol`
3. In **Solidity Compiler**, pick `0.8.27` and click **Compile** (not *Compile and Run script* — that button needs a `@custom:dev-run-script` NatSpec tag and will throw the "You have not set a script to run" error otherwise).
4. In **Deploy & Run Transactions**, pick `Remix VM (Osaka)` → **Deploy**.
5. Under *Deployed Contracts*, call `deposit(100)` then `getBalance` and watch `100` come back.

### Locally via Hardhat

```bash
npx hardhat node                # in one terminal
npm run deploy:local            # in another
```

---

## Step 4 — Deploy the confidential version to Arbitrum Sepolia

```bash
npm run deploy:sepolia
```

Expected output:
```
Network : arbitrumSepolia (chainId 421614)
Deployer: 0x…
Balance : 0.0123 ETH
ConfidentialPiggyBank deployed at: 0xABCD…
Tx hash: 0x…
Arbiscan: https://sepolia.arbiscan.io/address/0xABCD…
```

Save the deployed address — the next step needs it.

---

## Step 5 — Interact: encrypt, deposit, decrypt

```bash
export CONFIDENTIAL_PIGGY=0xABCD…
export AMOUNT=100
npm run interact:sepolia
```

What the script does under the hood:

1. `handleClient.encryptInput(100n, "uint256", contractAddress)` → sends `100` to the Nox gateway over TLS, which encrypts it, stores the ciphertext off-chain, and returns `{ handle, handleProof }`.
2. `piggy.deposit(handle, handleProof)` → submits the tx. The contract calls `Nox.fromExternal()` to validate the proof and delegates the addition to the TEE.
3. `await piggy.balance()` → returns the *current* balance **handle** (a 32-byte pointer, not the value).
4. `handleClient.decrypt(balanceHandle)` → the gateway checks the ACL (set by `Nox.allow(balance, owner)` in the contract), returns the plaintext to the owner only.

Open the deposit tx on Arbiscan: the `handle` and `handleProof` are there in hex but carry no plaintext information.

---

## Workshop flow (30 minutes)

See [`WORKSHOP_PLAN.md`](./WORKSHOP_PLAN.md) for the full speaker plan: timing per segment, exact phrasing, the three key concepts (handles, ACLs, TEE), the Remix live-coding diffs, and fallback plans if something goes wrong on stage.

---

## References

- [Nox Hello World](https://docs.iex.ec/nox-protocol/getting-started/hello-world) — source of the code
- [`@iexec-nox/nox-protocol-contracts`](https://www.npmjs.com/package/@iexec-nox/nox-protocol-contracts) — Solidity library
- [`@iexec-nox/handle`](https://www.npmjs.com/package/@iexec-nox/handle) — TypeScript SDK for encrypt/decrypt
- Deployed `NoxCompute` on Arbitrum Sepolia: [`0xd464B198f06756a1d00be223634b85E0a731c229`](https://sepolia.arbiscan.io/address/0xd464B198f06756a1d00be223634b85E0a731c229)

---

## License

MIT — see the SPDX headers in each Solidity file. The Nox library itself is BUSL-1.1.
