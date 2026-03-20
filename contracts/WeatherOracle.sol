// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title WeatherOracle (Production-Ready with Chainlink Scaffold)
 * @notice Oracle for fetching weather data per region.
 *         Includes Chainlink-ready architecture with request/fulfill pattern,
 *         admin fallback for manual data injection, and staleness checks.
 *
 * @dev When deploying to mainnet/testnet with Chainlink:
 *      1. npm install @chainlink/contracts
 *      2. Inherit ChainlinkClient instead of using the local interface
 *      3. Replace requestWeatherData() with buildChainlinkRequest()
 *      4. The fulfill callback pattern is already implemented
 */

// ── Custom Errors ────────────────────────────────────────────────────────
error DataTooOld(string region, uint256 age);
error NoDataForRegion(string region);
error OnlyAdmin();
error InvalidConfig();

contract WeatherOracle {
    // ── Structs ──────────────────────────────────────────────────────────
    struct WeatherData {
        uint256 rainfall;     // mm
        uint256 temperature;  // °C
        uint256 ndvi;         // Normalized Difference Vegetation Index (0-10000)
        uint256 timestamp;
        bool valid;
    }

    // ── State ────────────────────────────────────────────────────────────
    address public admin;
    mapping(string => WeatherData) public regionalWeather;
    mapping(bytes32 => string) public requestToRegion;

    // Chainlink config (set when integrating with Chainlink nodes)
    address public oracleNode;
    bytes32 public jobId;
    uint256 public oracleFee;
    uint256 public constant MAX_DATA_AGE = 7 days;
    uint256 private requestNonce;

    // ── Events ───────────────────────────────────────────────────────────
    event WeatherDataUpdated(string region, uint256 rainfall, uint256 temperature, uint256 ndvi);
    event DataRequested(bytes32 indexed requestId, string region);
    event OracleConfigUpdated(address oracle, bytes32 jobId, uint256 fee);

    // ── Modifiers ────────────────────────────────────────────────────────
    modifier onlyAdmin() {
        if (msg.sender != admin) revert OnlyAdmin();
        _;
    }

    modifier onlyOracle() {
        require(msg.sender == oracleNode || msg.sender == admin, "Not authorized");
        _;
    }

    // ── Constructor ──────────────────────────────────────────────────────
    constructor() {
        admin = msg.sender;
    }

    // ── Request weather data (Chainlink-ready pattern) ───────────────────
    /**
     * @notice Initiates a weather data request. In production with Chainlink,
     *         this would send an on-chain request to a Chainlink oracle node.
     *         Currently emits an event that an off-chain service can listen to.
     */
    function requestWeatherData(
        string calldata _region
    ) external onlyAdmin returns (bytes32 requestId) {
        requestNonce++;
        requestId = keccak256(abi.encodePacked(block.timestamp, _region, requestNonce));
        requestToRegion[requestId] = _region;
        emit DataRequested(requestId, _region);
    }

    /**
     * @notice Callback to fulfill a weather data request.
     *         Called by the oracle node (or admin as fallback).
     */
    function fulfillWeatherData(
        bytes32 _requestId,
        uint256 _rainfall,
        uint256 _temperature,
        uint256 _ndvi
    ) external onlyOracle {
        string memory region = requestToRegion[_requestId];
        require(bytes(region).length > 0, "Unknown request");

        regionalWeather[region] = WeatherData({
            rainfall: _rainfall,
            temperature: _temperature,
            ndvi: _ndvi,
            timestamp: block.timestamp,
            valid: true
        });

        emit WeatherDataUpdated(region, _rainfall, _temperature, _ndvi);
    }

    // ── Admin: Manual data injection (fallback) ──────────────────────────
    function setWeatherData(
        string calldata _region,
        uint256 _rainfall,
        uint256 _temperature,
        uint256 _ndvi
    ) external onlyAdmin {
        regionalWeather[_region] = WeatherData({
            rainfall: _rainfall,
            temperature: _temperature,
            ndvi: _ndvi,
            timestamp: block.timestamp,
            valid: true
        });

        emit WeatherDataUpdated(_region, _rainfall, _temperature, _ndvi);
    }

    // ── Admin: Update oracle configuration ───────────────────────────────
    function setOracleConfig(
        address _oracle,
        bytes32 _jobId,
        uint256 _fee
    ) external onlyAdmin {
        oracleNode = _oracle;
        jobId = _jobId;
        oracleFee = _fee;
        emit OracleConfigUpdated(_oracle, _jobId, _fee);
    }

    // ── IWeatherOracle Interface ─────────────────────────────────────────
    function getWeatherData(
        string calldata _region
    ) external view returns (uint256 rainfall, uint256 temperature, uint256 timestamp) {
        WeatherData memory data = regionalWeather[_region];
        if (!data.valid) revert NoDataForRegion(_region);
        if (block.timestamp - data.timestamp > MAX_DATA_AGE) revert DataTooOld(_region, block.timestamp - data.timestamp);

        return (data.rainfall, data.temperature, data.timestamp);
    }

    function getNDVI(
        string calldata _region
    ) external view returns (uint256 ndvi) {
        WeatherData memory data = regionalWeather[_region];
        if (!data.valid) revert NoDataForRegion(_region);
        return data.ndvi;
    }
}
