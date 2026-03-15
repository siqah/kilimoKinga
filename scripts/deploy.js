const hre = require("hardhat");
const ethers = hre.ethers;

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  🌾  KilimoKinga - Deploying Contracts");
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  Deployer:", deployer.address);
  console.log("");

  // 1. Deploy MockWeatherOracle
  const MockOracle = await ethers.getContractFactory("MockWeatherOracle");
  const oracle = await MockOracle.deploy();
  await oracle.waitForDeployment();
  console.log("  ✅ MockWeatherOracle deployed to:", oracle.target);

  // 2. Deploy FarmerInsurance
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

  // ── Configure sample policies ────────────────────────────────────
  console.log("\n  📋 Configuring regional policies...\n");

  await insurance.setPolicy(
    "Laikipia",
    50,   // rainfall threshold (mm)
    35,   // temperature threshold (°C)
    ethers.parseEther("0.01"),  // premium: 0.01 ETH
    2     // 2× payout multiplier
  );
  console.log("  ✅ Laikipia  – 50mm rain / 35°C heat / 0.01 ETH premium / 2× payout");

  await insurance.setPolicy(
    "Nakuru",
    45,
    37,
    ethers.parseEther("0.015"),
    3
  );
  console.log("  ✅ Nakuru    – 45mm rain / 37°C heat / 0.015 ETH premium / 3× payout");

  await insurance.setPolicy(
    "Turkana",
    30,
    40,
    ethers.parseEther("0.008"),
    2
  );
  console.log("  ✅ Turkana   – 30mm rain / 40°C heat / 0.008 ETH premium / 2× payout");

  // Set initial weather data in oracle
  await oracle.setWeatherData("Laikipia", 80, 28, 7000);
  await oracle.setWeatherData("Nakuru", 60, 30, 6500);
  await oracle.setWeatherData("Turkana", 25, 38, 4000);

  console.log("\n  🌦️  Weather data seeded for 3 regions");

  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("  🎉  Deployment Complete!");
  console.log("═══════════════════════════════════════════════════════════");
  console.log("\n  Contract Addresses:");
  console.log("  ─────────────────────────────────────────────");
  console.log("  MockWeatherOracle:", oracle.target);
  console.log("  FarmerInsurance:  ", insurance.target);
  console.log("  MockUSDC:        ", usdc.target);
  console.log("  InsurancePool:   ", pool.target);
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
