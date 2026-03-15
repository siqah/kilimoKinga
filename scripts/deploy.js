const hre = require("hardhat");
const ethers = hre.ethers;

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  🌾  KilimoKinga v2 - Deploying Enhanced Contracts");
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  Deployer:", deployer.address);
  console.log("");

  // 1. Deploy MockWeatherOracle
  const MockOracle = await ethers.getContractFactory("MockWeatherOracle");
  const oracle = await MockOracle.deploy();
  await oracle.waitForDeployment();
  console.log("  ✅ MockWeatherOracle deployed to:", oracle.target);

  // 2. Deploy FarmerInsurance (Enhanced v2)
  const FarmerInsurance = await ethers.getContractFactory("FarmerInsurance");
  const insurance = await FarmerInsurance.deploy(oracle.target);
  await insurance.waitForDeployment();
  console.log("  ✅ FarmerInsurance  deployed to:", insurance.target);

  // 3. Deploy MockUSDC
  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const usdc = await MockUSDC.deploy();
  await usdc.waitForDeployment();
  console.log("  ✅ MockUSDC         deployed to:", usdc.target);

  // 4. Deploy InsurancePool
  const InsurancePool = await ethers.getContractFactory("InsurancePool");
  const pool = await InsurancePool.deploy(usdc.target, insurance.target);
  await pool.waitForDeployment();
  console.log("  ✅ InsurancePool    deployed to:", pool.target);

  // 5. Deploy MpesaBridge
  const MpesaBridge = await ethers.getContractFactory("MpesaBridge");
  const bridge = await MpesaBridge.deploy(insurance.target, deployer.address);
  await bridge.waitForDeployment();
  console.log("  ✅ MpesaBridge      deployed to:", bridge.target);

  // Fund MpesaBridge for premium payments
  await deployer.sendTransaction({
    to: bridge.target,
    value: ethers.parseEther("1"),
  });

  // ── Configure enhanced policies ──────────────────────────────────
  const SEASON_90_DAYS = 90 * 24 * 60 * 60;

  console.log("\n  📋 Configuring enhanced regional policies...\n");

  // setPolicy(region, rainfall, temp, ndvi, premium, multiplier, seasonDuration, partialPayout%, severeThreshold%)
  await insurance.setPolicy(
    "Laikipia",
    50, 35, 5000,
    ethers.parseEther("0.01"),
    2, SEASON_90_DAYS, 50, 30
  );
  console.log("  ✅ Laikipia  – 50mm/35°C/NDVI 5000 | 0.01 ETH | 2× | 50% partial | 30% severe");

  await insurance.setPolicy(
    "Nakuru",
    45, 37, 4500,
    ethers.parseEther("0.015"),
    3, SEASON_90_DAYS, 50, 30
  );
  console.log("  ✅ Nakuru    – 45mm/37°C/NDVI 4500 | 0.015 ETH | 3× | 50% partial | 30% severe");

  await insurance.setPolicy(
    "Turkana",
    30, 40, 3500,
    ethers.parseEther("0.008"),
    2, SEASON_90_DAYS, 50, 30
  );
  console.log("  ✅ Turkana   – 30mm/40°C/NDVI 3500 | 0.008 ETH | 2× | 50% partial | 30% severe");

  // Seed weather data
  await oracle.setWeatherData("Laikipia", 80, 28, 7000);
  await oracle.setWeatherData("Nakuru", 60, 30, 6500);
  await oracle.setWeatherData("Turkana", 25, 38, 4000);

  console.log("\n  🌦️  Weather data seeded (incl. NDVI) for 3 regions");

  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("  🎉  Deployment Complete! (Enhanced v2 + M-Pesa Bridge)");
  console.log("═══════════════════════════════════════════════════════════");
  console.log("\n  Contract Addresses:");
  console.log("  ─────────────────────────────────────────────");
  console.log("  MockWeatherOracle:", oracle.target);
  console.log("  FarmerInsurance:  ", insurance.target);
  console.log("  MockUSDC:        ", usdc.target);
  console.log("  InsurancePool:   ", pool.target);
  console.log("  MpesaBridge:     ", bridge.target);
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
