const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

  // ── 1. Deploy MockUSDC ──────────────────────────────────────────────
  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const usdc = await MockUSDC.deploy();
  await usdc.waitForDeployment();
  console.log("MockUSDC:", await usdc.getAddress());

  // ── 2. Deploy MockWeatherOracle (for local testing) ─────────────────
  const MockOracle = await ethers.getContractFactory("MockWeatherOracle");
  const oracle = await MockOracle.deploy();
  await oracle.waitForDeployment();
  console.log("MockWeatherOracle:", await oracle.getAddress());

  // ── 3. Deploy FarmerInsurance ───────────────────────────────────────
  const FarmerInsurance = await ethers.getContractFactory("FarmerInsurance");
  const insurance = await FarmerInsurance.deploy(await oracle.getAddress());
  await insurance.waitForDeployment();
  console.log("FarmerInsurance:", await insurance.getAddress());

  // ── 4. Deploy InsurancePool ─────────────────────────────────────────
  const InsurancePool = await ethers.getContractFactory("InsurancePool");
  const pool = await InsurancePool.deploy(
    await usdc.getAddress(),
    await insurance.getAddress()
  );
  await pool.waitForDeployment();
  console.log("InsurancePool:", await pool.getAddress());

  // ── 5. Set default policies ─────────────────────────────────────────
  const regions = ["Laikipia", "Nakuru", "Turkana"];
  const premiums = [
    ethers.parseEther("0.01"),
    ethers.parseEther("0.01"),
    ethers.parseEther("0.01"),
  ];

  for (let i = 0; i < regions.length; i++) {
    const tx = await insurance.setPolicy(
      regions[i],
      50,   // rainfallThreshold mm
      35,   // temperatureThreshold °C
      5000, // ndviThreshold
      premiums[i],
      2,    // payoutMultiplier
      90 * 24 * 60 * 60, // seasonDuration (90 days)
      50,   // partialPayoutPercent
      30    // severeThresholdPercent
    );
    await tx.wait();
    console.log(`Policy set for ${regions[i]}`);
  }

  // ── 6. Set initial weather data ─────────────────────────────────────
  for (const region of regions) {
    const tx = await oracle.setWeatherData(region, 80, 28, 7000);
    await tx.wait();
    console.log(`Weather data set for ${region}`);
  }

  // ── Summary ─────────────────────────────────────────────────────────
  console.log("\n═══════════════════════════════════════════════════");
  console.log("  🌾 KilimoKinga v3 — Deployed");
  console.log("═══════════════════════════════════════════════════");
  console.log("MockUSDC:          ", await usdc.getAddress());
  console.log("MockWeatherOracle: ", await oracle.getAddress());
  console.log("FarmerInsurance:   ", await insurance.getAddress());
  console.log("InsurancePool:     ", await pool.getAddress());
  console.log("═══════════════════════════════════════════════════\n");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
