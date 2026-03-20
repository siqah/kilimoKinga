// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IERC20 (minimal interface)
 */
interface IERC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 value) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
}

/**
 * @title InsurancePool (v2 — Gas Optimized + Upgradeable-Ready)
 * @notice Investor-backed liquidity pool for the insurance system.
 *         Uses custom errors for gas savings and safe transfer patterns.
 *
 * @dev To upgrade to UUPS Proxy:
 *      1. npm install @openzeppelin/contracts-upgradeable
 *      2. Inherit Initializable, UUPSUpgradeable, OwnableUpgradeable
 *      3. Replace constructor with initialize() + initializer modifier
 *      4. Import and use SafeERC20 from OZ instead of inline _safeTransfer
 */
contract InsurancePool {
    // ── Custom Errors ────────────────────────────────────────────────────
    error AmountMustBePositive();
    error NoActiveStake();
    error OnlyInsuranceContract();
    error OnlyAdmin();
    error InsufficientPoolLiquidity(uint256 available, uint256 required);
    error TransferFailed();

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
    address public admin;

    mapping(address => Stake) public stakers;
    address[] public stakerAddresses;

    uint256 public totalStaked;
    uint256 public rewardRate;
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
        rewardRate = 5; // 5% APY
    }

    // ── Internal: Safe ERC20 transfer ────────────────────────────────────
    function _safeTransfer(IERC20 token, address to, uint256 amount) internal {
        bool success = token.transfer(to, amount);
        if (!success) revert TransferFailed();
    }

    function _safeTransferFrom(IERC20 token, address from, address to, uint256 amount) internal {
        bool success = token.transferFrom(from, to, amount);
        if (!success) revert TransferFailed();
    }

    // ── Investor: Stake stablecoins ──────────────────────────────────────
    function stake(uint256 _amount) external {
        if (_amount == 0) revert AmountMustBePositive();

        _safeTransferFrom(stablecoin, msg.sender, address(this), _amount);

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

        _safeTransfer(stablecoin, _farmer, _amount);
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

        _safeTransfer(stablecoin, msg.sender, totalReturn);
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
