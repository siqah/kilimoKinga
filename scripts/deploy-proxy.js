const { ethers, upgrades } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

  // 1. Deploy MockUSDC
  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const usdc = await MockUSDC.deploy();
  await usdc.waitForDeployment();
  console.log("MockUSDC:", await usdc.getAddress());

  // Mint some USDC for the deployer to use later
  await usdc.mint(deployer.address, ethers.parseUnits("10000", 6));

  // 2. Deploy MockWeatherOracle
  const MockOracle = await ethers.getContractFactory("MockWeatherOracle");
  const oracle = await MockOracle.deploy();
  await oracle.waitForDeployment();
  console.log("MockWeatherOracle:", await oracle.getAddress());

  // 3. Deploy InsurancePool Proxy
  const InsurancePool = await ethers.getContractFactory("InsurancePool");
  const pool = await upgrades.deployProxy(InsurancePool, [await usdc.getAddress(), ethers.ZeroAddress], { kind: "uups" });
  await pool.waitForDeployment();
  console.log("InsurancePool Proxy:", await pool.getAddress());

  // 4. Deploy FarmerInsurance Proxy
  const FarmerInsurance = await ethers.getContractFactory("FarmerInsurance");
  const insurance = await upgrades.deployProxy(FarmerInsurance, [await oracle.getAddress(), await usdc.getAddress(), await pool.getAddress()], { kind: "uups" });
  await insurance.waitForDeployment();
  console.log("FarmerInsurance Proxy:", await insurance.getAddress());

  // Link Pool to Insurance
  await pool.setInsuranceContract(await insurance.getAddress());

  // 5. Deploy MpesaBridge Proxy
  const MpesaBridge = await ethers.getContractFactory("MpesaBridge");
  const bridge = await upgrades.deployProxy(MpesaBridge, [await insurance.getAddress(), deployer.address, await usdc.getAddress()], { kind: "uups" });
  await bridge.waitForDeployment();
  console.log("MpesaBridge Proxy:", await bridge.getAddress());

  // 6. Set Policies
  const regions = ["Laikipia", "Nakuru", "Turkana"];
  const premiums = [
    ethers.parseUnits("10", 6), // 10 USDC
    ethers.parseUnits("15", 6), // 15 USDC
    ethers.parseUnits("8", 6),  // 8 USDC
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

  // 7. Set initial weather data
  for (const region of regions) {
    const tx = await oracle.setWeatherData(region, 80, 28, 7000);
    await tx.wait();
    console.log(`Weather data set for ${region}`);
  }

  // Summary
  console.log("\n═══════════════════════════════════════════════════");
  console.log("  🌾 KilimoKinga v3 — Deployed (UUPS + USDC)");
  console.log("═══════════════════════════════════════════════════");
  console.log("MockUSDC:          ", await usdc.getAddress());
  console.log("MockWeatherOracle: ", await oracle.getAddress());
  console.log("FarmerInsurance:   ", await insurance.getAddress());
  console.log("InsurancePool:     ", await pool.getAddress());
  console.log("MpesaBridge:       ", await bridge.getAddress());
  console.log("═══════════════════════════════════════════════════\n");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
