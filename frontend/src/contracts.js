// Contract addresses — update these after deployment
export const ADDRESSES = {
  FarmerInsurance: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
  MockWeatherOracle: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
  MockUSDC: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
  InsurancePool: '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9',
};

// Minimal ABIs — Enhanced v2
export const FARMER_INSURANCE_ABI = [
  "function admin() view returns (address)",
  "function totalPremiums() view returns (uint256)",
  "function totalClaims() view returns (uint256)",
  "function farmerCount() view returns (uint256)",
  "function currentSeason() view returns (uint256)",
  "function getContractBalance() view returns (uint256)",
  "function getFarmerDetails(address) view returns (bool isRegistered, string region, uint256 premiumPaid, uint256 coverageAmount, uint256 claimPaid, bool active, uint256 seasonsCompleted, uint256 loyaltyDiscount)",
  "function getLoyaltyDiscount(address) view returns (uint256 discountPercent, uint256 seasonsCompleted)",
  "function regionalPolicies(string) view returns (uint256 rainfallThreshold, uint256 temperatureThreshold, uint256 ndviThreshold, uint256 payoutMultiplier, uint256 premiumAmount, uint256 seasonDuration, uint256 partialPayoutPercent, uint256 severeThresholdPercent)",
  "function register(string region) payable",
  "function endSeason()",
  "function setPolicy(string region, uint256 rainfallThreshold, uint256 temperatureThreshold, uint256 ndviThreshold, uint256 premiumAmount, uint256 payoutMultiplier, uint256 seasonDuration, uint256 partialPayoutPercent, uint256 severeThresholdPercent)",
  "function checkAndPayClaim(address farmer)",
  "function advanceSeason()",
  "function LOYALTY_DISCOUNT_PER_SEASON() view returns (uint256)",
  "function MAX_LOYALTY_DISCOUNT() view returns (uint256)",
  "function LOYALTY_BONUS_SEASONS() view returns (uint256)",
  "event FarmerRegistered(address indexed farmer, string region, uint256 premium, uint256 season)",
  "event ClaimPaid(address indexed farmer, uint256 amount, string reason, uint256 severity)",
  "event PolicyUpdated(string region, uint256 rainfallThreshold, uint256 temperatureThreshold, uint256 ndviThreshold)",
  "event SeasonRenewed(address indexed farmer, uint256 season, uint256 discountApplied)",
  "event NewSeasonStarted(uint256 season)",
];

export const INSURANCE_POOL_ABI = [
  "function totalStaked() view returns (uint256)",
  "function totalClaimsPaid() view returns (uint256)",
  "function rewardRate() view returns (uint256)",
  "function getPoolHealth() view returns (uint256 staked, uint256 available)",
  "function getStakerCount() view returns (uint256)",
  "function calculateReward(address) view returns (uint256)",
  "function stakers(address) view returns (uint256 amount, uint256 startTime, uint256 lastReward, bool active)",
  "function stake(uint256 amount)",
  "function unstake()",
  "event Staked(address indexed investor, uint256 amount)",
  "event Unstaked(address indexed investor, uint256 amount, uint256 reward)",
];

export const MOCK_ORACLE_ABI = [
  "function getWeatherData(string region) view returns (uint256 rainfall, uint256 temperature, uint256 timestamp)",
  "function getNDVI(string region) view returns (uint256 ndvi)",
  "function setWeatherData(string region, uint256 rainfall, uint256 temperature, uint256 ndvi)",
  "function regionalWeather(string) view returns (uint256 rainfall, uint256 temperature, uint256 ndvi, uint256 timestamp, bool valid)",
];

export const MOCK_USDC_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function mint(address to, uint256 amount)",
  "function decimals() view returns (uint8)",
];
