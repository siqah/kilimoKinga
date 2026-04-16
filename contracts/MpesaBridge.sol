// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./FarmerInsurance.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title MpesaBridge
 * @notice Allows a backend relay to register farmers who pay via M-Pesa (Paystack).
 *         Maps phone numbers to on-chain identities so payouts can be routed
 *         back to M-Pesa via the backend.
 */
contract MpesaBridge is Initializable, UUPSUpgradeable, OwnableUpgradeable {
    using SafeERC20 for IERC20;

    // ── Structs ──────────────────────────────────────────────────────────
    struct MpesaFarmer {
        string phoneHash;       // keccak hash of phone number (privacy)
        string region;
        address walletAddress;  // backend-managed wallet
        bool registered;
        uint256 totalPaidKES;   // total premium paid in KES (for records)
    }

    // ── State ────────────────────────────────────────────────────────────
    address public relayAddress;       // backend wallet that calls registration
    FarmerInsurance public insurance;
    IERC20 public stablecoin;

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
    modifier onlyRelay() {
        require(msg.sender == relayAddress || msg.sender == owner(), "Only relay");
        _;
    }

    // ── Upgrades Setup ───────────────────────────────────────────────────
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _insurance, address _relay, address _stablecoin) public initializer {
        __Ownable_init(msg.sender);

        insurance = FarmerInsurance(payable(_insurance));
        relayAddress = _relay;
        stablecoin = IERC20(_stablecoin);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    /**
     * @notice Register a farmer who paid via M-Pesa
     */
    function registerFarmerViaMpesa(
        bytes32 _phoneHash,
        address _walletAddress,
        string calldata _region,
        uint256 _premiumKES
    ) external onlyRelay {
        require(!mpesaFarmers[_phoneHash].registered || !_isActive(_walletAddress), "Already active");

        (,,,,uint256 premiumAmount,,,) = insurance.regionalPolicies(_region);
        require(premiumAmount > 0, "Region not supported");

        // The bridge needs allowance from the relay first to pull the stablecoin
        stablecoin.safeTransferFrom(msg.sender, address(this), premiumAmount);
        
        // Then approve FarmerInsurance to pull the stablecoin from the bridge
        stablecoin.approve(address(insurance), premiumAmount);

        // Register on behalf of the farmer's allocated wallet address
        insurance.registerFor(_walletAddress, _region);

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

        emit MpesaFarmerRegistered(_phoneHash, _walletAddress, _region, premiumAmount, _premiumKES);
    }

    /**
     * @notice Emit event for backend to send M-Pesa payout
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
    function setRelayAddress(address _relay) external onlyOwner {
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
}
