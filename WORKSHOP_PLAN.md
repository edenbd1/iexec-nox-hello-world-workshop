# Workshop Nox Hello World — 30 min

**Source** : https://docs.iex.ec/nox-protocol/getting-started/hello-world

**Objectif** : Faire transformer aux participants un smart contract classique en **smart contract confidentiel** grâce à Nox. À la fin, ils auront déployé sur Arbitrum Sepolia un PiggyBank où le **solde et les montants sont chiffrés**, mais tout le reste (adresses, appels) reste public.

---

## Pitch en une phrase

> « Nox permet d'écrire des contrats Solidity classiques dans lesquels certaines valeurs (soldes, montants…) vivent chiffrées, traitées off-chain dans des enclaves TEE Intel TDX, tout en restant **composables avec n'importe quel DeFi**. »

**Important à dire** : Nox **n'est pas de la FHE**. C'est du calcul confidentiel basé sur des **TEE hardware** (Intel TDX). Les types comme `euint256` sont en réalité des **handles** — des pointeurs 32-byte vers des données chiffrées stockées off-chain.

---

## Timing global

| Segment | Durée | Contenu |
|---|---|---|
| 0. Intro & concepts | 5 min | Pourquoi Nox, les 3 briques (handles, ACLs, TEE) |
| 1. Le contrat classique | 3 min | PiggyBank normal, montrer ce qui fuit |
| 2. Conversion en Nox | 12 min | `euint256`, `Nox.fromExternal`, ACL |
| 3. Déploiement Remix | 5 min | Arbitrum Sepolia, MetaMask |
| 4. Interaction via widget | 4 min | Chiffrer un montant, deposit, decrypt balance |
| 5. Q&A | 1 min | - |

---

## Prérequis participants (à leur dire AVANT)

- **MetaMask** installé
- Réseau **Arbitrum Sepolia** ajouté dans MetaMask (RPC : `https://sepolia-rollup.arbitrum.io/rpc`, chainId 421614)
- Un peu de **ETH Arbitrum Sepolia** (faucet : https://faucet.quicknode.com/arbitrum/sepolia ou https://www.alchemy.com/faucets/arbitrum-sepolia)
- **Remix** dans le navigateur : https://remix.ethereum.org

Aucune installation locale nécessaire. Tout se passe dans Remix + la doc.

---

## 0. Intro — 5 min

**Script** :

> « La blockchain est transparente par design. C'est génial pour le trustless, catastrophique pour l'adoption institutionnelle : aucun fonds ne va déployer 100M$ dans un protocole qui expose ses ratios de collatéral et ses positions en clair.
>
> Nox résout ça. On écrit du Solidity **quasi-normal**, mais certaines valeurs sont chiffrées. Les calculs se font dans des **enclaves TEE Intel TDX** — des zones hardware où même le propriétaire du serveur ne peut pas lire la mémoire.
>
> Trois concepts à retenir :
>
> 1. **Handle** : un pointeur 32 bytes qui référence une donnée chiffrée off-chain. Quand vous voyez `euint256`, c'est ça.
> 2. **ACL** (Access Control List) : on gère on-chain qui peut déchiffrer quoi. `Nox.allow(balance, owner)` = "le owner peut voir son solde".
> 3. **TEE enclave** : l'endroit off-chain où le vrai calcul tourne sur les données en clair, avant de ré-encrypter le résultat.
>
> Point clé : Nox offre la **confidentialité, pas l'anonymat**. Les adresses et les appels de fonction restent visibles on-chain. Seules **les valeurs encryptées** (soldes, montants) sont privées. »

**À montrer** : ouvrir https://docs.iex.ec/nox-protocol/getting-started/hello-world

---

## 1. Le contrat classique — 3 min

**Script** :

> « On part d'un PiggyBank tout bête. `balance` est un `uint256` privé Solidity — mais *privé* au sens Solidity = **pas exposé par getter auto**. En réalité, n'importe qui peut lire la storage avec `eth_getStorageAt`. C'est le problème. »

**Code à projeter** :

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract PiggyBank {
    uint256 private balance;
    address public owner;

    constructor() {
        owner = msg.sender;
    }

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

**Démo rapide** (optionnelle si le temps presse) : coller dans Remix, compiler, et montrer `eth_getStorageAt` qui lit le slot 0 avec la balance en clair.

---

## 2. Conversion en contrat Nox — 12 min (le cœur du workshop)

Faire les transformations **une par une** dans Remix, en expliquant à chaque étape. Ne pas projeter la version finale d'un coup — la **construire en direct**.

### 2a. Importer Nox + remplacer les types

**Script** :
> « On importe la lib Nox, et on remplace `uint256` par `euint256` — c'est le handle chiffré. »

```solidity
import {Nox, euint256, externalEuint256} from
  "@iexec-nox/nox-protocol-contracts/contracts/sdk/Nox.sol";

contract ConfidentialPiggyBank {
    euint256 public balance;  // était uint256 private
    address public owner;
```

Note à dire : **`balance` est maintenant `public`** — car la valeur publique, c'est le handle (pointeur chiffré), pas le montant. Seuls les autorisés peuvent déchiffrer.

### 2b. Initialiser l'état chiffré

**Script** :
> « On ne peut pas faire `balance = 0` — `balance` est un handle. On utilise `Nox.toEuint256(0)` qui chiffre 0 et renvoie un handle. »

```solidity
constructor() {
    owner = msg.sender;
    balance = Nox.toEuint256(0);
}
```

### 2c. Deposit : accepter une entrée chiffrée

**Script** :
> « Le user ne peut pas envoyer un `uint256` en clair dans la tx — sinon tout le monde verrait le montant. Il envoie un **handle externe** (`externalEuint256`) + une **preuve** (`inputProof`) que ce handle est bien lié à une valeur qu'il contrôle. Le contrat valide ça avec `Nox.fromExternal()`. »

```solidity
function deposit(externalEuint256 inputHandle, bytes calldata inputProof)
    external
{
    euint256 amount = Nox.fromExternal(inputHandle, inputProof);
    balance = Nox.add(balance, amount);
    Nox.allowThis(balance);
    Nox.allow(balance, owner);
}
```

**Points à expliquer** :
- `Nox.add(balance, amount)` fait l'addition **sur les handles**, en déléguant à l'enclave TEE.
- `Nox.allowThis(balance)` : « le contrat peut réutiliser ce nouveau handle dans un prochain appel ». Sans ça, le handle devient inutilisable.
- `Nox.allow(balance, owner)` : « le owner peut déchiffrer son solde ».

### 2d. Withdraw

```solidity
function withdraw(externalEuint256 inputHandle, bytes calldata inputProof)
    external
{
    require(msg.sender == owner);
    euint256 amount = Nox.fromExternal(inputHandle, inputProof);
    balance = Nox.sub(balance, amount);
    Nox.allowThis(balance);
    Nox.allow(balance, owner);
}
```

**À dire** :
> « On ne peut **plus** faire `require(amount <= balance)` — les deux sont chiffrés, Solidity ne sait pas comparer. En prod on utiliserait `Nox.safeSub()` qui gère l'underflow sans fuite d'information. Pour ce workshop on garde `Nox.sub()` simple. »

### 2e. Plus besoin de getBalance()

`balance` étant déclaré `public`, Solidity génère un getter automatiquement qui retourne le **handle**. Pour avoir la vraie valeur, l'owner utilisera le SDK JS pour déchiffrer.

### Contrat final à valider

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

---

## 3. Déploiement Remix — 5 min

**Étapes à faire en live** :

1. Dans Remix, panneau **Solidity Compiler** : choisir version **0.8.27** (ou 0.8.24+), cliquer **Compile**.
   - ⚠️ Note sur l'erreur que tu avais : ne clique **pas** sur "Compile and Run script" — c'est ce qui déclenche le message *"You have not set a script to run"*. C'est une feature Remix pour exécuter un script JS, rien à voir avec le déploiement. **Juste "Compile".**
2. Panneau **Deploy & Run Transactions** :
   - **Environment** : `Injected Provider - MetaMask` (ou WalletConnect)
   - Vérifier dans MetaMask que le réseau est bien **Arbitrum Sepolia**
   - Contract : `ConfidentialPiggyBank`
   - Cliquer **Deploy** → valider dans MetaMask
3. Copier l'**adresse du contrat déployé** — elle apparaît dans "Deployed Contracts".

**Backup si ça rate** : avoir un contrat déjà déployé sous la main.

---

## 4. Interagir : chiffrer, déposer, déchiffrer — 4 min

C'est ici que ça devient visuel et que les gens réalisent ce qu'ils ont fait.

**Script** :
> « On a un contrat déployé. Pour appeler `deposit(100)`, il faut d'abord **chiffrer** le 100 et obtenir un `inputHandle` + un `inputProof`. La doc iExec fournit un widget web qui fait ça sans installer de SDK. »

**Étapes** :

1. Ouvrir la page https://docs.iex.ec/nox-protocol/getting-started/hello-world et scroller jusqu'au **widget intégré**.
2. **Connect wallet** dans le widget (MetaMask, même compte).
3. **Contract address** : coller l'adresse déployée à l'étape 3.
4. **Encrypt** : entrer `100` → le widget retourne :
   - `handle` (hex) → à coller dans `inputHandle` de Remix
   - `handleProof` (hex long) → à coller dans `inputProof`
5. Dans Remix, appeler `deposit(handle, handleProof)` → confirmer dans MetaMask.
6. De retour dans le widget, section **Decrypt** : entrer l'adresse du contrat et le slot/handle de `balance` (appelle `balance()` dans Remix pour récupérer le handle actuel).
7. Résultat : **100** en clair, déchiffré côté client.

**Le moment "aha"** : montrer sur https://sepolia.arbiscan.io la transaction de `deposit`. Les inputs sont visibles mais **illisibles** — c'est juste de la soupe hex. Pourtant le contrat a bien additionné.

---

## 5. Clôture — 1 min

**Ce qu'on a fait** :
- Transformé un Solidity classique en contrat confidentiel en **~20 lignes modifiées**.
- Déployé sur Arbitrum Sepolia, une L2 Ethereum.
- Interagi avec des valeurs chiffrées de bout en bout.

**Pour aller plus loin** :
- **ERC7984** : un token fongible avec soldes chiffrés (équivalent ERC20 confidentiel)
- **Hardhat / Foundry** : intégrations pour tester Nox localement
- **Use cases** : dark pools, payroll privé, vaults institutionnels

---

## Checklist avant de démarrer

- [ ] MetaMask sur Arbitrum Sepolia, ≥0.01 ETH
- [ ] Remix ouvert, prêt à coller du Solidity
- [ ] Page doc Hello World ouverte dans un autre onglet (pour le widget)
- [ ] Arbiscan Sepolia ouvert pour la démo finale
- [ ] Contrat de secours déjà déployé au cas où le live rate
- [ ] Le flow testé **la veille** de bout en bout

---

## Réponses aux questions probables

- *Pourquoi pas de la FHE ?* → Les TEE sont ~1000× plus rapides aujourd'hui. La FHE reste trop coûteuse pour du DeFi temps réel.
- *Et si Intel TDX est cassé ?* → C'est le risque. Nox est sécurisé au niveau du hardware TEE, comme Phala, Oasis Sapphire, etc.
- *Peut-on comparer deux valeurs chiffrées ?* → Oui, via `Nox.lt()`, `Nox.gt()`, etc., qui renvoient des `ebool`. On ne peut pas faire `if (ebool)` directement en Solidity, il faut passer par `Nox.select()`.
- *Le gas coûte plus cher ?* → Oui modérément, car chaque opération chiffrée déclenche une interaction enclave.
