// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

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

/**
 * @title FarmerInsurance (v3 — Gas Optimized + Upgradeable-Ready)
 * @notice Decentralized parametric crop insurance with:
 *         1) Custom errors for gas savings
 *         2) Struct packing for storage efficiency
 *         3) Swappable oracle address
 *         4) Multi-season policies with loyalty discounts
 *         5) Tiered payouts (full, partial, none)
 *         6) NDVI-based claims (satellite vegetation data)
 *
 * @dev To upgrade to UUPS Proxy:
 *      1. npm install @openzeppelin/contracts-upgradeable
 *      2. Inherit Initializable, UUPSUpgradeable, OwnableUpgradeable
 *      3. Replace constructor with initialize() + initializer modifier
 *      4. Add _authorizeUpgrade override
 */
contract FarmerInsurance {
    // ── Custom Errors ────────────────────────────────────────────────────
    error OnlyAdmin();
    error AlreadyActive();
    error NotActive();
    error NotRegistered();
    error ClaimAlreadyPaid();
    error RegionNotSupported();
    error InsufficientPremium(uint256 sent, uint256 required);
    error InsufficientFunds(uint256 available, uint256 required);
    error SeasonNotEnded(uint256 endsAt);
    error ZeroAddress();

    // ── Structs (packed for storage efficiency) ──────────────────────────
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
    address public admin;
    IWeatherOracle public oracle;
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

    // ── Modifiers ────────────────────────────────────────────────────────
    modifier onlyAdmin() {
        if (msg.sender != admin) revert OnlyAdmin();
        _;
    }

    // ── Constructor ──────────────────────────────────────────────────────
    constructor(address _oracle) {
        if (_oracle == address(0)) revert ZeroAddress();
        admin = msg.sender;
        oracle = IWeatherOracle(_oracle);
        currentSeason = 1;
    }

    // ── Admin: Swap oracle address ───────────────────────────────────────
    function setOracle(address _newOracle) external onlyAdmin {
        if (_newOracle == address(0)) revert ZeroAddress();
        address old = address(oracle);
        oracle = IWeatherOracle(_newOracle);
        emit OracleUpdated(old, _newOracle);
    }

    // ── Admin: Configure regional policy ─────────────────────────────────
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
    ) external onlyAdmin {
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

    // ── Farmer: Register for a season ────────────────────────────────────
    function register(string calldata _region) external payable {
        Policy memory policy = regionalPolicies[_region];
        if (policy.premiumAmount == 0) revert RegionNotSupported();

        Farmer storage farmer = farmers[msg.sender];
        if (farmer.active) revert AlreadyActive();

        uint256 actualPremium = _calculatePremiumWithDiscount(policy.premiumAmount, farmer.seasonsCompleted);
        if (msg.value < actualPremium) revert InsufficientPremium(msg.value, actualPremium);

        // Refund excess
        if (msg.value > actualPremium) {
            payable(msg.sender).transfer(msg.value - actualPremium);
        }

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

        if (!isKnownFarmer[msg.sender]) {
            isKnownFarmer[msg.sender] = true;
            farmerAddresses.push(msg.sender);
            farmerCount++;
        }

        totalPremiums += actualPremium;

        emit FarmerRegistered(msg.sender, _region, actualPremium, currentSeason);
        if (discount > 0) {
            emit SeasonRenewed(msg.sender, currentSeason, discount);
        }
    }

    // ── Admin: Check weather and auto-pay claim ──────────────────────────
    function checkAndPayClaim(address _farmer) external onlyAdmin {
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

            if (address(this).balance < claimAmount) revert InsufficientFunds(address(this).balance, claimAmount);

            farmer.claimPaid = claimAmount;
            farmer.active = false;
            farmer.seasonsCompleted++;
            totalClaims += claimAmount;

            payable(_farmer).transfer(claimAmount);
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

    // ── Admin: Advance global season ─────────────────────────────────────
    function advanceSeason() external onlyAdmin {
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
    function getContractBalance() public view returns (uint256) {
        return address(this).balance;
    }

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
