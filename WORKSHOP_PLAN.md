# Workshop Nox Hello World — Notes de présentation (25–30 min)

**Public cible** : développeurs Solidity débutants/intermédiaires curieux de confidentialité on-chain.

**Promesse** : « En 30 minutes, vous aurez transformé un smart contract banal en smart contract **confidentiel** déployé sur Arbitrum Sepolia, avec des soldes chiffrés de bout en bout. »

**Source** : https://docs.iex.ec/nox-protocol/getting-started/hello-world
**Repo à partager** : https://github.com/edenbd1/iexec-nox-hello-world-workshop

---

## Timing au cordeau

| # | Segment | Durée | Cumul |
|---|---|---|---|
| 0 | Accueil + contexte (pourquoi confidentiel) | **3 min** | 3 |
| 1 | Le contrat classique + la fuite de donnée | **4 min** | 7 |
| 2 | Conversion en Nox (live-coding diff) | **10 min** | 17 |
| 3 | Déploiement Remix sur Arbitrum Sepolia | **4 min** | 21 |
| 4 | Interaction : encrypt / deposit / decrypt | **5 min** | 26 |
| 5 | Récap + Q&A | **3 min** | 29 |

Budget buffer : 1 min. Si ça glisse, couper en priorité le "live-coding" du 2 pour projeter directement la version finale.

---

## Avant de démarrer (checklist 5 min avant)

- [ ] Laptop chargé, mode "Ne pas déranger" activé
- [ ] Remix ouvert : https://remix.ethereum.org
- [ ] Doc Hello World ouverte dans un second onglet : https://docs.iex.ec/nox-protocol/getting-started/hello-world (pour le widget encrypt/decrypt)
- [ ] Arbiscan Sepolia ouvert : https://sepolia.arbiscan.io
- [ ] MetaMask connecté, sur Arbitrum Sepolia, ≥0.01 ETH
- [ ] Un **ConfidentialPiggyBank déjà déployé de secours** (au cas où le déploiement en live rate) — garder l'adresse dans un sticky note local
- [ ] Slack/Discord fermé, notifications OFF

---

## 0. Accueil — 3 min

**À projeter** : slide "Nox Hello World" + lien du repo.

**Script (à peu près mot pour mot)** :

> « Salut tout le monde, on a 30 minutes chrono. À la fin, vous aurez un smart contract Solidity déployé sur Arbitrum Sepolia dans lequel **personne — pas moi, pas l'explorer, pas un nœud RPC — ne peut lire le solde**. Seul le propriétaire peut le déchiffrer. Et pourtant, le contrat reste **totalement composable** avec n'importe quel protocole DeFi.
>
> Le truc qu'on va utiliser s'appelle **Nox**. C'est un protocole de iExec qui combine du Solidity classique avec des enclaves **TEE Intel TDX** — du hardware où même l'admin du serveur ne peut pas lire la mémoire.
>
> Petite précision importante : Nox c'est de la **confidentialité, pas de l'anonymat**. Votre adresse wallet reste visible, les appels de fonction aussi. Ce qui est caché, c'est uniquement les **valeurs** que vous choisissez de chiffrer — typiquement des montants, des soldes.
>
> Trois concepts à retenir pour la suite :
>
> 1. **Handle** : un pointeur 32 bytes qui référence une donnée chiffrée off-chain. Chaque fois que vous verrez `euint256` dans le code, c'est ça — un handle vers un `uint256` chiffré.
> 2. **ACL** : les droits de déchiffrement, gérés on-chain. `Nox.allow(handle, alice)` = "Alice peut déchiffrer cette valeur".
> 3. **TEE enclave** : l'endroit off-chain où le vrai calcul tourne sur les données en clair, avant de ré-encrypter le résultat. C'est de l'Intel TDX, pas de la FHE.
>
> On y va. »

---

## 1. Le contrat classique + la fuite — 4 min

**À projeter** : Remix, panneau File Explorer, créer un fichier `PiggyBank.sol`.

**Live action** :

1. Créer `PiggyBank.sol`, coller le code :
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

2. **Solidity Compiler** → version `0.8.27` → **Compile** (bien insister : pas *Compile and Run script*).

3. **Deploy & Run** → Environment `Remix VM (Osaka)` → **Deploy**.

4. Appeler `deposit(100)`, puis `getBalance()` → `100`.

**Le moment "aha"** à dire à ce stade :

> « Regardez — on a marqué `balance` comme `private`. En Solidity, `private` ça veut juste dire *"pas de getter auto-généré"*. Ça ne veut PAS dire que c'est privé au sens "caché". Je vais vous le prouver. »

**Démo fuite** (30 sec, dans la console Remix en bas) :
```javascript
await web3.eth.getStorageAt('<adresse-contrat>', 0)
// retourne: 0x00...064  ← 0x64 = 100 en clair !
```

> « Voilà. Le solde est littéralement **posé en clair dans la storage**. N'importe qui avec accès à un nœud RPC peut le lire. C'est le problème qu'on va résoudre avec Nox. »

---

## 2. Conversion en Nox — 10 min (cœur du workshop)

**Principe** : on fait les modifs une par une, pas d'un bloc. Chaque ligne modifiée = une explication.

Créer `ConfidentialPiggyBank.sol`, et le construire progressivement. À chaque étape, projeter le diff avec le code précédent.

### 2a. Importer la lib Nox (1 min)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Nox, euint256, externalEuint256} from
    "@iexec-nox/nox-protocol-contracts/contracts/sdk/Nox.sol";

contract ConfidentialPiggyBank {
    // On continue dans un instant…
}
```

> « On importe trois choses : la lib `Nox` qui expose les fonctions, `euint256` qui est le type *handle chiffré*, et `externalEuint256` qu'on va utiliser pour recevoir des entrées chiffrées depuis l'extérieur. »

### 2b. Les variables d'état (1 min)

```solidity
    euint256 public balance;     // ⚠ avant: uint256 private
    address public owner;
```

> « Deux changements : `uint256` devient `euint256`, et on passe **en public**. Pourquoi public ? Parce que ce qui est exposé par le getter, c'est le **handle** — un pointeur chiffré. La vraie valeur nécessite des droits ACL pour être déchiffrée. Donc autant laisser le handle accessible, ça ne fuite rien. »

### 2c. Le constructor (2 min)

```solidity
    constructor() {
        owner = msg.sender;
        balance = Nox.toEuint256(0);
        Nox.allowThis(balance);
        Nox.allow(balance, owner);
    }
```

> « Trois lignes clés :
>
> - `Nox.toEuint256(0)` : on ne peut pas faire `balance = 0` parce que `balance` est un handle, pas un int. Cette fonction chiffre `0` et renvoie le handle.
> - `Nox.allowThis(balance)` : **le contrat lui-même** a le droit de continuer à utiliser ce handle. Si on oublie ça, au prochain `deposit`, le contrat n'aura plus le droit de lire son propre solde → tx revert.
> - `Nox.allow(balance, owner)` : le propriétaire peut déchiffrer. »

### 2d. deposit — entrée chiffrée (3 min)

```solidity
    function deposit(externalEuint256 inputHandle, bytes calldata inputProof) external {
        euint256 amount = Nox.fromExternal(inputHandle, inputProof);
        balance = Nox.add(balance, amount);
        Nox.allowThis(balance);
        Nox.allow(balance, owner);
    }
```

> « Le user ne peut pas envoyer un `uint256` en clair dans la tx — sinon tout le monde verrait le montant sur Arbiscan. À la place, il envoie :
>
> 1. **`inputHandle`** : un pointeur vers la valeur chiffrée (la valeur a été uploadée au gateway Nox juste avant).
> 2. **`inputProof`** : une preuve cryptographique que le handle est bien lié à une valeur qu'il contrôle.
>
> `Nox.fromExternal()` valide la preuve et renvoie le handle interne utilisable.
>
> `Nox.add(balance, amount)` : addition sur **handles chiffrés**. En pratique, l'appel émet un event qui déclenche le calcul dans l'enclave TEE. Le handle résultat est une nouvelle référence. »

**Attention — à dire** :
> « Et après chaque modif de `balance`, on refait les `allowThis` et `allow`, parce que le nouveau handle est un nouvel objet — les droits précédents ne s'y appliquent pas automatiquement. »

### 2e. withdraw (1 min)

```solidity
    function withdraw(externalEuint256 inputHandle, bytes calldata inputProof) external {
        require(msg.sender == owner);
        euint256 amount = Nox.fromExternal(inputHandle, inputProof);
        balance = Nox.sub(balance, amount);
        Nox.allowThis(balance);
        Nox.allow(balance, owner);
    }
```

> « Très similaire à `deposit`. **Mais** — regardez ce qu'il n'y a plus : le `require(amount <= balance)`. Impossible de le faire ! Les deux sont chiffrés, Solidity ne sait pas comparer. En production on utiliserait `Nox.safeSub()` qui gère l'underflow silencieusement sans leak. »

### 2f. Récap visuel (2 min)

**À projeter** : le contrat complet, à côté du contrat classique.

> « Regardez : on est passés d'un contrat de 15 lignes vanille à un contrat confidentiel en modifiant **6 lignes**. Le reste du code, la logique, tout est préservé. C'est ça le vrai argument de Nox : **vous écrivez du Solidity presque normal**. »

---

## 3. Déploiement sur Arbitrum Sepolia — 4 min

**Live action dans Remix** :

1. **Solidity Compiler** → version `0.8.27` (ou +), **Enable Optimization** coché, 200 runs, **Enable viaIR** coché.
   - Si erreur "stack too deep" → c'est viaIR qui doit être activé.
2. **Compile** (🔁 **pas** "Compile and Run script", sinon erreur *"You have not set a script to run"*).
3. **Deploy & Run** :
   - Environment : `Injected Provider - MetaMask`
   - MetaMask popup → approuver la connexion
   - **Vérifier** dans MetaMask que le réseau est **Arbitrum Sepolia** (pas Ethereum mainnet !)
   - Contract : `ConfidentialPiggyBank`
   - **Deploy** → confirmer dans MetaMask
4. Attendre ~5s la confirmation. L'adresse apparaît sous *Deployed Contracts*.
5. **Copier l'adresse** + l'ouvrir sur https://sepolia.arbiscan.io/address/\<adresse\>
   - Montrer : le contrat est on-chain, vérifiable, mais son stockage ne contient que des handles opaques.

**Backup** : si le deploy rate (pas de gas, réseau capricieux), utiliser l'adresse de secours pré-déployée.

---

## 4. Interagir : encrypt → deposit → decrypt — 5 min

**À projeter** : la page doc https://docs.iex.ec/nox-protocol/getting-started/hello-world scrollée jusqu'au widget intégré.

### Encrypt (1 min)

1. Dans le widget : **Connect wallet** (même MetaMask).
2. **Contract address** : coller l'adresse déployée.
3. **Value** : taper `100`.
4. **Encrypt** → deux champs apparaissent :
   - `handle` : `0x…` (32 bytes)
   - `handleProof` : `0x…` (long)

> « Ce que le widget vient de faire : il a envoyé `100` au gateway Nox via TLS. Le gateway a chiffré, stocké off-chain, renvoyé le handle + la preuve. Le plaintext `100` n'est jamais allé sur la blockchain. »

### Deposit (1 min)

Retour dans Remix, sur le contrat déployé :
1. Déplier `deposit` dans *Deployed Contracts*.
2. Coller `handle` dans `inputHandle`, coller `handleProof` dans `inputProof`.
3. **transact** → confirmer MetaMask.
4. Ouvrir la tx sur Arbiscan : **lire les inputs encodés**. C'est illisible, parfait.

### Decrypt (2 min)

1. Dans Remix, cliquer sur le getter **`balance`** → récupérer le handle actuel (0x…).
2. Dans le widget doc, onglet **Decrypt** : coller le handle.
3. **Decrypt** → la valeur `100` s'affiche en clair — **côté client uniquement**.

> « Et voilà. La blockchain a fait `0 + 100`, sans jamais voir `100`. Le solde est on-chain, vérifiable, mais illisible sauf si vous avez la permission ACL. »

---

## 5. Récap + Q&A — 3 min

**À dire en closing** :

> « En 25 minutes on a :
>
> 1. Transformé un Solidity vanille en contrat confidentiel — **6 lignes modifiées**.
> 2. Déployé sur Arbitrum Sepolia, une vraie L2 Ethereum.
> 3. Interagi avec des valeurs chiffrées de bout en bout, sans que la blockchain voie jamais le plaintext.
>
> Les use cases évidents derrière : dark pools, payroll privé, vaults institutionnels, lending où le collatéral est privé. Tout ça sans casser la composabilité DeFi.
>
> Le repo avec tout — contrats, tests Hardhat, scripts de déploiement, notes — est là : **github.com/edenbd1/iexec-nox-hello-world-workshop**. Forkez, clonez, cassez, améliorez. »

### Questions à anticiper

- *« C'est vraiment sécurisé ? Intel TDX ça peut casser. »*
  → Oui, la sécurité repose sur l'intégrité du TEE. Pareil que Phala, Oasis Sapphire. Le modèle de menace est le hardware, pas le software.
- *« C'est plus cher en gas ? »*
  → Modérément. Chaque op chiffrée déclenche un event + une computation off-chain. L'ordre de grandeur c'est ~2–5× un appel classique, pas 100×.
- *« Pourquoi pas de la FHE ? »*
  → La FHE est ~1000× plus lente aujourd'hui, incompatible avec du DeFi temps réel. Les TEE sont le bon compromis 2026.
- *« Et si je veux comparer deux valeurs chiffrées ? »*
  → `Nox.lt()`, `Nox.gt()`, `Nox.eq()` renvoient des `ebool`. On ne peut pas faire `if (ebool)` direct en Solidity — il faut passer par `Nox.select(cond, a, b)`.
- *« Tests unitaires locaux possibles ? »*
  → Les tests qui utilisent `Nox.fromExternal` ne marchent pas sur un simple hardhat node (pas de gateway). Il faut soit : un fork d'Arbitrum Sepolia (valide l'ABI + la résolution de proxy), soit déployer en vrai. Le repo inclut les deux niveaux de tests.

---

## Liens utiles (à afficher sur la slide finale)

- Hello World : https://docs.iex.ec/nox-protocol/getting-started/hello-world
- Repo workshop : https://github.com/edenbd1/iexec-nox-hello-world-workshop
- Package Solidity : https://www.npmjs.com/package/@iexec-nox/nox-protocol-contracts
- Package JS SDK : https://www.npmjs.com/package/@iexec-nox/handle
- NoxCompute sur Arb Sepolia : https://sepolia.arbiscan.io/address/0xd464B198f06756a1d00be223634b85E0a731c229
- Discord iExec : https://discord.com/invite/5TewNUnJHN

---

## Checklist post-workshop (ton feedback à collecter)

- [ ] Combien de personnes ont réussi à déployer leur propre contrat ?
- [ ] Quelle étape a bloqué le plus de monde ?
- [ ] Questions qui sont revenues plusieurs fois → candidates à faire remonter en doc.
