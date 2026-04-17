// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/// @title PiggyBank — classic (non-confidential) version used as the workshop starting point.
/// @notice Balances and amounts are stored as plain uint256. Anyone can read the storage slot
///         holding `balance` with `eth_getStorageAt`, so "private" here is a Solidity visibility
///         modifier, NOT a privacy guarantee. Step 2 of the workshop upgrades this to a
///         confidential version using the Nox protocol.
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
        require(msg.sender == owner, "not owner");
        require(amount <= balance, "insufficient balance");
        balance -= amount;
    }

    function getBalance() external view returns (uint256) {
        return balance;
    }
}
