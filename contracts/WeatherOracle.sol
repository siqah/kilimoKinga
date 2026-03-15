// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title WeatherOracle (Production Scaffold)
 * @notice Chainlink-based oracle for fetching real weather data per region.
 * @dev    This contract requires a Chainlink node, LINK tokens, and a configured
 *         oracle job. For local development, use MockWeatherOracle instead.
 *
 * NOTE: This is a scaffold for production integration. It compiles but requires
 *       actual Chainlink infrastructure to function. All testing uses MockWeatherOracle.
 */

interface IChainlinkOracle {
    // Placeholder – full Chainlink integration requires ChainlinkClient inheritance
}

contract WeatherOracle {
    struct WeatherData {
        uint256 rainfall;
        uint256 temperature;
        uint256 ndvi;         // Normalized Difference Vegetation Index
        uint256 timestamp;
        bool valid;
    }

    address public admin;
    mapping(string => WeatherData) public regionalWeather;
    mapping(bytes32 => string) public requestToRegion;

    event WeatherDataUpdated(string region, uint256 rainfall, uint256 temperature, uint256 ndvi);
    event DataRequested(bytes32 requestId, string region);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin");
        _;
    }

    constructor() {
        admin = msg.sender;
    }

    /**
     * @notice Manual data feed (fallback until Chainlink is configured)
     */
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

    /**
     * @notice Get latest weather data for a region
     * @dev    Implements IWeatherOracle interface
     */
    function getWeatherData(
        string calldata _region
    ) external view returns (uint256 rainfall, uint256 temperature, uint256 timestamp) {
        WeatherData memory data = regionalWeather[_region];
        require(data.valid, "No data for region");
        require(block.timestamp - data.timestamp < 7 days, "Data too old");

        return (data.rainfall, data.temperature, data.timestamp);
    }
}
