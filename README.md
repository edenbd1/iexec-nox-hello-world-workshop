# iExec Nox — Hello World

Build your first **confidential** smart contract on Arbitrum Sepolia. You start with a plain Solidity piggy bank whose balance is readable by anyone. You finish with a version where only the owner can ever read the balance — and the blockchain itself never sees the plaintext.

Full walkthrough below. Clone the repo and follow the steps in order.

---

## What you need before you start

- **Node.js ≥ 18** and **npm**
- A **MetaMask** wallet (or any injected EVM wallet)
- **Arbitrum Sepolia** added to your wallet:
  - RPC: `https://sepolia-rollup.arbitrum.io/rpc`
  - Chain ID: `421614`
  - Explorer: `https://sepolia.arbiscan.io`
- A tiny bit of test ETH on Arbitrum Sepolia — use [QuickNode faucet](https://faucet.quicknode.com/arbitrum/sepolia) or [Alchemy faucet](https://www.alchemy.com/faucets/arbitrum-sepolia)

---

## Step 1 — Read the docs (5 minutes)

Open the iExec Nox docs: **https://docs.iex.ec/nox-protocol/getting-started/hello-world**

These are the three things to retain before you touch any code:

1. **Nox is a privacy layer for smart contracts.** You still write Solidity. But some values in your contract can live encrypted.
2. **Nox is confidentiality, not anonymity.** Your wallet address and the functions you call are still public on-chain. Only the **amounts** you choose to encrypt stay secret.
3. **Three words you will see everywhere:**
   - **Handle** — a 32-byte ID that points to an encrypted value stored off-chain. You'll see the type `euint256` in the code — that's a handle to an encrypted `uint256`.
   - **ACL** — on-chain access list. It says who's allowed to decrypt a given handle.
   - **TEE** — Trusted Execution Environment (Intel TDX). The hardware enclave where the actual computation on encrypted data happens off-chain.

> **Takeaway:** you write Solidity almost like usual. You just use a different type (`euint256`) for the values you want private, and you call helper functions from the `Nox` library to do math on them and manage who can read them.

---

## Step 2 — The difference between `uint256` and `euint256`

This is the core idea of the workshop. Look at both sides:

### Classic Solidity — `uint256`

```solidity
uint256 private balance;

function deposit(uint256 amount) external {
    balance += amount;
}
```

- `balance` is stored **as a number**, in plaintext, in the contract's storage.
- Anyone can read it with `eth_getStorageAt` — `private` in Solidity only means "no auto-generated getter", **not** "hidden".
- `amount` is passed in plaintext in the transaction calldata — visible on any explorer.

### Nox version — `euint256`

```solidity
euint256 public balance;

function deposit(externalEuint256 inputHandle, bytes calldata inputProof) external {
    euint256 amount = Nox.fromExternal(inputHandle, inputProof);
    balance = Nox.add(balance, amount);
    Nox.allowThis(balance);
    Nox.allow(balance, owner);
}
```

Four changes to understand:

| Classic | Nox | What it means |
|---|---|---|
| `uint256 private balance` | `euint256 public balance` | The stored value is now a **handle** (a 32-byte pointer to an encrypted value off-chain), not a number. It's safe to expose publicly — a handle is useless without an ACL grant. |
| `uint256 amount` (plaintext) | `externalEuint256 inputHandle, bytes inputProof` | The caller encrypts `amount` off-chain first, then passes the handle + a proof. The plaintext never hits the blockchain. |
| `balance += amount` | `balance = Nox.add(balance, amount)` | Addition on encrypted handles. The real math happens in the TEE off-chain. |
| *(nothing)* | `Nox.allowThis(balance); Nox.allow(balance, owner);` | After every mutation of `balance`, you grant permissions again: the contract to keep using the handle, and the owner to decrypt it. |

That's the whole trick. The next steps walk you through running it.

---

## Step 3 — Clone and install

```bash
git clone https://github.com/edenbd1/iexec-nox-hello-world-workshop.git
cd iexec-nox-hello-world-workshop
npm install
```

---

## Step 4 — Open the two contracts

Open both files side by side in your editor:

- **`contracts/PiggyBank.sol`** — the classic version. Plain `uint256`, plain `+=`. Read it top to bottom. Notice that `private` doesn't actually hide anything.
- **`contracts/ConfidentialPiggyBank.sol`** — the Nox version. Same logic, but every place a number used to live you'll see `euint256` or `externalEuint256`, and every place there was a `+` or `-` you'll see `Nox.add` or `Nox.sub`.

Spend a minute comparing. You should be able to point at any line in the Nox version and say why it's different from the classic one.

---

## Step 5 — Compile

```bash
npm run compile
```

Both contracts build against Solidity `0.8.27` with viaIR enabled (needed because the Nox library is inlined heavily). You should see:

```
Compiled 7 Solidity files successfully
```

---

## Step 6 — Run the tests

```bash
npm test
```

Seven tests run. The last one is the most important — it's the one that proves *why* we need Nox in the first place:

```ts
it("exposes 'private' balance via eth_getStorageAt — the whole point of the workshop", async () => {
  await piggy.deposit(12345n);
  const raw = await ethers.provider.getStorage(await piggy.getAddress(), 0);
  expect(BigInt(raw)).to.equal(12345n);
});
```

It deposits `12345`, then reads storage slot 0 directly. Out comes `12345` in plaintext — even though `balance` is marked `private`. That's the leak. That's what Nox fixes.

---

## Step 7 — (Optional) Fork-check against live Arbitrum Sepolia

```bash
npm run test:fork
```

This forks Arbitrum Sepolia locally and verifies two things:
1. The real `NoxCompute` proxy exists at the address hard-coded in the Nox library (`0xd464B198f06756a1d00be223634b85E0a731c229`).
2. The compiled `ConfidentialPiggyBank` ABI matches what the docs specify — `balance()` returns `bytes32`, `deposit`/`withdraw` take `(bytes32, bytes)`.

Useful as a sanity check before you deploy.

---

## Step 8 — Deploy `ConfidentialPiggyBank` to Arbitrum Sepolia

Copy `.env.example` to `.env` and paste your deployer private key (the one holding Arbitrum Sepolia test ETH):

```bash
cp .env.example .env
# edit .env: PRIVATE_KEY=0xYourKey
```

Then deploy:

```bash
npm run deploy:sepolia
```

Expected output:

```
Network : arbitrumSepolia (chainId 421614)
Deployer: 0xYourAddress
Balance : 0.0123 ETH
ConfidentialPiggyBank deployed at: 0xABCD...
Tx hash: 0x...
Arbiscan: https://sepolia.arbiscan.io/address/0xABCD...
```

**Copy the deployed address** — you need it next.

---

## Step 9 — Interact: encrypt → deposit → decrypt

You have two options. Pick whichever is easier for you.

### Option A — Use the docs widget (no code)

1. Go to https://docs.iex.ec/nox-protocol/getting-started/hello-world
2. Scroll to the interactive widget at the bottom of the page.
3. **Connect wallet** (same MetaMask, same Arbitrum Sepolia network).
4. **Contract address**: paste the address from Step 8.
5. **Value**: enter any number (e.g. `100`), then click **Encrypt**. Copy the two outputs: `handle` and `handleProof`.
6. Open https://remix.ethereum.org, paste `contracts/ConfidentialPiggyBank.sol`, compile, and on the right side of the *Deploy & Run* panel use **At Address** with your deployed address.
7. Expand `deposit`, paste the `handle` into `inputHandle`, the `handleProof` into `inputProof`, and click **transact**.
8. Click the `balance` getter → copy the returned handle.
9. Back in the widget, switch to **Decrypt**, paste the balance handle, and hit **Decrypt**. You should see `100` in plaintext — only visible to you.

### Option B — Use the repo's interact script (one command)

```bash
export CONFIDENTIAL_PIGGY=0xABCD...     # the address from Step 8
export AMOUNT=100                        # any positive integer
npm run interact:sepolia
```

What the script does:

1. `handleClient.encryptInput(100n, "uint256", contractAddress)` — sends `100` to the Nox gateway over TLS. The gateway encrypts it, stores the ciphertext off-chain, and returns `{ handle, handleProof }`.
2. `piggy.deposit(handle, handleProof)` — submits the tx. On-chain, `Nox.fromExternal()` validates the proof and the TEE runs the addition.
3. `await piggy.balance()` — returns the **current** balance handle (a `bytes32`, not the value).
4. `handleClient.decrypt(balanceHandle)` — the gateway checks the ACL (which the contract set with `Nox.allow(balance, owner)`), and returns the plaintext **to the owner only**.

Expected output:

```
Signer   : 0xYourAddress
Contract : 0xABCD...
Amount   : 100

[1/3] Encrypting amount via Nox gateway…
      handle      : 0x...
      handleProof : 0x... (N bytes)

[2/3] Calling deposit(handle, handleProof)…
      tx hash: 0x...

[3/3] Reading and decrypting balance handle…
      balance handle: 0x...

  Decrypted balance: 100
```

---

## Step 10 — Verify on Arbiscan

Open your deposit tx on https://sepolia.arbiscan.io — look at the **Input Data**. You'll see two long hex strings (the handle and the proof). They're real, verifiable, and **contain no plaintext amount**. The blockchain computed `0 + 100` without ever seeing `100`.

That's the point.

---

## What's in the repo

```
contracts/
  PiggyBank.sol                  Classic uint256 version (the starting point)
  ConfidentialPiggyBank.sol      Nox version using euint256 (the goal)
scripts/
  deploy-classic.ts              Deploy PiggyBank (any network)
  deploy-confidential.ts         Deploy ConfidentialPiggyBank (Arb Sepolia only)
  interact.ts                    Encrypt → deposit → decrypt, end to end
test/
  PiggyBank.test.ts              7 unit tests, including the storage-leak demo
  e2e-fork.test.ts               Sanity checks against a live Arb Sepolia fork
hardhat.config.ts                Solidity 0.8.27 + viaIR, Arb Sepolia network
```

---

## Commands reference

| Command | What it does |
|---|---|
| `npm install` | Install all dependencies |
| `npm run compile` | Compile both contracts |
| `npm test` | Run unit tests on the classic version (includes the storage-leak demo) |
| `npm run test:fork` | Fork-check against live Arbitrum Sepolia Nox contracts |
| `npm run deploy:local` | Deploy the classic PiggyBank to the local Hardhat node |
| `npm run deploy:sepolia` | Deploy `ConfidentialPiggyBank` to Arbitrum Sepolia |
| `npm run interact:sepolia` | Encrypt → deposit → decrypt against your deployed contract |

---

## Going further

- Docs: https://docs.iex.ec/nox-protocol/getting-started/hello-world
- Solidity library: https://www.npmjs.com/package/@iexec-nox/nox-protocol-contracts
- JS SDK (encrypt/decrypt): https://www.npmjs.com/package/@iexec-nox/handle
- Live `NoxCompute` proxy on Arbitrum Sepolia: https://sepolia.arbiscan.io/address/0xd464B198f06756a1d00be223634b85E0a731c229
- iExec Discord: https://discord.com/invite/5TewNUnJHN

For production code, replace `Nox.add` and `Nox.sub` with `Nox.safeAdd` and `Nox.safeSub` — they guard against overflow/underflow without leaking information through reverts.

---

## License

MIT — see SPDX headers in the Solidity files. The underlying Nox library is BUSL-1.1.
