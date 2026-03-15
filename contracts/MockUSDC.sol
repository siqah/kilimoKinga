// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockUSDC
 * @notice Simple ERC-20 mock stablecoin for testing the InsurancePool.
 *         Anyone can mint tokens (test only – NOT for production).
 */
contract MockUSDC is ERC20 {
    uint8 private _decimals;

    constructor() ERC20("Mock USDC", "mUSDC") {
        _decimals = 6; // USDC uses 6 decimals
    }

    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }

    /**
     * @notice Mint tokens for testing
     */
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
