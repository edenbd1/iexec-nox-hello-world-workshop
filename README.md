# iExec Nox — Hello World

Deploy two smart contracts — a plain `PiggyBank` and a confidential one built with the [iExec Nox protocol](https://docs.iex.ec/nox-protocol/getting-started/hello-world) — then verify both on Arbiscan.

---

## Setup

```bash
git clone https://github.com/edenbd1/iexec-nox-hello-world-workshop.git
cd iexec-nox-hello-world-workshop
npm install
cp .env.example .env
```

Edit `.env` and fill in:
- `PRIVATE_KEY` — deployer key, funded with Arbitrum Sepolia ETH (get some at <https://faucet.quicknode.com/arbitrum/sepolia>)
- `ARBISCAN_API_KEY` — free key from <https://arbiscan.io/myapikey> (needed only to verify)

Compile once to generate artifacts:
```bash
npm run compile
```

---

## 1. Deploy `PiggyBank` (classic)

The plain version — `uint256` balance, readable by anyone.

### Locally (instant, free)

In one terminal:
```bash
npm run node
```

In another:
```bash
npm run deploy:piggy:local
```

Output:
```
Network : localhost
Deployer: 0xf39F…2266
PiggyBank deployed at: 0x5FbD…0aa3
```

### On Arbitrum Sepolia

```bash
npm run deploy:piggy:sepolia
```

Output:
```
Network : arbitrumSepolia
Deployer: 0xYourAddress
PiggyBank deployed at: 0xABCD…
```

Copy the address.

---

## 2. Deploy `ConfidentialPiggyBank` (Nox)

The confidential version — `euint256` balance, only the owner can decrypt.

Only runs on **Arbitrum Sepolia** (the `Nox` library only resolves on chainIds 421614, 42161, 31337).

```bash
npm run deploy:confidential:sepolia
```

Output:
```
Network : arbitrumSepolia (chainId 421614)
Deployer: 0xYourAddress
Balance : 0.0123 ETH
ConfidentialPiggyBank deployed at: 0xABCD…
Tx hash: 0x…
Arbiscan: https://sepolia.arbiscan.io/address/0xABCD…
```

Copy the address.

---

## 3. Verify contracts on Arbiscan

Make source code + ABI public on the explorer so anyone can read and interact with the contract.

Make sure `ARBISCAN_API_KEY` is set in `.env`, then run:

### Verify `PiggyBank`

```bash
npx hardhat verify --network arbitrumSepolia <PIGGY_BANK_ADDRESS>
```

### Verify `ConfidentialPiggyBank`

```bash
npx hardhat verify --network arbitrumSepolia <CONFIDENTIAL_PIGGY_BANK_ADDRESS>
```

On success:
```
Successfully verified contract PiggyBank on the block explorer.
https://sepolia.arbiscan.io/address/0xABCD…#code
```

Open the URL — the `Contract` tab now shows the full source code and a **Read / Write** UI to call every function directly from the browser.

---

## Interact (optional)

Encrypt a deposit, send it, and decrypt the balance — end to end:

```bash
export CONFIDENTIAL_PIGGY=0xABCD…
export AMOUNT=100
npm run interact:sepolia
```

Or use the widget in the [docs Hello World page](https://docs.iex.ec/nox-protocol/getting-started/hello-world).

---

## All commands

| Command | What it does |
|---|---|
| `npm install` | Install dependencies |
| `npm run compile` | Compile both contracts |
| `npm test` | Run unit tests on `PiggyBank` |
| `npm run node` | Start a local Hardhat node |
| `npm run deploy:piggy:local` | Deploy `PiggyBank` to local node |
| `npm run deploy:piggy:sepolia` | Deploy `PiggyBank` to Arbitrum Sepolia |
| `npm run deploy:confidential:sepolia` | Deploy `ConfidentialPiggyBank` to Arbitrum Sepolia |
| `npx hardhat verify --network arbitrumSepolia <ADDR>` | Verify any deployed contract on Arbiscan |
| `npm run interact:sepolia` | Encrypt → deposit → decrypt against the confidential contract |

---

## Links

- Docs: <https://docs.iex.ec/nox-protocol/getting-started/hello-world>
- `@iexec-nox/nox-protocol-contracts`: <https://www.npmjs.com/package/@iexec-nox/nox-protocol-contracts>
- `@iexec-nox/handle`: <https://www.npmjs.com/package/@iexec-nox/handle>
- iExec Discord: <https://discord.com/invite/5TewNUnJHN>
