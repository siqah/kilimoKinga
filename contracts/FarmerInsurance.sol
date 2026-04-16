// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title IWeatherOracle
 * @notice Interface for weather data oracle (includes NDVI)
 */
interface IWeatherOracle {
    function getWeatherData(
        string calldata region
    ) external view returns (uint256 rainfall, uint256 temperature, uint256 timestamp);

    function getNDVI(
        string calldata region
    ) external view returns (uint256 ndvi);
}

interface IInsurancePool {
    function payClaim(address _farmer, uint256 _amount) external;
}

/**
 * @title FarmerInsurance (v3 — Stablecoin + UUPS Upgradeable)
 * @notice Decentralized parametric crop insurance with:
 *         1) Stablecoin standard (USDC) to prevent crypto volatility
 *         2) UUPS proxy Upgradeability
 *         3) Custom errors for gas savings
 *         4) NDVI-based claims (satellite vegetation data)
 */
contract FarmerInsurance is Initializable, UUPSUpgradeable, OwnableUpgradeable {
    using SafeERC20 for IERC20;

    // ── Custom Errors ────────────────────────────────────────────────────
    error AlreadyActive();
    error NotActive();
    error NotRegistered();
    error ClaimAlreadyPaid();
    error RegionNotSupported();
    error InsufficientPremium(uint256 sent, uint256 required);
    error SeasonNotEnded(uint256 endsAt);
    error ZeroAddress();

    // ── Structs ──────────────────────────────────────────────────────────
    struct Farmer {
        uint256 premiumPaid;
        uint256 coverageAmount;
        uint256 claimPaid;
        uint256 seasonsCompleted;
        uint256 seasonStart;
        string region;
        bool isRegistered;
        bool active;
    }

    struct Policy {
        uint256 rainfallThreshold;
        uint256 temperatureThreshold;
        uint256 ndviThreshold;
        uint256 payoutMultiplier;
        uint256 premiumAmount;
        uint256 seasonDuration;
        uint256 partialPayoutPercent;
        uint256 severeThresholdPercent;
    }

    // ── Constants ────────────────────────────────────────────────────────
    uint256 public constant LOYALTY_DISCOUNT_PER_SEASON = 5;
    uint256 public constant MAX_LOYALTY_DISCOUNT = 25;
    uint256 public constant LOYALTY_BONUS_SEASONS = 3;

    // ── State ────────────────────────────────────────────────────────────
    IWeatherOracle public oracle;
    IERC20 public stablecoin;
    IInsurancePool public pool;
    
    uint256 public totalPremiums;
    uint256 public totalClaims;
    uint256 public farmerCount;
    uint256 public currentSeason;

    mapping(address => Farmer) public farmers;
    mapping(string => Policy) public regionalPolicies;
    address[] public farmerAddresses;
    mapping(address => bool) public isKnownFarmer;

    // ── Events ───────────────────────────────────────────────────────────
    event FarmerRegistered(address indexed farmer, string region, uint256 premium, uint256 season);
    event ClaimPaid(address indexed farmer, uint256 amount, string reason, uint256 severity);
    event PolicyUpdated(string region, uint256 rainfallThreshold, uint256 temperatureThreshold, uint256 ndviThreshold);
    event SeasonRenewed(address indexed farmer, uint256 season, uint256 discountApplied);
    event NewSeasonStarted(uint256 season);
    event OracleUpdated(address indexed oldOracle, address indexed newOracle);

    // ── Upgrades Setup ───────────────────────────────────────────────────
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _oracle, address _stablecoin, address _pool) public initializer {
        __Ownable_init(msg.sender);

        if (_oracle == address(0) || _stablecoin == address(0) || _pool == address(0)) revert ZeroAddress();
        
        oracle = IWeatherOracle(_oracle);
        stablecoin = IERC20(_stablecoin);
        pool = IInsurancePool(_pool);
        currentSeason = 1;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    // ── Admin: Configuration ─────────────────────────────────────────────
    function setOracle(address _newOracle) external onlyOwner {
        if (_newOracle == address(0)) revert ZeroAddress();
        address old = address(oracle);
        oracle = IWeatherOracle(_newOracle);
        emit OracleUpdated(old, _newOracle);
    }

    function setPool(address _newPool) external onlyOwner {
        if (_newPool == address(0)) revert ZeroAddress();
        pool = IInsurancePool(_newPool);
    }

    function setPolicy(
        string calldata _region,
        uint256 _rainfallThreshold,
        uint256 _temperatureThreshold,
        uint256 _ndviThreshold,
        uint256 _premiumAmount,
        uint256 _payoutMultiplier,
        uint256 _seasonDuration,
        uint256 _partialPayoutPercent,
        uint256 _severeThresholdPercent
    ) external onlyOwner {
        regionalPolicies[_region] = Policy({
            rainfallThreshold: _rainfallThreshold,
            temperatureThreshold: _temperatureThreshold,
            ndviThreshold: _ndviThreshold,
            premiumAmount: _premiumAmount,
            payoutMultiplier: _payoutMultiplier,
            seasonDuration: _seasonDuration,
            partialPayoutPercent: _partialPayoutPercent,
            severeThresholdPercent: _severeThresholdPercent
        });

        emit PolicyUpdated(_region, _rainfallThreshold, _temperatureThreshold, _ndviThreshold);
    }

    // ── Admin: Rescue Funds
    function withdrawFallbackFund(address to, uint256 amount) external onlyOwner {
        payable(to).transfer(amount);
    }

    function withdrawERC20Fallback(address token, address to, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(to, amount);
    }

    // ── Farmer: Register for a season
    function register(string calldata _region) external {
        _registerFor(msg.sender, msg.sender, _region);
    }

    // ── Admin/Bridge: Register on behalf of a farmer
    function registerFor(address _farmer, string calldata _region) external {
        _registerFor(msg.sender, _farmer, _region);
    }

    function _registerFor(address _payer, address _farmer, string calldata _region) internal {
        Policy memory policy = regionalPolicies[_region];
        if (policy.premiumAmount == 0) revert RegionNotSupported();

        Farmer storage farmer = farmers[_farmer];
        if (farmer.active) revert AlreadyActive();

        uint256 actualPremium = _calculatePremiumWithDiscount(policy.premiumAmount, farmer.seasonsCompleted);
        
        // Payer must approve FarmerInsurance to spend their stablecoin beforehand
        stablecoin.safeTransferFrom(_payer, address(this), actualPremium);

        uint256 discount = farmer.seasonsCompleted > 0
            ? policy.premiumAmount - actualPremium
            : 0;

        farmer.isRegistered = true;
        farmer.region = _region;
        farmer.premiumPaid = actualPremium;
        farmer.coverageAmount = policy.premiumAmount * policy.payoutMultiplier;
        farmer.claimPaid = 0;
        farmer.active = true;
        farmer.seasonStart = block.timestamp;

        if (!isKnownFarmer[_farmer]) {
            isKnownFarmer[_farmer] = true;
            farmerAddresses.push(_farmer);
            farmerCount++;
        }

        totalPremiums += actualPremium;

        emit FarmerRegistered(_farmer, _region, actualPremium, currentSeason);
        if (discount > 0) {
            emit SeasonRenewed(_farmer, currentSeason, discount);
        }
    }

    // ── Admin: Check weather and auto-pay claim ──────────────────────────
    function checkAndPayClaim(address _farmer) external onlyOwner {
        Farmer storage farmer = farmers[_farmer];
        if (!farmer.isRegistered) revert NotRegistered();
        if (!farmer.active) revert NotActive();
        if (farmer.claimPaid != 0) revert ClaimAlreadyPaid();

        Policy memory policy = regionalPolicies[farmer.region];

        (uint256 rainfall, uint256 temperature, ) = oracle.getWeatherData(farmer.region);
        uint256 ndvi = 0;
        try oracle.getNDVI(farmer.region) returns (uint256 _ndvi) {
            ndvi = _ndvi;
        } catch {}

        uint256 severity = 0;
        string memory reason;

        // Drought check
        if (rainfall < policy.rainfallThreshold) {
            uint256 deficit = ((policy.rainfallThreshold - rainfall) * 100) / policy.rainfallThreshold;
            if (deficit >= policy.severeThresholdPercent) {
                severity = 2;
                reason = "Severe drought";
            } else {
                severity = 1;
                reason = "Moderate drought";
            }
        }

        // Heat check
        if (temperature > policy.temperatureThreshold) {
            uint256 excess = ((temperature - policy.temperatureThreshold) * 100) / policy.temperatureThreshold;
            uint256 heatSeverity = excess >= policy.severeThresholdPercent ? 2 : 1;
            if (heatSeverity > severity) {
                severity = heatSeverity;
                reason = heatSeverity == 2 ? "Severe heat" : "Moderate heat";
            }
        }

        // NDVI check
        if (policy.ndviThreshold > 0 && ndvi > 0 && ndvi < policy.ndviThreshold) {
            uint256 ndviDeficit = ((policy.ndviThreshold - ndvi) * 100) / policy.ndviThreshold;
            uint256 ndviSeverity = ndviDeficit >= policy.severeThresholdPercent ? 2 : 1;
            if (ndviSeverity > severity) {
                severity = ndviSeverity;
                reason = ndviSeverity == 2 ? "Severe crop damage" : "Moderate crop damage";
            }
        }

        if (severity > 0) {
            uint256 claimAmount;
            if (severity == 2) {
                claimAmount = farmer.coverageAmount;
            } else {
                claimAmount = (farmer.coverageAmount * policy.partialPayoutPercent) / 100;
            }

            farmer.claimPaid = claimAmount;
            farmer.active = false;
            farmer.seasonsCompleted++;
            totalClaims += claimAmount;

            pool.payClaim(_farmer, claimAmount);
            emit ClaimPaid(_farmer, claimAmount, reason, severity);
        }
    }

    // ── Farmer: End season ───────────────────────────────────────────────
    function endSeason() external {
        Farmer storage farmer = farmers[msg.sender];
        if (!farmer.active) revert NotActive();

        Policy memory policy = regionalPolicies[farmer.region];
        if (block.timestamp < farmer.seasonStart + policy.seasonDuration) {
            revert SeasonNotEnded(farmer.seasonStart + policy.seasonDuration);
        }

        farmer.active = false;
        farmer.seasonsCompleted++;
    }

    function advanceSeason() external onlyOwner {
        currentSeason++;
        emit NewSeasonStarted(currentSeason);
    }

    // ── Internal ─────────────────────────────────────────────────────────
    function _calculatePremiumWithDiscount(
        uint256 _basePremium,
        uint256 _seasonsCompleted
    ) internal pure returns (uint256) {
        if (_seasonsCompleted < LOYALTY_BONUS_SEASONS) {
            return _basePremium;
        }

        uint256 discountSeasons = _seasonsCompleted - LOYALTY_BONUS_SEASONS + 1;
        uint256 discountPercent = discountSeasons * LOYALTY_DISCOUNT_PER_SEASON;
        if (discountPercent > MAX_LOYALTY_DISCOUNT) {
            discountPercent = MAX_LOYALTY_DISCOUNT;
        }

        return _basePremium - (_basePremium * discountPercent / 100);
    }

    // ── Views ────────────────────────────────────────────────────────────
    function getFarmerDetails(
        address _farmer
    )
        public
        view
        returns (
            bool isRegistered,
            string memory region,
            uint256 premiumPaid,
            uint256 coverageAmount,
            uint256 claimPaid,
            bool active,
            uint256 seasonsCompleted,
            uint256 loyaltyDiscount
        )
    {
        Farmer memory f = farmers[_farmer];
        uint256 discount = 0;
        if (f.seasonsCompleted >= LOYALTY_BONUS_SEASONS && bytes(f.region).length > 0) {
            Policy memory p = regionalPolicies[f.region];
            if (p.premiumAmount > 0) {
                discount = p.premiumAmount - _calculatePremiumWithDiscount(p.premiumAmount, f.seasonsCompleted);
            }
        }
        return (f.isRegistered, f.region, f.premiumPaid, f.coverageAmount, f.claimPaid, f.active, f.seasonsCompleted, discount);
    }

    function getLoyaltyDiscount(address _farmer) public view returns (uint256 discountPercent, uint256 seasonsCompleted) {
        Farmer memory f = farmers[_farmer];
        seasonsCompleted = f.seasonsCompleted;
        if (seasonsCompleted < LOYALTY_BONUS_SEASONS) {
            discountPercent = 0;
        } else {
            uint256 discountSeasons = seasonsCompleted - LOYALTY_BONUS_SEASONS + 1;
            discountPercent = discountSeasons * LOYALTY_DISCOUNT_PER_SEASON;
            if (discountPercent > MAX_LOYALTY_DISCOUNT) {
                discountPercent = MAX_LOYALTY_DISCOUNT;
            }
        }
    }

    function getFarmerCount() public view returns (uint256) {
        return farmerCount;
    }

    receive() external payable {}
}
