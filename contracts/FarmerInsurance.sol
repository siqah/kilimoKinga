// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IWeatherOracle
 * @notice Interface for weather data oracle (now includes NDVI)
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
 * @title FarmerInsurance (Enhanced v2)
 * @notice Decentralized parametric crop insurance with:
 *         1) Multi-season policies (farmers can re-register each season)
 *         2) Tiered payouts (full, partial, none based on severity)
 *         3) NDVI-based claims (satellite vegetation data)
 *         4) Loyalty discounts (long-term farmers pay less)
 */
contract FarmerInsurance {
    // ── Structs ──────────────────────────────────────────────────────────
    struct Farmer {
        bool isRegistered;
        string region;
        uint256 premiumPaid;
        uint256 coverageAmount;
        uint256 claimPaid;
        bool active;
        uint256 seasonsCompleted;  // loyalty tracker
        uint256 seasonStart;      // when current season started
    }

    struct Policy {
        uint256 rainfallThreshold;       // mm – below this triggers drought
        uint256 temperatureThreshold;    // °C – above this triggers heat
        uint256 ndviThreshold;           // NDVI (0-10000) – below triggers crop damage
        uint256 payoutMultiplier;        // e.g. 2 = 2× the premium (full payout)
        uint256 premiumAmount;           // wei
        uint256 seasonDuration;          // seconds – how long a season lasts
        // Tiered payout thresholds (percentage of how far past threshold)
        uint256 partialPayoutPercent;    // e.g. 50 = 50% payout for moderate events
        uint256 severeThresholdPercent;  // e.g. 30 = 30% below/above threshold = severe (full payout)
    }

    // ── Constants ────────────────────────────────────────────────────────
    uint256 public constant LOYALTY_DISCOUNT_PER_SEASON = 5;  // 5% discount per completed season
    uint256 public constant MAX_LOYALTY_DISCOUNT = 25;         // max 25% discount
    uint256 public constant LOYALTY_BONUS_SEASONS = 3;         // bonus starts after 3 seasons

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

    // Track unique farmers (for farmerCount – don't double count re-registrations)
    mapping(address => bool) public isKnownFarmer;

    // ── Events ───────────────────────────────────────────────────────────
    event FarmerRegistered(address indexed farmer, string region, uint256 premium, uint256 season);
    event ClaimPaid(address indexed farmer, uint256 amount, string reason, uint256 severity);
    event PolicyUpdated(string region, uint256 rainfallThreshold, uint256 temperatureThreshold, uint256 ndviThreshold);
    event SeasonRenewed(address indexed farmer, uint256 season, uint256 discountApplied);
    event NewSeasonStarted(uint256 season);

    // ── Modifiers ────────────────────────────────────────────────────────
    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin");
        _;
    }

    // ── Constructor ──────────────────────────────────────────────────────
    constructor(address _oracle) {
        admin = msg.sender;
        oracle = IWeatherOracle(_oracle);
        currentSeason = 1;
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
        require(policy.premiumAmount > 0, "Region not supported");

        Farmer storage farmer = farmers[msg.sender];

        // If already registered AND still active, reject
        require(!farmer.active, "Already active this season");

        // Calculate premium with loyalty discount
        uint256 actualPremium = _calculatePremiumWithDiscount(policy.premiumAmount, farmer.seasonsCompleted);
        require(msg.value >= actualPremium, "Insufficient premium");

        // Refund any excess
        if (msg.value > actualPremium) {
            payable(msg.sender).transfer(msg.value - actualPremium);
        }

        uint256 discount = farmer.seasonsCompleted > 0
            ? policy.premiumAmount - actualPremium
            : 0;

        // Set up the farmer for this season
        farmer.isRegistered = true;
        farmer.region = _region;
        farmer.premiumPaid = actualPremium;
        farmer.coverageAmount = policy.premiumAmount * policy.payoutMultiplier; // coverage based on full premium
        farmer.claimPaid = 0;
        farmer.active = true;
        farmer.seasonStart = block.timestamp;

        // Track new farmers
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

    // ── Admin: Check weather and auto-pay claim (with tiers + NDVI) ──────
    function checkAndPayClaim(address _farmer) external onlyAdmin {
        Farmer storage farmer = farmers[_farmer];
        require(farmer.isRegistered, "Farmer not registered");
        require(farmer.active, "Farmer not active");
        require(farmer.claimPaid == 0, "Claim already paid");

        Policy memory policy = regionalPolicies[farmer.region];

        // Query oracle for the farmer's region
        (uint256 rainfall, uint256 temperature, ) = oracle.getWeatherData(farmer.region);
        uint256 ndvi = 0;
        try oracle.getNDVI(farmer.region) returns (uint256 _ndvi) {
            ndvi = _ndvi;
        } catch {
            // NDVI not available, skip that check
        }

        // Determine severity: 0 = none, 1 = moderate (partial), 2 = severe (full)
        uint256 severity = 0;
        string memory reason;

        // Check drought
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

        // Check extreme heat (upgrade severity if worse)
        if (temperature > policy.temperatureThreshold) {
            uint256 excess = ((temperature - policy.temperatureThreshold) * 100) / policy.temperatureThreshold;
            uint256 heatSeverity = excess >= policy.severeThresholdPercent ? 2 : 1;
            if (heatSeverity > severity) {
                severity = heatSeverity;
                reason = heatSeverity == 2 ? "Severe heat" : "Moderate heat";
            }
        }

        // Check NDVI (crop health from satellite)
        if (policy.ndviThreshold > 0 && ndvi > 0 && ndvi < policy.ndviThreshold) {
            uint256 ndviDeficit = ((policy.ndviThreshold - ndvi) * 100) / policy.ndviThreshold;
            uint256 ndviSeverity = ndviDeficit >= policy.severeThresholdPercent ? 2 : 1;
            if (ndviSeverity > severity) {
                severity = ndviSeverity;
                reason = ndviSeverity == 2 ? "Severe crop damage" : "Moderate crop damage";
            }
        }

        // Calculate payout based on severity tier
        if (severity > 0) {
            uint256 claimAmount;
            if (severity == 2) {
                // Full payout
                claimAmount = farmer.coverageAmount;
            } else {
                // Partial payout
                claimAmount = (farmer.coverageAmount * policy.partialPayoutPercent) / 100;
            }

            require(address(this).balance >= claimAmount, "Insufficient funds");

            farmer.claimPaid = claimAmount;
            farmer.active = false;
            farmer.seasonsCompleted++; // still earns loyalty even if claimed
            totalClaims += claimAmount;

            payable(_farmer).transfer(claimAmount);
            emit ClaimPaid(_farmer, claimAmount, reason, severity);
        }
    }

    // ── Farmer: End season (no claim, earn loyalty) ──────────────────────
    function endSeason() external {
        Farmer storage farmer = farmers[msg.sender];
        require(farmer.active, "Not active");

        Policy memory policy = regionalPolicies[farmer.region];
        require(
            block.timestamp >= farmer.seasonStart + policy.seasonDuration,
            "Season not ended yet"
        );

        farmer.active = false;
        farmer.seasonsCompleted++;
    }

    // ── Admin: Advance global season ─────────────────────────────────────
    function advanceSeason() external onlyAdmin {
        currentSeason++;
        emit NewSeasonStarted(currentSeason);
    }

    // ── Internal: Calculate premium with loyalty discount ────────────────
    function _calculatePremiumWithDiscount(
        uint256 _basePremium,
        uint256 _seasonsCompleted
    ) internal pure returns (uint256) {
        if (_seasonsCompleted < LOYALTY_BONUS_SEASONS) {
            return _basePremium; // no discount yet
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

    // Allow contract to receive funds (extra capital injection)
    receive() external payable {}
}
