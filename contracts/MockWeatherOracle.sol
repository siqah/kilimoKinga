// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title MockWeatherOracle
 * @notice Test/development oracle where admin manually sets weather data.
 *         Implements the IWeatherOracle interface used by FarmerInsurance.
 */
contract MockWeatherOracle {
    struct WeatherData {
        uint256 rainfall;     // mm
        uint256 temperature;  // °C
        uint256 ndvi;         // Normalized Difference Vegetation Index (0-10000 = 0-1.0)
        uint256 timestamp;
        bool valid;
    }

    address public admin;
    mapping(string => WeatherData) public regionalWeather;

    event WeatherDataUpdated(string region, uint256 rainfall, uint256 temperature, uint256 ndvi);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin");
        _;
    }

    constructor() {
        admin = msg.sender;
    }

    /**
     * @notice Admin sets weather data for a region (simulates oracle feed)
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
     * @notice Returns weather data for a region
     * @dev    Implements IWeatherOracle interface
     */
    function getWeatherData(
        string calldata _region
    ) external view returns (uint256 rainfall, uint256 temperature, uint256 timestamp) {
        WeatherData memory data = regionalWeather[_region];
        require(data.valid, "No data for region");

        return (data.rainfall, data.temperature, data.timestamp);
    }

    /**
     * @notice Returns NDVI (vegetation index) for a region
     * @dev    Used by FarmerInsurance for crop damage claims
     */
    function getNDVI(
        string calldata _region
    ) external view returns (uint256 ndvi) {
        WeatherData memory data = regionalWeather[_region];
        require(data.valid, "No data for region");
        return data.ndvi;
    }
}
