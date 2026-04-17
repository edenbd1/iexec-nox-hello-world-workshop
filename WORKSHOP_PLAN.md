# Nox Hello World — Workshop Notes (25–30 min)

**Audience**: Solidity developers, junior to mid-level, curious about on-chain confidentiality.

**Promise**: In 30 minutes, they will have turned a plain Solidity contract into a **confidential** one, deployed on Arbitrum Sepolia, with balances encrypted end-to-end.

**Source**: https://docs.iex.ec/nox-protocol/getting-started/hello-world
**Repo to share**: https://github.com/edenbd1/iexec-nox-hello-world-workshop

> Quotes formatted like this are **verbatim from the docs** — safe to read aloud, they're exactly how the iExec team frames the concepts.

---

## Tight timing

| # | Segment | Time | Cumulative |
|---|---|---|---|
| 0 | Intro & why confidentiality matters | **3 min** | 3 |
| 1 | Classic PiggyBank + storage leak demo | **4 min** | 7 |
| 2 | Convert to Nox — live diff | **10 min** | 17 |
| 3 | Deploy to Arbitrum Sepolia via Remix | **4 min** | 21 |
| 4 | Interact: encrypt → deposit → decrypt | **5 min** | 26 |
| 5 | Recap & Q&A | **3 min** | 29 |

Buffer: 1 min. If running late, cut the live diff in Segment 2 and project the final contract instead.

---

## Pre-flight checklist (5 min before start)

- [ ] Laptop charged, "Do Not Disturb" on, Slack/Discord closed
- [ ] Remix open: https://remix.ethereum.org
- [ ] Docs Hello World open in a second tab: https://docs.iex.ec/nox-protocol/getting-started/hello-world (for the encrypt/decrypt widget)
- [ ] Arbiscan Sepolia open: https://sepolia.arbiscan.io
- [ ] MetaMask connected, on Arbitrum Sepolia, ≥0.01 ETH
- [ ] A **backup ConfidentialPiggyBank already deployed** the day before, address copied into a sticky note (in case the live deploy fails)
- [ ] The repo URL ready on a final slide

---

## 0. Intro — 3 min

**On screen**: title slide + repo link.

**Speaker notes**:

> "DeFi is transparent by default. That's a feature for retail users. It's a blocker for institutional adoption." *(quote from docs)*

Follow with your own framing:

> "Think about it — a lending protocol that exposes collateral ratios, a yield vault where the strategy leaks on-chain, a tokenized fund where every investor allocation is public. Institutions have the capital but they won't touch a protocol that exposes everything. That's the gap Nox closes."

Then introduce Nox (docs phrasing):

> "Nox is a **privacy layer** that enables confidential computations on encrypted data while preserving full DeFi composability."

Key clarification — **say it explicitly**:

> "Nox provides **confidentiality, not anonymity**. Addresses and function calls remain visible on-chain. Only **balances and amounts** are encrypted."

Now the three concepts they need to carry through the rest of the workshop:

1. **Handle** — "a unique 32-byte identifier" that points to encrypted data stored off-chain. Whenever they see `euint256` in the code, that's a handle.
2. **ACL** — "Each handle is protected by an ACL that manages **permissions on-chain**." They'll see `Nox.allow()` calls soon.
3. **TEE** — "computation happens inside **Intel TDX-based TEE enclaves**" — hardware where even the server operator can't read memory.

Close with: "Let's build."

---

## 1. Classic PiggyBank + the leak — 4 min

**On screen**: Remix, File Explorer.

Open with the docs' own intro:

> "A piggy bank is a simple savings container: you put money in, and only the owner can take it out. In this tutorial, you will first write a classic piggy bank, then turn it into a confidential one using Nox."

**Live**:

1. Create `PiggyBank.sol`, paste:
   ```solidity
   // SPDX-License-Identifier: MIT
   pragma solidity ^0.8.27;

   contract PiggyBank {
       uint256 private balance;
       address public owner;

       constructor() { owner = msg.sender; }

       function deposit(uint256 amount) external {
           balance += amount;
       }

       function withdraw(uint256 amount) external {
           require(msg.sender == owner);
           require(amount <= balance);
           balance -= amount;
       }

       function getBalance() external view returns (uint256) {
           return balance;
       }
   }
   ```
2. **Solidity Compiler** → version `0.8.27` → **Compile** (stress: **not** *Compile and Run script* — that button needs a `@custom:dev-run-script` NatSpec tag and will throw *"You have not set a script to run"*).
3. **Deploy & Run** → Environment `Remix VM (Osaka)` → **Deploy**.
4. Call `deposit(100)`, then `getBalance()` → `100`.

**The reveal** — say this out loud:

> "We marked `balance` as `private`. But in Solidity, `private` only means 'no auto-generated getter'. It does **not** mean the storage is hidden. Watch."

**Leak demo** (30 seconds, Remix bottom console):
```javascript
await web3.eth.getStorageAt('<contract-address>', 0)
// returns: 0x00...064  ← 0x64 = 100 in plaintext
```

> "There it is. The balance sits in storage as a plain integer. Anyone with RPC access reads it. That's the problem Nox solves."

---

## 2. Convert to Nox — 10 min (core of the workshop)

Keep momentum: build the confidential version **incrementally**. Each change gets its own explanation. Project a side-by-side diff if you can.

Create `ConfidentialPiggyBank.sol` and build it up step by step.

### 2a. Import Nox and update types — 2 min

> "Add the Nox library and swap `uint256` for `euint256`. On-chain, the value is now stored as a 32-byte **handle** that points to encrypted data. The actual value is never visible." *(docs)*

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Nox, euint256, externalEuint256} from
    "@iexec-nox/nox-protocol-contracts/contracts/sdk/Nox.sol";

contract ConfidentialPiggyBank {
    euint256 public balance;
    address public owner;
```

Call out the `public`: the getter now returns the **handle** (a bytes32), not the plaintext. Handles are safe to expose — they're useless without an ACL grant.

### 2b. Initialize encrypted state — 1 min

> "Unlike plain `uint256` (which defaults to `0`), an `euint256` must be explicitly initialized to a valid encrypted handle. Use `Nox.toEuint256()` in the constructor:" *(docs)*

```solidity
    constructor() {
        owner = msg.sender;
        balance = Nox.toEuint256(0);
    }
```

### 2c. Convert `deposit()` — 3 min

> "Users encrypt values off-chain with the JS SDK and send a **handle** (a reference to the encrypted data) along with a **proof** that the encryption is valid. Replace the plain parameter with `externalEuint256`, then call `Nox.fromExternal()` to verify the proof and convert the external handle into an `euint256` the contract can use. Finally, use `Nox.add()` instead of `+=`:" *(docs)*

```solidity
    function deposit(externalEuint256 inputHandle, bytes calldata inputProof) external {
        euint256 amount = Nox.fromExternal(inputHandle, inputProof);
        balance = Nox.add(balance, amount);
    }
```

Walk through what just happened:
- `externalEuint256` = handle coming *from the outside*; needs proof to be trusted.
- `Nox.fromExternal` = validates proof + gives you a safe internal handle.
- `Nox.add` = delegates addition to the TEE; returns a fresh handle.

### 2d. Convert `withdraw()` — 1 min

> "The `require(amount <= balance)` check cannot work on encrypted values. Replace it with `Nox.sub()`, which subtracts two encrypted values:" *(docs)*

```solidity
    function withdraw(externalEuint256 inputHandle, bytes calldata inputProof) external {
        require(msg.sender == owner);
        euint256 amount = Nox.fromExternal(inputHandle, inputProof);
        balance = Nox.sub(balance, amount);
    }
```

Drop the punchline: *we just lost a safety check*. In production you'd swap `Nox.sub` for `Nox.safeSub` — it guards against underflow without leaking information.

### 2e. Grant permissions — 3 min (the subtle part — don't rush)

> "By default, only the handle creator has access. After each operation that produces a new handle, you need to grant two permissions:
> - `Nox.allowThis(balance)`: lets the **contract** reuse the handle in future computations
> - `Nox.allow(balance, owner)`: lets the **owner** decrypt the balance off-chain" *(docs)*

Add these to **constructor**, **deposit**, and **withdraw** — after every mutation of `balance`:

```solidity
    Nox.allowThis(balance);
    Nox.allow(balance, owner);
```

Emphasize the "why": every time `balance` is reassigned (even `Nox.add(balance, amount)` returns a *new* handle), the previous grants don't carry over. Forget this → next deposit reverts because the contract no longer has access to its own balance.

### 2f. The final contract (project it full-screen, 15 seconds)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Nox, euint256, externalEuint256} from
    "@iexec-nox/nox-protocol-contracts/contracts/sdk/Nox.sol";

contract ConfidentialPiggyBank {
    euint256 public balance;
    address public owner;

    constructor() {
        owner = msg.sender;
        balance = Nox.toEuint256(0);
        Nox.allowThis(balance);
        Nox.allow(balance, owner);
    }

    function deposit(externalEuint256 inputHandle, bytes calldata inputProof) external {
        euint256 amount = Nox.fromExternal(inputHandle, inputProof);
        balance = Nox.add(balance, amount);
        Nox.allowThis(balance);
        Nox.allow(balance, owner);
    }

    function withdraw(externalEuint256 inputHandle, bytes calldata inputProof) external {
        require(msg.sender == owner);
        euint256 amount = Nox.fromExternal(inputHandle, inputProof);
        balance = Nox.sub(balance, amount);
        Nox.allowThis(balance);
        Nox.allow(balance, owner);
    }
}
```

Close the segment with the docs' framing (paraphrased from the tutorial's spirit): we went from a leaky "private" contract to a confidential one by changing roughly six lines. The logic is intact. That's the headline feature of Nox — you keep writing Solidity.

---

## 3. Deploy to Arbitrum Sepolia — 4 min

Read the docs' own instruction verbatim:

> "Click Open in Remix to load it, then compile with Solidity `0.8.24+`. To deploy, select WalletConnect or Browser Extension in the Remix Deploy panel and make sure your wallet is connected to Arbitrum Sepolia before hitting Deploy." *(docs)*

**Live actions**:

1. **Solidity Compiler** → pick `0.8.27`, check **Enable optimization** (200 runs), check **Enable viaIR** (needed — Nox's inlining is heavy).
2. **Compile** (again: not *Compile and Run script*).
3. **Deploy & Run** panel:
   - Environment: **Injected Provider – MetaMask**
   - MetaMask pops up → approve connection
   - In MetaMask, verify network = **Arbitrum Sepolia** (not mainnet!)
   - Contract: **ConfidentialPiggyBank**
   - Click **Deploy** → confirm in MetaMask
4. ~5 seconds later the contract appears under *Deployed Contracts*.
5. Copy the address and open it on Arbiscan: https://sepolia.arbiscan.io/address/\<address\>

**Show the audience**: on Arbiscan, the contract is verifiable and fully on-chain, but the storage slot for `balance` just holds an opaque 32-byte handle — no amount.

**Backup**: if the deploy fails (out of gas, flaky RPC), paste the pre-deployed backup address into Remix (`At Address` button in Deploy panel) and keep going.

---

## 4. Encrypt → Deposit → Decrypt — 5 min

**On screen**: switch to the docs tab, scroll down to the embedded widget.

Read the docs' instruction:

> "Use the widget below to encrypt values and decrypt handles with the JS SDK. Connect your wallet, enter your deployed contract address, and encrypt an amount. Copy the resulting handle and handle proof, then paste them into the `deposit` or `withdraw` fields in Remix to call the contract. To read the balance, copy the handle returned by `balance()` in Remix and decrypt it here." *(docs)*

### Encrypt — 1 min

1. Widget → **Connect wallet** (same MetaMask).
2. **Contract address**: paste the deployed contract address.
3. **Value**: type `100`.
4. **Encrypt** → two fields appear: `handle` (0x… 32 bytes) and `handleProof` (0x… long hex).

Explain what just happened: the widget sent `100` to the Nox gateway over TLS. The gateway encrypted it, stored the ciphertext off-chain, and returned a handle plus a proof. The plaintext never touched the blockchain.

### Deposit — 1 min

Back to Remix, under *Deployed Contracts*:

1. Expand `deposit`.
2. Paste `handle` into `inputHandle`, `handleProof` into `inputProof`.
3. Click **transact** → confirm MetaMask.
4. Open the tx on Arbiscan — show the input data: it's just opaque hex. **No plaintext anywhere.**

### Decrypt — 2 min

1. In Remix, click the **`balance`** getter → it returns the current handle (0x…).
2. Back to the widget → **Decrypt** tab → paste that handle → **Decrypt**.
3. The value `100` appears **client-side only**.

Close the loop:

> "The blockchain just computed `0 + 100` without ever seeing `100`. The balance is on-chain, verifiable, and unreadable unless you have the ACL grant."

---

## 5. Recap & Q&A — 3 min

**Closing lines**:

> "In 25 minutes we:
>
> 1. Turned a plain Solidity contract into a confidential one — about six lines changed.
> 2. Deployed on Arbitrum Sepolia, a real L2.
> 3. Interacted with encrypted values end-to-end — the chain never saw the plaintext.
>
> Use cases this unlocks: dark pools, private payroll, institutional vaults, lending with private collateral — all without breaking DeFi composability.
>
> Everything — contracts, Hardhat tests, deploy scripts, these notes — lives at **github.com/edenbd1/iexec-nox-hello-world-workshop**. Fork it, break it, improve it."

### Likely questions — cheat sheet

- **"Is Intel TDX really secure?"** — Nox's trust model is hardware-based, same as Phala or Oasis Sapphire. The threat model is the hardware, not the software stack.
- **"What's the gas overhead?"** — modest. Each encrypted op emits an event and triggers an off-chain computation; think 2–5× a regular call, not 100×.
- **"Why TEE and not FHE?"** — FHE is still ~1000× too slow for realtime DeFi. TEEs are the practical compromise today.
- **"Can I compare two encrypted values?"** — Yes: `Nox.lt()`, `Nox.gt()`, `Nox.eq()` return an `ebool`. You can't `if (ebool)` directly — use `Nox.select(cond, a, b)` for conditional logic.
- **"Can I unit-test locally?"** — Only partially. Tests that call `Nox.fromExternal` need the off-chain gateway, so they can't run on a bare Hardhat node. The repo ships two tiers: unit tests on the classic version, fork sanity checks against live Arbitrum Sepolia.
- **"`Nox.add` / `Nox.sub` — are they safe?"** — They're wrapping arithmetic. For production, use `Nox.safeAdd` / `Nox.safeSub` — they guard against overflow/underflow without leaking info.

---

## Useful links (final slide)

- Hello World: https://docs.iex.ec/nox-protocol/getting-started/hello-world
- Workshop repo: https://github.com/edenbd1/iexec-nox-hello-world-workshop
- Solidity package: https://www.npmjs.com/package/@iexec-nox/nox-protocol-contracts
- JS SDK: https://www.npmjs.com/package/@iexec-nox/handle
- NoxCompute on Arb Sepolia: https://sepolia.arbiscan.io/address/0xd464B198f06756a1d00be223634b85E0a731c229
- iExec Discord: https://discord.com/invite/5TewNUnJHN

---

## Post-workshop self-review

- [ ] How many attendees got a contract deployed in their own wallet?
- [ ] Which step blocked the most people? (Note it — good doc-feedback signal.)
- [ ] Recurring questions → candidates for a follow-up blog post or a docs PR.
