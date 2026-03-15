// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IWeatherOracle
 * @notice Interface for weather data oracle used by the insurance contract
 */
interface IWeatherOracle {
    function getWeatherData(
        string calldata region
    ) external view returns (uint256 rainfall, uint256 temperature, uint256 timestamp);
}

/**
 * @title FarmerInsurance
 * @notice Decentralized parametric crop insurance for smallholder farmers.
 *         Auto-triggers payouts when weather oracle data crosses thresholds.
 * @dev    Admin sets per-region policies. Farmers register & pay premiums.
 *         Claims are checked against oracle data and paid automatically.
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
    }

    struct Policy {
        uint256 rainfallThreshold;    // mm – below this triggers drought claim
        uint256 temperatureThreshold; // °C – above this triggers heat claim
        uint256 payoutMultiplier;     // e.g. 2 = 2× the premium
        uint256 premiumAmount;        // wei
    }

    // ── State ────────────────────────────────────────────────────────────
    address public admin;
    IWeatherOracle public oracle;
    uint256 public totalPremiums;
    uint256 public totalClaims;
    uint256 public farmerCount;

    mapping(address => Farmer) public farmers;
    mapping(string => Policy) public regionalPolicies;

    // Keep a list of all farmer addresses for iteration
    address[] public farmerAddresses;

    // ── Events ───────────────────────────────────────────────────────────
    event FarmerRegistered(address indexed farmer, string region, uint256 premium);
    event ClaimPaid(address indexed farmer, uint256 amount, string reason);
    event PolicyUpdated(string region, uint256 rainfallThreshold, uint256 temperatureThreshold);

    // ── Modifiers ────────────────────────────────────────────────────────
    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin");
        _;
    }

    modifier onlyRegistered() {
        require(farmers[msg.sender].isRegistered, "Farmer not registered");
        _;
    }

    // ── Constructor ──────────────────────────────────────────────────────
    constructor(address _oracle) {
        admin = msg.sender;
        oracle = IWeatherOracle(_oracle);
    }

    // ── Admin: Configure regional policy ─────────────────────────────────
    function setPolicy(
        string calldata _region,
        uint256 _rainfallThreshold,
        uint256 _temperatureThreshold,
        uint256 _premiumAmount,
        uint256 _payoutMultiplier
    ) external onlyAdmin {
        regionalPolicies[_region] = Policy({
            rainfallThreshold: _rainfallThreshold,
            temperatureThreshold: _temperatureThreshold,
            premiumAmount: _premiumAmount,
            payoutMultiplier: _payoutMultiplier
        });

        emit PolicyUpdated(_region, _rainfallThreshold, _temperatureThreshold);
    }

    // ── Farmer: Register and pay premium ─────────────────────────────────
    function register(string calldata _region) external payable {
        Policy memory policy = regionalPolicies[_region];
        require(policy.premiumAmount > 0, "Region not supported");
        require(msg.value >= policy.premiumAmount, "Insufficient premium");
        require(!farmers[msg.sender].isRegistered, "Already registered");

        // Refund any excess payment
        if (msg.value > policy.premiumAmount) {
            payable(msg.sender).transfer(msg.value - policy.premiumAmount);
        }

        farmers[msg.sender] = Farmer({
            isRegistered: true,
            region: _region,
            premiumPaid: policy.premiumAmount,
            coverageAmount: policy.premiumAmount * policy.payoutMultiplier,
            claimPaid: 0,
            active: true
        });

        farmerAddresses.push(msg.sender);
        farmerCount++;
        totalPremiums += policy.premiumAmount;

        emit FarmerRegistered(msg.sender, _region, policy.premiumAmount);
    }

    // ── Admin: Check weather and auto-pay claim ──────────────────────────
    function checkAndPayClaim(address _farmer) external onlyAdmin {
        Farmer storage farmer = farmers[_farmer];
        require(farmer.isRegistered, "Farmer not registered");
        require(farmer.active, "Farmer not active");
        require(farmer.claimPaid == 0, "Claim already paid");

        Policy memory policy = regionalPolicies[farmer.region];

        // Query oracle for the farmer's region
        (uint256 rainfall, uint256 temperature, ) = oracle.getWeatherData(farmer.region);

        bool triggerClaim = false;
        string memory reason;

        if (rainfall < policy.rainfallThreshold) {
            triggerClaim = true;
            reason = "Drought";
        } else if (temperature > policy.temperatureThreshold) {
            triggerClaim = true;
            reason = "Extreme heat";
        }

        if (triggerClaim) {
            uint256 claimAmount = farmer.coverageAmount;
            require(address(this).balance >= claimAmount, "Insufficient funds");

            farmer.claimPaid = claimAmount;
            farmer.active = false;
            totalClaims += claimAmount;

            payable(_farmer).transfer(claimAmount);
            emit ClaimPaid(_farmer, claimAmount, reason);
        }
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
            bool active
        )
    {
        Farmer memory f = farmers[_farmer];
        return (f.isRegistered, f.region, f.premiumPaid, f.coverageAmount, f.claimPaid, f.active);
    }

    function getFarmerCount() public view returns (uint256) {
        return farmerCount;
    }

    // Allow contract to receive funds (extra capital injection)
    receive() external payable {}
}
