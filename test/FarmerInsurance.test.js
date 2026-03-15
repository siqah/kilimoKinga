const { expect } = require("chai");
const { ethers } = require("hardhat");
const {
  loadFixture,
  time,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("FarmerInsurance (Enhanced v2)", function () {
  // ── Fixture ────────────────────────────────────────────────────────
  async function deployInsuranceFixture() {
    const [admin, farmer1, farmer2, outsider] = await ethers.getSigners();

    const MockOracle = await ethers.getContractFactory("MockWeatherOracle");
    const oracle = await MockOracle.deploy();

    const FarmerInsurance = await ethers.getContractFactory("FarmerInsurance");
    const insurance = await FarmerInsurance.deploy(oracle.target);

    const premiumAmount = ethers.parseEther("0.01");
    const seasonDuration = 90 * 24 * 60 * 60; // 90 days

    // Enhanced setPolicy: region, rainfall, temp, ndvi, premium, multiplier, seasonDuration, partialPayout%, severeThreshold%
    await insurance.setPolicy(
      "Laikipia",
      50,    // rainfall threshold mm
      35,    // temperature threshold °C
      5000,  // NDVI threshold (below = crop damage)
      premiumAmount,
      2,     // 2× payout multiplier
      seasonDuration,
      50,    // 50% partial payout for moderate events
      30     // 30% deviation = severe
    );

    // Fund the contract
    await admin.sendTransaction({
      to: insurance.target,
      value: ethers.parseEther("2"),
    });

    // Set normal weather
    await oracle.setWeatherData("Laikipia", 80, 28, 7000);

    return { insurance, oracle, admin, farmer1, farmer2, outsider, premiumAmount, seasonDuration };
  }

  // ── Policy Management ──────────────────────────────────────────────
  describe("Policy Management", function () {
    it("should set policy with NDVI threshold and tiered payout params", async function () {
      const { insurance } = await loadFixture(deployInsuranceFixture);
      const policy = await insurance.regionalPolicies("Laikipia");

      expect(policy.rainfallThreshold).to.equal(50);
      expect(policy.temperatureThreshold).to.equal(35);
      expect(policy.ndviThreshold).to.equal(5000);
      expect(policy.partialPayoutPercent).to.equal(50);
      expect(policy.severeThresholdPercent).to.equal(30);
    });

    it("should emit PolicyUpdated with NDVI", async function () {
      const { insurance, premiumAmount } = await loadFixture(deployInsuranceFixture);
      await expect(
        insurance.setPolicy("Nakuru", 40, 38, 4500, premiumAmount, 3, 86400, 50, 30)
      )
        .to.emit(insurance, "PolicyUpdated")
        .withArgs("Nakuru", 40, 38, 4500);
    });

    it("should reject setPolicy from non-admin", async function () {
      const { insurance, farmer1, premiumAmount } = await loadFixture(deployInsuranceFixture);
      await expect(
        insurance.connect(farmer1).setPolicy("Nakuru", 40, 38, 4500, premiumAmount, 3, 86400, 50, 30)
      ).to.be.revertedWith("Only admin");
    });
  });

  // ── Registration ───────────────────────────────────────────────────
  describe("Farmer Registration", function () {
    it("should register a farmer for a season", async function () {
      const { insurance, farmer1, premiumAmount } = await loadFixture(deployInsuranceFixture);

      await expect(
        insurance.connect(farmer1).register("Laikipia", { value: premiumAmount })
      ).to.emit(insurance, "FarmerRegistered");

      const farmer = await insurance.farmers(farmer1.address);
      expect(farmer.isRegistered).to.be.true;
      expect(farmer.active).to.be.true;
      expect(farmer.coverageAmount).to.equal(premiumAmount * 2n);
      expect(farmer.seasonsCompleted).to.equal(0);
    });

    it("should reject registration while already active", async function () {
      const { insurance, farmer1, premiumAmount } = await loadFixture(deployInsuranceFixture);
      await insurance.connect(farmer1).register("Laikipia", { value: premiumAmount });

      await expect(
        insurance.connect(farmer1).register("Laikipia", { value: premiumAmount })
      ).to.be.revertedWith("Already active this season");
    });

    it("should refund excess premium", async function () {
      const { insurance, farmer1, premiumAmount } = await loadFixture(deployInsuranceFixture);
      const overpayment = ethers.parseEther("0.05");
      const balBefore = await ethers.provider.getBalance(farmer1.address);

      const tx = await insurance.connect(farmer1).register("Laikipia", { value: overpayment });
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed * receipt.gasPrice;

      const balAfter = await ethers.provider.getBalance(farmer1.address);
      const spent = balBefore - balAfter;
      expect(spent).to.be.closeTo(premiumAmount + gasCost, ethers.parseEther("0.001"));
    });
  });

  // ── Multi-Season ──────────────────────────────────────────────────
  describe("Multi-Season Policies", function () {
    it("should allow re-registration after season ends", async function () {
      const { insurance, farmer1, premiumAmount, seasonDuration } =
        await loadFixture(deployInsuranceFixture);

      // Season 1
      await insurance.connect(farmer1).register("Laikipia", { value: premiumAmount });
      await time.increase(seasonDuration + 1);
      await insurance.connect(farmer1).endSeason();

      const farmerAfterS1 = await insurance.farmers(farmer1.address);
      expect(farmerAfterS1.active).to.be.false;
      expect(farmerAfterS1.seasonsCompleted).to.equal(1);

      // Season 2 — re-register
      await insurance.connect(farmer1).register("Laikipia", { value: premiumAmount });
      const farmerS2 = await insurance.farmers(farmer1.address);
      expect(farmerS2.active).to.be.true;
    });

    it("should reject endSeason before duration is over", async function () {
      const { insurance, farmer1, premiumAmount } = await loadFixture(deployInsuranceFixture);
      await insurance.connect(farmer1).register("Laikipia", { value: premiumAmount });

      await expect(
        insurance.connect(farmer1).endSeason()
      ).to.be.revertedWith("Season not ended yet");
    });

    it("should not double-count farmers on re-registration", async function () {
      const { insurance, farmer1, premiumAmount, seasonDuration } =
        await loadFixture(deployInsuranceFixture);

      await insurance.connect(farmer1).register("Laikipia", { value: premiumAmount });
      expect(await insurance.farmerCount()).to.equal(1);

      await time.increase(seasonDuration + 1);
      await insurance.connect(farmer1).endSeason();
      await insurance.connect(farmer1).register("Laikipia", { value: premiumAmount });

      // Still 1 unique farmer
      expect(await insurance.farmerCount()).to.equal(1);
    });
  });

  // ── Tiered Payouts ─────────────────────────────────────────────────
  describe("Tiered Payouts", function () {
    it("should pay PARTIAL payout for moderate drought", async function () {
      const { insurance, oracle, farmer1, premiumAmount } =
        await loadFixture(deployInsuranceFixture);

      await insurance.connect(farmer1).register("Laikipia", { value: premiumAmount });

      // Moderate drought: 40mm rain (threshold 50, deficit = 20% < 30% severe)
      await oracle.setWeatherData("Laikipia", 40, 28, 7000);

      const balBefore = await ethers.provider.getBalance(farmer1.address);
      await insurance.checkAndPayClaim(farmer1.address);
      const balAfter = await ethers.provider.getBalance(farmer1.address);

      // Partial = 50% of coverage (0.02 ETH * 50% = 0.01 ETH)
      const partialPayout = (premiumAmount * 2n * 50n) / 100n;
      expect(balAfter - balBefore).to.equal(partialPayout);
    });

    it("should pay FULL payout for severe drought", async function () {
      const { insurance, oracle, farmer1, premiumAmount } =
        await loadFixture(deployInsuranceFixture);

      await insurance.connect(farmer1).register("Laikipia", { value: premiumAmount });

      // Severe drought: 20mm rain (threshold 50, deficit = 60% > 30% severe)
      await oracle.setWeatherData("Laikipia", 20, 28, 7000);

      const balBefore = await ethers.provider.getBalance(farmer1.address);

      await expect(insurance.checkAndPayClaim(farmer1.address))
        .to.emit(insurance, "ClaimPaid")
        .withArgs(farmer1.address, premiumAmount * 2n, "Severe drought", 2);

      const balAfter = await ethers.provider.getBalance(farmer1.address);
      expect(balAfter - balBefore).to.equal(premiumAmount * 2n);
    });

    it("should pay PARTIAL payout for moderate heat", async function () {
      const { insurance, oracle, farmer1, premiumAmount } =
        await loadFixture(deployInsuranceFixture);

      await insurance.connect(farmer1).register("Laikipia", { value: premiumAmount });

      // Moderate heat: 40°C (threshold 35, excess ~14% < 30%)
      await oracle.setWeatherData("Laikipia", 80, 40, 7000);

      await expect(insurance.checkAndPayClaim(farmer1.address))
        .to.emit(insurance, "ClaimPaid");

      const farmer = await insurance.farmers(farmer1.address);
      const partialPayout = (premiumAmount * 2n * 50n) / 100n;
      expect(farmer.claimPaid).to.equal(partialPayout);
    });

    it("should NOT pay when weather is normal", async function () {
      const { insurance, oracle, farmer1, premiumAmount } =
        await loadFixture(deployInsuranceFixture);

      await insurance.connect(farmer1).register("Laikipia", { value: premiumAmount });
      await oracle.setWeatherData("Laikipia", 80, 28, 7000);

      await expect(insurance.checkAndPayClaim(farmer1.address))
        .to.not.emit(insurance, "ClaimPaid");

      const farmer = await insurance.farmers(farmer1.address);
      expect(farmer.active).to.be.true;
      expect(farmer.claimPaid).to.equal(0);
    });
  });

  // ── NDVI Claims ────────────────────────────────────────────────────
  describe("NDVI-Based Claims", function () {
    it("should trigger claim on low NDVI (crop damage)", async function () {
      const { insurance, oracle, farmer1, premiumAmount } =
        await loadFixture(deployInsuranceFixture);

      await insurance.connect(farmer1).register("Laikipia", { value: premiumAmount });

      // Normal rain/temp BUT low NDVI (crop damage from satellite)
      // NDVI 2000, threshold 5000, deficit 60% > 30% severe
      await oracle.setWeatherData("Laikipia", 80, 28, 2000);

      await expect(insurance.checkAndPayClaim(farmer1.address))
        .to.emit(insurance, "ClaimPaid")
        .withArgs(farmer1.address, premiumAmount * 2n, "Severe crop damage", 2);
    });

    it("should trigger partial claim on moderate NDVI deficit", async function () {
      const { insurance, oracle, farmer1, premiumAmount } =
        await loadFixture(deployInsuranceFixture);

      await insurance.connect(farmer1).register("Laikipia", { value: premiumAmount });

      // NDVI 4200, threshold 5000, deficit 16% < 30% = moderate
      await oracle.setWeatherData("Laikipia", 80, 28, 4200);

      await expect(insurance.checkAndPayClaim(farmer1.address))
        .to.emit(insurance, "ClaimPaid");

      const farmer = await insurance.farmers(farmer1.address);
      const partialPayout = (premiumAmount * 2n * 50n) / 100n;
      expect(farmer.claimPaid).to.equal(partialPayout);
    });
  });

  // ── Loyalty Discounts ──────────────────────────────────────────────
  describe("Loyalty Discounts", function () {
    it("should give NO discount for first 3 seasons", async function () {
      const { insurance, farmer1, premiumAmount, seasonDuration } =
        await loadFixture(deployInsuranceFixture);

      // Complete 2 seasons
      for (let i = 0; i < 2; i++) {
        await insurance.connect(farmer1).register("Laikipia", { value: premiumAmount });
        await time.increase(seasonDuration + 1);
        await insurance.connect(farmer1).endSeason();
      }

      const [discountPercent] = await insurance.getLoyaltyDiscount(farmer1.address);
      expect(discountPercent).to.equal(0);
    });

    it("should give 5% discount after 3 completed seasons", async function () {
      const { insurance, farmer1, premiumAmount, seasonDuration } =
        await loadFixture(deployInsuranceFixture);

      // Complete 3 seasons
      for (let i = 0; i < 3; i++) {
        await insurance.connect(farmer1).register("Laikipia", { value: premiumAmount });
        await time.increase(seasonDuration + 1);
        await insurance.connect(farmer1).endSeason();
      }

      const [discountPercent, seasons] = await insurance.getLoyaltyDiscount(farmer1.address);
      expect(seasons).to.equal(3);
      expect(discountPercent).to.equal(5);

      // Season 4: verify farmer pays less
      const balBefore = await ethers.provider.getBalance(farmer1.address);
      const discountedPremium = premiumAmount - (premiumAmount * 5n / 100n);

      const tx = await insurance.connect(farmer1).register("Laikipia", { value: premiumAmount });
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed * receipt.gasPrice;

      const balAfter = await ethers.provider.getBalance(farmer1.address);
      const spent = balBefore - balAfter;
      // Should have spent discountedPremium + gas (excess refunded)
      expect(spent).to.be.closeTo(discountedPremium + gasCost, ethers.parseEther("0.0005"));
    });

    it("should cap discount at 25%", async function () {
      const { insurance, farmer1, premiumAmount, seasonDuration } =
        await loadFixture(deployInsuranceFixture);

      // Complete 10 seasons
      for (let i = 0; i < 10; i++) {
        await insurance.connect(farmer1).register("Laikipia", { value: premiumAmount });
        await time.increase(seasonDuration + 1);
        await insurance.connect(farmer1).endSeason();
      }

      const [discountPercent] = await insurance.getLoyaltyDiscount(farmer1.address);
      expect(discountPercent).to.equal(25); // capped
    });

    it("should still earn loyalty after receiving a claim", async function () {
      const { insurance, oracle, farmer1, premiumAmount, seasonDuration } =
        await loadFixture(deployInsuranceFixture);

      // Season 1: register and get a claim
      await insurance.connect(farmer1).register("Laikipia", { value: premiumAmount });
      await oracle.setWeatherData("Laikipia", 20, 28, 7000); // severe drought
      await insurance.checkAndPayClaim(farmer1.address);

      const farmer = await insurance.farmers(farmer1.address);
      expect(farmer.seasonsCompleted).to.equal(1); // loyalty earned even with claim
    });
  });

  // ── Views ──────────────────────────────────────────────────────────
  describe("View Functions", function () {
    it("should return enhanced farmer details with loyalty info", async function () {
      const { insurance, farmer1, premiumAmount } = await loadFixture(deployInsuranceFixture);

      await insurance.connect(farmer1).register("Laikipia", { value: premiumAmount });
      const details = await insurance.getFarmerDetails(farmer1.address);

      expect(details.isRegistered).to.be.true;
      expect(details.region).to.equal("Laikipia");
      expect(details.seasonsCompleted).to.equal(0);
      expect(details.loyaltyDiscount).to.equal(0);
    });
  });
});
