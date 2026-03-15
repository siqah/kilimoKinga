const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("FarmerInsurance", function () {
  // ── Fixture: deploy contracts + set up a sample policy ─────────────
  async function deployInsuranceFixture() {
    const [admin, farmer1, farmer2, outsider] = await ethers.getSigners();

    // Deploy mock oracle
    const MockOracle = await ethers.getContractFactory("MockWeatherOracle");
    const oracle = await MockOracle.deploy();

    // Deploy insurance contract
    const FarmerInsurance = await ethers.getContractFactory("FarmerInsurance");
    const insurance = await FarmerInsurance.deploy(oracle.target);

    // Set up a policy for "Laikipia" region
    const premiumAmount = ethers.parseEther("0.01");
    await insurance.setPolicy(
      "Laikipia",
      50,   // rainfall threshold (mm) – below triggers drought
      35,   // temperature threshold (°C) – above triggers heat
      premiumAmount,
      2     // 2× payout multiplier
    );

    // Fund the contract so it can pay claims
    await admin.sendTransaction({
      to: insurance.target,
      value: ethers.parseEther("1"),
    });

    // Set normal weather in oracle
    await oracle.setWeatherData("Laikipia", 80, 28, 7000);

    return { insurance, oracle, admin, farmer1, farmer2, outsider, premiumAmount };
  }

  // ── Policy Management ──────────────────────────────────────────────
  describe("Policy Management", function () {
    it("should allow admin to set a regional policy", async function () {
      const { insurance } = await loadFixture(deployInsuranceFixture);
      const policy = await insurance.regionalPolicies("Laikipia");

      expect(policy.rainfallThreshold).to.equal(50);
      expect(policy.temperatureThreshold).to.equal(35);
      expect(policy.payoutMultiplier).to.equal(2);
    });

    it("should emit PolicyUpdated event", async function () {
      const { insurance, premiumAmount } = await loadFixture(deployInsuranceFixture);

      await expect(
        insurance.setPolicy("Nakuru", 40, 38, premiumAmount, 3)
      )
        .to.emit(insurance, "PolicyUpdated")
        .withArgs("Nakuru", 40, 38);
    });

    it("should reject setPolicy from non-admin", async function () {
      const { insurance, farmer1, premiumAmount } = await loadFixture(deployInsuranceFixture);

      await expect(
        insurance.connect(farmer1).setPolicy("Nakuru", 40, 38, premiumAmount, 3)
      ).to.be.revertedWith("Only admin");
    });
  });

  // ── Farmer Registration ────────────────────────────────────────────
  describe("Farmer Registration", function () {
    it("should register a farmer with correct premium", async function () {
      const { insurance, farmer1, premiumAmount } = await loadFixture(deployInsuranceFixture);

      await expect(
        insurance.connect(farmer1).register("Laikipia", { value: premiumAmount })
      )
        .to.emit(insurance, "FarmerRegistered")
        .withArgs(farmer1.address, "Laikipia", premiumAmount);

      const farmer = await insurance.farmers(farmer1.address);
      expect(farmer.isRegistered).to.be.true;
      expect(farmer.active).to.be.true;
      expect(farmer.premiumPaid).to.equal(premiumAmount);
      expect(farmer.coverageAmount).to.equal(premiumAmount * 2n);
    });

    it("should reject registration for unsupported region", async function () {
      const { insurance, farmer1 } = await loadFixture(deployInsuranceFixture);

      await expect(
        insurance.connect(farmer1).register("UnknownRegion", { value: ethers.parseEther("0.01") })
      ).to.be.revertedWith("Region not supported");
    });

    it("should reject registration with insufficient premium", async function () {
      const { insurance, farmer1 } = await loadFixture(deployInsuranceFixture);

      await expect(
        insurance.connect(farmer1).register("Laikipia", { value: ethers.parseEther("0.005") })
      ).to.be.revertedWith("Insufficient premium");
    });

    it("should reject double registration", async function () {
      const { insurance, farmer1, premiumAmount } = await loadFixture(deployInsuranceFixture);

      await insurance.connect(farmer1).register("Laikipia", { value: premiumAmount });

      await expect(
        insurance.connect(farmer1).register("Laikipia", { value: premiumAmount })
      ).to.be.revertedWith("Already registered");
    });

    it("should refund excess premium payment", async function () {
      const { insurance, farmer1, premiumAmount } = await loadFixture(deployInsuranceFixture);

      const overpayment = ethers.parseEther("0.05");
      const balanceBefore = await ethers.provider.getBalance(farmer1.address);

      const tx = await insurance.connect(farmer1).register("Laikipia", { value: overpayment });
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed * receipt.gasPrice;

      const balanceAfter = await ethers.provider.getBalance(farmer1.address);
      // Farmer should only have paid premiumAmount + gas (excess refunded)
      const spent = balanceBefore - balanceAfter;
      expect(spent).to.be.closeTo(premiumAmount + gasCost, ethers.parseEther("0.001"));
    });

    it("should increment farmerCount", async function () {
      const { insurance, farmer1, farmer2, premiumAmount } = await loadFixture(deployInsuranceFixture);

      await insurance.connect(farmer1).register("Laikipia", { value: premiumAmount });
      expect(await insurance.farmerCount()).to.equal(1);

      await insurance.connect(farmer2).register("Laikipia", { value: premiumAmount });
      expect(await insurance.farmerCount()).to.equal(2);
    });
  });

  // ── Claims ─────────────────────────────────────────────────────────
  describe("Claims", function () {
    it("should pay claim on drought condition (low rainfall)", async function () {
      const { insurance, oracle, farmer1, premiumAmount } = await loadFixture(deployInsuranceFixture);

      // Register farmer
      await insurance.connect(farmer1).register("Laikipia", { value: premiumAmount });

      // Set drought weather data (rainfall below threshold of 50)
      await oracle.setWeatherData("Laikipia", 30, 28, 3000);

      const balanceBefore = await ethers.provider.getBalance(farmer1.address);

      await expect(insurance.checkAndPayClaim(farmer1.address))
        .to.emit(insurance, "ClaimPaid")
        .withArgs(farmer1.address, premiumAmount * 2n, "Drought");

      const balanceAfter = await ethers.provider.getBalance(farmer1.address);
      expect(balanceAfter - balanceBefore).to.equal(premiumAmount * 2n);
    });

    it("should pay claim on extreme heat condition", async function () {
      const { insurance, oracle, farmer1, premiumAmount } = await loadFixture(deployInsuranceFixture);

      await insurance.connect(farmer1).register("Laikipia", { value: premiumAmount });

      // Set extreme heat weather (temperature above threshold of 35)
      await oracle.setWeatherData("Laikipia", 80, 42, 5000);

      await expect(insurance.checkAndPayClaim(farmer1.address))
        .to.emit(insurance, "ClaimPaid")
        .withArgs(farmer1.address, premiumAmount * 2n, "Extreme heat");
    });

    it("should NOT pay claim when weather is normal", async function () {
      const { insurance, oracle, farmer1, premiumAmount } = await loadFixture(deployInsuranceFixture);

      await insurance.connect(farmer1).register("Laikipia", { value: premiumAmount });

      // Normal weather (within thresholds)
      await oracle.setWeatherData("Laikipia", 80, 28, 7000);

      // Should not emit ClaimPaid
      await expect(insurance.checkAndPayClaim(farmer1.address))
        .to.not.emit(insurance, "ClaimPaid");

      const farmer = await insurance.farmers(farmer1.address);
      expect(farmer.active).to.be.true;
      expect(farmer.claimPaid).to.equal(0);
    });

    it("should prevent double claims", async function () {
      const { insurance, oracle, farmer1, premiumAmount } = await loadFixture(deployInsuranceFixture);

      await insurance.connect(farmer1).register("Laikipia", { value: premiumAmount });
      await oracle.setWeatherData("Laikipia", 30, 28, 3000);

      // First claim succeeds
      await insurance.checkAndPayClaim(farmer1.address);

      // Second claim should fail
      await expect(
        insurance.checkAndPayClaim(farmer1.address)
      ).to.be.revertedWith("Farmer not active");
    });

    it("should reject claim check from non-admin", async function () {
      const { insurance, farmer1, premiumAmount } = await loadFixture(deployInsuranceFixture);

      await insurance.connect(farmer1).register("Laikipia", { value: premiumAmount });

      await expect(
        insurance.connect(farmer1).checkAndPayClaim(farmer1.address)
      ).to.be.revertedWith("Only admin");
    });
  });

  // ── Views ──────────────────────────────────────────────────────────
  describe("View Functions", function () {
    it("should return correct contract balance", async function () {
      const { insurance } = await loadFixture(deployInsuranceFixture);
      const balance = await insurance.getContractBalance();
      expect(balance).to.equal(ethers.parseEther("1"));
    });

    it("should return farmer details", async function () {
      const { insurance, farmer1, premiumAmount } = await loadFixture(deployInsuranceFixture);

      await insurance.connect(farmer1).register("Laikipia", { value: premiumAmount });

      const details = await insurance.getFarmerDetails(farmer1.address);
      expect(details.isRegistered).to.be.true;
      expect(details.region).to.equal("Laikipia");
      expect(details.premiumPaid).to.equal(premiumAmount);
    });
  });
});
