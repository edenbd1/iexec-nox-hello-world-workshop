// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Nox, euint256, externalEuint256} from
    "@iexec-nox/nox-protocol-contracts/contracts/sdk/Nox.sol";

/// @title ConfidentialPiggyBank — the Nox version of PiggyBank.
/// @notice `balance` is now an encrypted handle (`euint256`) that points to a ciphertext
///         stored off-chain. Deposit/withdraw amounts are also submitted encrypted, with
///         a proof validated by Nox.fromExternal. The real computation happens inside an
///         Intel TDX enclave; on-chain we only manipulate 32-byte handles.
///
///         Addresses and function selectors remain public (confidentiality, not anonymity).
contract ConfidentialPiggyBank {
    euint256 public balance;
    address public owner;

    constructor() {
        owner = msg.sender;
        balance = Nox.toEuint256(0);
        // Grant the contract permission to keep using this handle in future calls,
        // and grant the owner permission to decrypt it.
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
        require(msg.sender == owner, "not owner");
        euint256 amount = Nox.fromExternal(inputHandle, inputProof);
        // NB: we cannot do `require(amount <= balance)` — both are encrypted handles and
        // Solidity has no plaintext comparison. In production use Nox.safeSub(), which
        // guards against underflow without leaking information.
        balance = Nox.sub(balance, amount);
        Nox.allowThis(balance);
        Nox.allow(balance, owner);
    }
}
