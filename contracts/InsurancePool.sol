// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title InsurancePool
 * @notice Investor-backed liquidity pool for the insurance system.
 *         Investors stake stablecoins, earn APY, and their capital
 *         backs farmer claim payouts.
 */
contract InsurancePool {
    IERC20 public stablecoin;
    address public insuranceContract;
    address public admin;

    struct Stake {
        uint256 amount;
        uint256 startTime;
        uint256 lastReward;
        bool active;
    }

    mapping(address => Stake) public stakers;
    address[] public stakerAddresses;

    uint256 public totalStaked;
    uint256 public rewardRate = 5; // 5% annual return
    uint256 public totalClaimsPaid;

    // ── Events ───────────────────────────────────────────────────────────
    event Staked(address indexed investor, uint256 amount);
    event Unstaked(address indexed investor, uint256 amount, uint256 reward);
    event ClaimFundsUsed(uint256 amount, uint256 remaining);

    // ── Constructor ──────────────────────────────────────────────────────
    constructor(address _stablecoin, address _insuranceContract) {
        stablecoin = IERC20(_stablecoin);
        insuranceContract = _insuranceContract;
        admin = msg.sender;
    }

    // ── Investor: Stake stablecoins ──────────────────────────────────────
    function stake(uint256 _amount) external {
        require(_amount > 0, "Amount must be positive");
        require(
            stablecoin.transferFrom(msg.sender, address(this), _amount),
            "Transfer failed"
        );

        if (stakers[msg.sender].active) {
            // Compound existing rewards into the stake
            uint256 pendingReward = calculateReward(msg.sender);
            stakers[msg.sender].amount += _amount + pendingReward;
            stakers[msg.sender].startTime = block.timestamp;
        } else {
            stakers[msg.sender] = Stake({
                amount: _amount,
                startTime: block.timestamp,
                lastReward: block.timestamp,
                active: true
            });
            stakerAddresses.push(msg.sender);
        }

        totalStaked += _amount;
        emit Staked(msg.sender, _amount);
    }

    // ── Insurance contract: withdraw to pay a claim ──────────────────────
    function payClaim(address _farmer, uint256 _amount) external {
        require(msg.sender == insuranceContract, "Only insurance contract");
        require(
            stablecoin.balanceOf(address(this)) >= _amount,
            "Insufficient pool liquidity"
        );

        require(stablecoin.transfer(_farmer, _amount), "Transfer failed");
        totalClaimsPaid += _amount;

        emit ClaimFundsUsed(_amount, stablecoin.balanceOf(address(this)));
    }

    // ── Investor: Unstake with accrued rewards ───────────────────────────
    function unstake() external {
        require(stakers[msg.sender].active, "No active stake");

        Stake storage userStake = stakers[msg.sender];
        uint256 reward = calculateReward(msg.sender);
        uint256 totalReturn = userStake.amount + reward;

        // Check pool has enough
        require(
            stablecoin.balanceOf(address(this)) >= totalReturn,
            "Insufficient pool liquidity for withdrawal"
        );

        userStake.active = false;
        totalStaked -= userStake.amount;

        require(stablecoin.transfer(msg.sender, totalReturn), "Transfer failed");
        emit Unstaked(msg.sender, userStake.amount, reward);
    }

    // ── Internal: reward calculation (simple annual %) ───────────────────
    function calculateReward(address _staker) public view returns (uint256) {
        Stake storage userStake = stakers[_staker];
        if (!userStake.active) return 0;

        uint256 stakingDuration = block.timestamp - userStake.startTime;
        return (userStake.amount * rewardRate * stakingDuration) / (365 days * 100);
    }

    // ── Views ────────────────────────────────────────────────────────────
    function getPoolHealth()
        public
        view
        returns (uint256 staked, uint256 available)
    {
        staked = totalStaked;
        available = stablecoin.balanceOf(address(this));
    }

    function getStakerCount() public view returns (uint256) {
        return stakerAddresses.length;
    }
}
