// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./FarmerInsurance.sol";

/**
 * @title MpesaBridge
 * @notice Allows a backend relay to register farmers who pay via M-Pesa (Paystack).
 *         Maps phone numbers to on-chain identities so payouts can be routed
 *         back to M-Pesa via the backend.
 *
 * Flow:
 *   1. Farmer pays premium via M-Pesa (Paystack STK push)
 *   2. Backend receives webhook confirmation
 *   3. Backend calls registerFarmerViaMpesa() on this contract
 *   4. This contract calls FarmerInsurance.register() on behalf of the farmer
 *   5. On claim payout, backend watches ClaimPaid events and sends M-Pesa via Paystack Transfer
 */
contract MpesaBridge {
    // ── Structs ──────────────────────────────────────────────────────────
    struct MpesaFarmer {
        string phoneHash;       // keccak hash of phone number (privacy)
        string region;
        address walletAddress;  // backend-managed wallet
        bool registered;
        uint256 totalPaidKES;   // total premium paid in KES (for records)
    }

    // ── State ────────────────────────────────────────────────────────────
    address public admin;
    address public relayAddress;       // backend wallet that calls registration
    FarmerInsurance public insurance;

    mapping(bytes32 => MpesaFarmer) public mpesaFarmers;  // phoneHash => farmer
    mapping(address => bytes32) public walletToPhone;      // wallet => phoneHash
    bytes32[] public allPhoneHashes;

    uint256 public mpesaFarmerCount;
    uint256 public totalKESCollected;

    // ── Events ───────────────────────────────────────────────────────────
    event MpesaFarmerRegistered(
        bytes32 indexed phoneHash,
        address indexed wallet,
        string region,
        uint256 premiumWei,
        uint256 premiumKES
    );

    event MpesaPayoutTriggered(
        bytes32 indexed phoneHash,
        address indexed wallet,
        uint256 amountWei,
        string reason
    );

    // ── Modifiers ────────────────────────────────────────────────────────
    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin");
        _;
    }

    modifier onlyRelay() {
        require(msg.sender == relayAddress || msg.sender == admin, "Only relay");
        _;
    }

    // ── Constructor ──────────────────────────────────────────────────────
    constructor(address _insurance, address _relay) {
        admin = msg.sender;
        insurance = FarmerInsurance(payable(_insurance));
        relayAddress = _relay;
    }

    /**
     * @notice Register a farmer who paid via M-Pesa
     * @param _phoneHash   keccak256 of the phone number (e.g., keccak256("254712345678"))
     * @param _walletAddress  Backend-managed wallet for this farmer
     * @param _region      Insurance region
     * @param _premiumKES  Amount paid in KES (for record-keeping)
     * @dev   Relay must send enough ETH to cover the insurance premium
     */
    function registerFarmerViaMpesa(
        bytes32 _phoneHash,
        address _walletAddress,
        string calldata _region,
        uint256 _premiumKES
    ) external payable onlyRelay {
        require(!mpesaFarmers[_phoneHash].registered || !_isActive(_walletAddress), "Already active");

        // Get the premium amount from the insurance policy
        (,,,,uint256 premiumAmount,,,) = insurance.regionalPolicies(_region);
        require(premiumAmount > 0, "Region not supported");
        require(msg.value >= premiumAmount, "Insufficient ETH for premium");

        // Register on the insurance contract using the farmer's managed wallet
        // We need to call register as if from the wallet — but since we can't,
        // we send premium to insurance contract directly and track mapping
        (bool success,) = address(insurance).call{value: premiumAmount}("");
        require(success, "Premium transfer failed");

        // Store M-Pesa mapping
        mpesaFarmers[_phoneHash] = MpesaFarmer({
            phoneHash: string(abi.encodePacked(_phoneHash)),
            region: _region,
            walletAddress: _walletAddress,
            registered: true,
            totalPaidKES: _premiumKES
        });

        walletToPhone[_walletAddress] = _phoneHash;

        if (!_hasPhoneHash(_phoneHash)) {
            allPhoneHashes.push(_phoneHash);
            mpesaFarmerCount++;
        }

        totalKESCollected += _premiumKES;

        // Refund excess
        if (msg.value > premiumAmount) {
            payable(msg.sender).transfer(msg.value - premiumAmount);
        }

        emit MpesaFarmerRegistered(_phoneHash, _walletAddress, _region, premiumAmount, _premiumKES);
    }

    /**
     * @notice Emit event for backend to send M-Pesa payout
     * @dev    Called by admin/relay when a claim is detected
     */
    function triggerMpesaPayout(
        address _farmerWallet,
        uint256 _amountWei,
        string calldata _reason
    ) external onlyRelay {
        bytes32 phoneHash = walletToPhone[_farmerWallet];
        require(phoneHash != bytes32(0), "No M-Pesa mapping");

        emit MpesaPayoutTriggered(phoneHash, _farmerWallet, _amountWei, _reason);
    }

    // ── Admin ────────────────────────────────────────────────────────────
    function setRelayAddress(address _relay) external onlyAdmin {
        relayAddress = _relay;
    }

    // ── Views ────────────────────────────────────────────────────────────
    function getMpesaFarmer(bytes32 _phoneHash) external view returns (
        string memory region,
        address walletAddress,
        bool registered,
        uint256 totalPaidKES
    ) {
        MpesaFarmer memory f = mpesaFarmers[_phoneHash];
        return (f.region, f.walletAddress, f.registered, f.totalPaidKES);
    }

    function isMpesaFarmer(address _wallet) external view returns (bool) {
        return walletToPhone[_wallet] != bytes32(0);
    }

    // ── Internal ───────────────────────────────────────────────────────
    function _isActive(address _wallet) internal view returns (bool) {
        try insurance.farmers(_wallet) returns (
            bool, string memory, uint256, uint256, uint256, bool active, uint256, uint256
        ) {
            return active;
        } catch {
            return false;
        }
    }

    function _hasPhoneHash(bytes32 _hash) internal view returns (bool) {
        for (uint i = 0; i < allPhoneHashes.length; i++) {
            if (allPhoneHashes[i] == _hash) return true;
        }
        return false;
    }

    // Allow receiving ETH
    receive() external payable {}
}
