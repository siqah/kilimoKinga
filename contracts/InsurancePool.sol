// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title InsurancePool (v3 — Stablecoin + UUPS Upgradeable)
 * @notice Investor-backed liquidity pool for the insurance system.
 */
contract InsurancePool is Initializable, UUPSUpgradeable, OwnableUpgradeable {
    using SafeERC20 for IERC20;

    // ── Custom Errors ────────────────────────────────────────────────────
    error AmountMustBePositive();
    error NoActiveStake();
    error OnlyInsuranceContract();
    error InsufficientPoolLiquidity(uint256 available, uint256 required);
    error TransferFailed();
    error ZeroAddress();

    // ── Structs ──────────────────────────────────────────────────────────
    struct Stake {
        uint256 amount;
        uint256 startTime;
        uint256 lastReward;
        bool active;
    }

    // ── State ────────────────────────────────────────────────────────────
    IERC20 public stablecoin;
    address public insuranceContract;

    mapping(address => Stake) public stakers;
    address[] public stakerAddresses;

    uint256 public totalStaked;
    uint256 public rewardRate;
    uint256 public totalClaimsPaid;

    // ── Events ───────────────────────────────────────────────────────────
    event Staked(address indexed investor, uint256 amount);
    event Unstaked(address indexed investor, uint256 amount, uint256 reward);
    event ClaimFundsUsed(uint256 amount, uint256 remaining);

    // ── Upgrades Setup ───────────────────────────────────────────────────
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _stablecoin, address _insuranceContract) public initializer {
        __Ownable_init(msg.sender);

        if (_stablecoin == address(0) || _insuranceContract == address(0)) revert ZeroAddress();

        stablecoin = IERC20(_stablecoin);
        insuranceContract = _insuranceContract;
        rewardRate = 5; // 5% APY
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    // ── Admin ────────────────────────────────────────────────────────────
    function setInsuranceContract(address _insurance) external onlyOwner {
        if (_insurance == address(0)) revert ZeroAddress();
        insuranceContract = _insurance;
    }

    // ── Investor: Stake stablecoins ──────────────────────────────────────
    function stake(uint256 _amount) external {
        if (_amount == 0) revert AmountMustBePositive();

        stablecoin.safeTransferFrom(msg.sender, address(this), _amount);

        if (stakers[msg.sender].active) {
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
        if (msg.sender != insuranceContract) revert OnlyInsuranceContract();

        uint256 balance = stablecoin.balanceOf(address(this));
        if (balance < _amount) revert InsufficientPoolLiquidity(balance, _amount);

        stablecoin.safeTransfer(_farmer, _amount);
        totalClaimsPaid += _amount;

        emit ClaimFundsUsed(_amount, stablecoin.balanceOf(address(this)));
    }

    // ── Investor: Unstake with accrued rewards ───────────────────────────
    function unstake() external {
        if (!stakers[msg.sender].active) revert NoActiveStake();

        Stake storage userStake = stakers[msg.sender];
        uint256 reward = calculateReward(msg.sender);
        uint256 totalReturn = userStake.amount + reward;

        uint256 balance = stablecoin.balanceOf(address(this));
        if (balance < totalReturn) revert InsufficientPoolLiquidity(balance, totalReturn);

        userStake.active = false;
        totalStaked -= userStake.amount;

        stablecoin.safeTransfer(msg.sender, totalReturn);
        emit Unstaked(msg.sender, userStake.amount, reward);
    }

    // ── Reward calculation ───────────────────────────────────────────────
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
