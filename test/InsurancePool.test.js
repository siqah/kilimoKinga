const { expect } = require("chai");
const { ethers } = require("hardhat");
const {
  loadFixture,
  time,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("InsurancePool", function () {
  // ── Fixture ────────────────────────────────────────────────────────
  async function deployPoolFixture() {
    const [admin, investor1, investor2, farmer, insuranceContract] =
      await ethers.getSigners();

    // Deploy MockUSDC
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const usdc = await MockUSDC.deploy();

    // Deploy InsurancePool (insuranceContract signer acts as the insurance contract)
    const InsurancePool = await ethers.getContractFactory("InsurancePool");
    const pool = await InsurancePool.deploy(usdc.target, insuranceContract.address);

    // Mint USDC for investors and approve pool
    const stakeAmount = ethers.parseUnits("1000", 6); // 1000 USDC
    await usdc.mint(investor1.address, stakeAmount * 5n);
    await usdc.mint(investor2.address, stakeAmount * 5n);
    await usdc.connect(investor1).approve(pool.target, ethers.MaxUint256);
    await usdc.connect(investor2).approve(pool.target, ethers.MaxUint256);

    // Mint some extra USDC to pool for reward payouts
    await usdc.mint(pool.target, ethers.parseUnits("500", 6));

    return { pool, usdc, admin, investor1, investor2, farmer, insuranceContract, stakeAmount };
  }

  // ── Staking ────────────────────────────────────────────────────────
  describe("Staking", function () {
    it("should allow investor to stake stablecoins", async function () {
      const { pool, usdc, investor1, stakeAmount } = await loadFixture(deployPoolFixture);

      await expect(pool.connect(investor1).stake(stakeAmount))
        .to.emit(pool, "Staked")
        .withArgs(investor1.address, stakeAmount);

      const stake = await pool.stakers(investor1.address);
      expect(stake.amount).to.equal(stakeAmount);
      expect(stake.active).to.be.true;
      expect(await pool.totalStaked()).to.equal(stakeAmount);
    });

    it("should reject staking zero amount", async function () {
      const { pool, investor1 } = await loadFixture(deployPoolFixture);

      await expect(
        pool.connect(investor1).stake(0)
      ).to.be.revertedWith("Amount must be positive");
    });

    it("should compound rewards on additional stake", async function () {
      const { pool, investor1, stakeAmount } = await loadFixture(deployPoolFixture);

      await pool.connect(investor1).stake(stakeAmount);

      // Advance time by 30 days
      await time.increase(30 * 24 * 60 * 60);

      // Stake more
      await pool.connect(investor1).stake(stakeAmount);

      const stake = await pool.stakers(investor1.address);
      // Should be more than 2× stakeAmount due to compounded rewards
      expect(stake.amount).to.be.greaterThan(stakeAmount * 2n);
    });

    it("should track multiple stakers", async function () {
      const { pool, investor1, investor2, stakeAmount } = await loadFixture(deployPoolFixture);

      await pool.connect(investor1).stake(stakeAmount);
      await pool.connect(investor2).stake(stakeAmount * 2n);

      expect(await pool.totalStaked()).to.equal(stakeAmount * 3n);
      expect(await pool.getStakerCount()).to.equal(2);
    });
  });

  // ── Unstaking ──────────────────────────────────────────────────────
  describe("Unstaking", function () {
    it("should allow investor to unstake with rewards", async function () {
      const { pool, usdc, investor1, stakeAmount } = await loadFixture(deployPoolFixture);

      await pool.connect(investor1).stake(stakeAmount);

      // Advance time by 90 days
      await time.increase(90 * 24 * 60 * 60);

      const reward = await pool.calculateReward(investor1.address);
      expect(reward).to.be.greaterThan(0);

      const balanceBefore = await usdc.balanceOf(investor1.address);

      await expect(pool.connect(investor1).unstake())
        .to.emit(pool, "Unstaked");

      const balanceAfter = await usdc.balanceOf(investor1.address);
      // Allow tiny rounding tolerance due to integer division in reward calc
      expect(balanceAfter - balanceBefore).to.be.closeTo(stakeAmount + reward, 2);

      const stake = await pool.stakers(investor1.address);
      expect(stake.active).to.be.false;
    });

    it("should reject unstake with no active stake", async function () {
      const { pool, investor1 } = await loadFixture(deployPoolFixture);

      await expect(
        pool.connect(investor1).unstake()
      ).to.be.revertedWith("No active stake");
    });
  });

  // ── Claim Payouts ──────────────────────────────────────────────────
  describe("Claim Payouts", function () {
    it("should allow insurance contract to pay claims from pool", async function () {
      const { pool, usdc, investor1, farmer, insuranceContract, stakeAmount } =
        await loadFixture(deployPoolFixture);

      // Investor stakes first
      await pool.connect(investor1).stake(stakeAmount);

      const claimAmount = ethers.parseUnits("500", 6); // 500 USDC
      const farmerBalBefore = await usdc.balanceOf(farmer.address);

      await expect(
        pool.connect(insuranceContract).payClaim(farmer.address, claimAmount)
      )
        .to.emit(pool, "ClaimFundsUsed")
        .withArgs(claimAmount, await usdc.balanceOf(pool.target) - claimAmount);

      const farmerBalAfter = await usdc.balanceOf(farmer.address);
      expect(farmerBalAfter - farmerBalBefore).to.equal(claimAmount);
    });

    it("should reject claim payout from non-insurance address", async function () {
      const { pool, investor1, farmer, stakeAmount } = await loadFixture(deployPoolFixture);

      await pool.connect(investor1).stake(stakeAmount);

      await expect(
        pool.connect(investor1).payClaim(farmer.address, ethers.parseUnits("100", 6))
      ).to.be.revertedWith("Only insurance contract");
    });

    it("should reject claim payout when pool has insufficient liquidity", async function () {
      const { pool, usdc, insuranceContract, farmer } = await loadFixture(deployPoolFixture);

      // Try to claim more than exists in pool
      const hugeAmount = ethers.parseUnits("999999", 6);

      await expect(
        pool.connect(insuranceContract).payClaim(farmer.address, hugeAmount)
      ).to.be.revertedWith("Insufficient pool liquidity");
    });
  });

  // ── Views ──────────────────────────────────────────────────────────
  describe("View Functions", function () {
    it("should return pool health metrics", async function () {
      const { pool, investor1, stakeAmount } = await loadFixture(deployPoolFixture);

      await pool.connect(investor1).stake(stakeAmount);

      const [staked, available] = await pool.getPoolHealth();
      expect(staked).to.equal(stakeAmount);
      expect(available).to.be.greaterThanOrEqual(stakeAmount);
    });

    it("should calculate reward correctly over time", async function () {
      const { pool, investor1, stakeAmount } = await loadFixture(deployPoolFixture);

      await pool.connect(investor1).stake(stakeAmount);

      // Advance exactly 365 days
      await time.increase(365 * 24 * 60 * 60);

      const reward = await pool.calculateReward(investor1.address);
      // 5% of 1000 USDC = 50 USDC = 50_000_000 (6 decimals)
      const expectedReward = stakeAmount * 5n / 100n;

      // Allow small rounding tolerance
      expect(reward).to.be.closeTo(expectedReward, ethers.parseUnits("1", 6));
    });
  });
});
