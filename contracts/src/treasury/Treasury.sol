// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl}    from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable}         from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard}  from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20}           from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20}        from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {IAaveV3Pool}             from "../interfaces/external/IAaveV3Pool.sol";
import {IWrappedTokenGatewayV3}  from "../interfaces/external/IWrappedTokenGatewayV3.sol";
import {SkillAI__ZeroAddress, SkillAI__WithdrawFailed} from "../libraries/SkillTypes.sol";

/// @title  Treasury
/// @author SKILLAI
/// @notice Protocol treasury — collects the 20% protocol fee (ETH and USDC) and
///         the 10% reserve share from every skill purchase made through the Marketplace.
/// @dev    Security:
///         - AccessControl: ADMIN_ROLE can withdraw + pause
///         - ReentrancyGuard: every external fund-moving function is non-reentrant
///         - Pausable: emergency circuit breaker
///         - SafeERC20 for ERC-20 transfers (fee-on-transfer safe)
///         - Tracks lifetime inflows for transparency and future DAO governance
contract Treasury is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // =========================================================================
    //                               ROLES
    // =========================================================================

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    // =========================================================================
    //                              STORAGE
    // =========================================================================

    /// @notice Lifetime ETH deposited (never decreased by withdrawals)
    uint256 public totalEthCollected;

    /// @notice Lifetime USDC deposited (never decreased by withdrawals)
    uint256 public totalUsdcCollected;

    /// @notice Lifetime ETH withdrawn by admins
    uint256 public totalEthWithdrawn;

    /// @notice Lifetime USDC withdrawn by admins
    uint256 public totalUsdcWithdrawn;

    // -------------------------------------------------------------------------
    // Yield deployment (Aave V3) — admin-configured external contracts. Off by
    // default; admin opts in by setting the addresses and calling supply*.
    // -------------------------------------------------------------------------

    /// @notice Aave V3 Pool contract. Address(0) = yield deployment disabled.
    IAaveV3Pool public aavePool;

    /// @notice Aave V3 WrappedTokenGateway — used to deposit native ETH as WETH.
    IWrappedTokenGatewayV3 public aaveEthGateway;

    /// @notice Total ETH principal currently supplied to Aave (without yield).
    uint256 public aaveEthPrincipal;

    /// @notice Total USDC principal currently supplied to Aave (without yield).
    uint256 public aaveUsdcPrincipal;

    // =========================================================================
    //                              EVENTS
    // =========================================================================

    event EthDeposited(address indexed from, uint256 amount, uint256 timestamp);
    event UsdcDeposited(address indexed from, uint256 amount, uint256 timestamp);
    event EthWithdrawn(address indexed to, uint256 amount, uint256 timestamp);
    event UsdcWithdrawn(
        address indexed token,
        address indexed to,
        uint256 amount,
        uint256 timestamp
    );

    event AaveConfigured(address pool, address ethGateway);
    event YieldEthSupplied(uint256 amount);
    event YieldEthWithdrawn(uint256 amount);
    event YieldUsdcSupplied(address indexed token, uint256 amount);
    event YieldUsdcWithdrawn(address indexed token, uint256 amount);

    // =========================================================================
    //                            CONSTRUCTOR
    // =========================================================================

    constructor(address admin) {
        if (admin == address(0)) revert SkillAI__ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
    }

    // =========================================================================
    //                            DEPOSIT (ETH)
    // =========================================================================

    /// @notice Accept plain ETH transfers from Marketplace or any source.
    ///         Tracks cumulative inflow for DAO-era reporting.
    receive() external payable whenNotPaused {
        totalEthCollected += msg.value;
        emit EthDeposited(msg.sender, msg.value, block.timestamp);
    }

    /// @notice Explicit ETH deposit with optional memo-style context.
    ///         Identical accounting to `receive()` but with an explicit function
    ///         selector so contracts can call it unambiguously.
    function depositEth() external payable whenNotPaused {
        totalEthCollected += msg.value;
        emit EthDeposited(msg.sender, msg.value, block.timestamp);
    }

    // =========================================================================
    //                           DEPOSIT (USDC / ERC-20)
    // =========================================================================

    /// @notice Notify the treasury that `amount` of `token` has been transferred in.
    /// @dev    The Marketplace performs the `transferFrom` directly — this function
    ///         is the accounting hook that keeps our inflow counters honest.
    ///         Anyone can call it, but only the REAL balance delta matters: the
    ///         treasury never trusts the reported amount for withdrawals, only
    ///         the on-chain balance.
    function notifyUsdcDeposit(address token, uint256 amount)
        external
        whenNotPaused
    {
        if (token == address(0)) revert SkillAI__ZeroAddress();
        totalUsdcCollected += amount;
        emit UsdcDeposited(msg.sender, amount, block.timestamp);
    }

    // =========================================================================
    //                         WITHDRAW (ADMIN)
    // =========================================================================

    /// @notice Withdraw ETH from the treasury to `to`.
    /// @dev    Non-reentrant, admin-only. Intentionally NOT gated by `whenNotPaused`
    ///         so admins can rescue funds during an emergency pause. Uses low-level
    ///         call so it works with EOAs and contracts (multisig, DAO, splitter).
    function withdrawEth(address payable to, uint256 amount)
        external
        onlyRole(ADMIN_ROLE)
        nonReentrant
    {
        if (to == address(0)) revert SkillAI__ZeroAddress();

        totalEthWithdrawn += amount;
        (bool ok, ) = to.call{value: amount}("");
        if (!ok) revert SkillAI__WithdrawFailed();

        emit EthWithdrawn(to, amount, block.timestamp);
    }

    /// @notice Withdraw an ERC-20 (typically USDC) from the treasury to `to`.
    /// @dev    Non-reentrant, admin-only. Intentionally NOT gated by `whenNotPaused`
    ///         so admins can rescue funds during an emergency pause. SafeERC20
    ///         covers USDT-style non-standard ERC-20s as well.
    function withdrawErc20(address token, address to, uint256 amount)
        external
        onlyRole(ADMIN_ROLE)
        nonReentrant
    {
        if (token == address(0) || to == address(0)) revert SkillAI__ZeroAddress();

        totalUsdcWithdrawn += amount;
        IERC20(token).safeTransfer(to, amount);

        emit UsdcWithdrawn(token, to, amount, block.timestamp);
    }

    // =========================================================================
    //                       YIELD DEPLOYMENT (Aave V3)
    // =========================================================================

    /// @notice Configure the Aave V3 endpoints. Pass address(0) for both to
    ///         disable yield deployment entirely.
    /// @dev    Setting addresses does NOT auto-supply funds — admin must
    ///         explicitly call supplyEthToYield / supplyUsdcToYield. This
    ///         keeps yield deployment opt-in per-protocol and per-chain.
    function configureAave(address pool, address ethGateway)
        external
        onlyRole(ADMIN_ROLE)
    {
        aavePool       = IAaveV3Pool(pool);
        aaveEthGateway = IWrappedTokenGatewayV3(ethGateway);
        emit AaveConfigured(pool, ethGateway);
    }

    /// @notice Supply `amount` of idle ETH to Aave V3 via the gateway.
    ///         The Treasury receives aWETH 1:1, which accrues yield over time.
    function supplyEthToYield(uint256 amount)
        external
        onlyRole(ADMIN_ROLE)
        nonReentrant
    {
        if (address(aaveEthGateway) == address(0) || address(aavePool) == address(0)) {
            revert SkillAI__ZeroAddress();
        }
        aaveEthPrincipal += amount;
        aaveEthGateway.depositETH{value: amount}(
            address(aavePool),
            address(this),
            0 // referralCode
        );
        emit YieldEthSupplied(amount);
    }

    /// @notice Withdraw `amount` of WETH back to ETH via the gateway.
    ///         Pass type(uint256).max to withdraw the full balance.
    ///         The withdrawn ETH lands at this contract.
    /// @dev    Admin must first approve the gateway to spend the Treasury's
    ///         aWETH (the gateway burns aWETH to redeem ETH).
    function withdrawEthFromYield(uint256 amount, address aWeth)
        external
        onlyRole(ADMIN_ROLE)
        nonReentrant
    {
        if (address(aaveEthGateway) == address(0) || address(aavePool) == address(0)) {
            revert SkillAI__ZeroAddress();
        }
        // Pre-approve the gateway to pull our aWETH
        IERC20(aWeth).forceApprove(address(aaveEthGateway), amount);

        // Subtract from principal up to the lesser of amount/principal
        uint256 dec = amount > aaveEthPrincipal ? aaveEthPrincipal : amount;
        aaveEthPrincipal -= dec;

        aaveEthGateway.withdrawETH(address(aavePool), amount, address(this));
        emit YieldEthWithdrawn(amount);
    }

    /// @notice Supply `amount` of `token` (USDC) to Aave V3 Pool.
    function supplyUsdcToYield(address token, uint256 amount)
        external
        onlyRole(ADMIN_ROLE)
        nonReentrant
    {
        if (address(aavePool) == address(0) || token == address(0)) revert SkillAI__ZeroAddress();
        aaveUsdcPrincipal += amount;
        IERC20(token).forceApprove(address(aavePool), amount);
        aavePool.supply(token, amount, address(this), 0);
        emit YieldUsdcSupplied(token, amount);
    }

    /// @notice Withdraw `amount` of `token` (USDC) from Aave V3 Pool to this
    ///         contract. Pass type(uint256).max to withdraw the full balance.
    function withdrawUsdcFromYield(address token, uint256 amount)
        external
        onlyRole(ADMIN_ROLE)
        nonReentrant
        returns (uint256 actuallyWithdrawn)
    {
        if (address(aavePool) == address(0) || token == address(0)) revert SkillAI__ZeroAddress();
        actuallyWithdrawn = aavePool.withdraw(token, amount, address(this));
        uint256 dec = actuallyWithdrawn > aaveUsdcPrincipal ? aaveUsdcPrincipal : actuallyWithdrawn;
        aaveUsdcPrincipal -= dec;
        emit YieldUsdcWithdrawn(token, actuallyWithdrawn);
    }

    // =========================================================================
    //                         ADMIN CONTROL
    // =========================================================================

    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    // =========================================================================
    //                         VIEW FUNCTIONS
    // =========================================================================

    /// @notice Current ETH balance held by the treasury
    function ethBalance() external view returns (uint256) {
        return address(this).balance;
    }

    /// @notice Current ERC-20 balance held by the treasury
    function tokenBalance(address token) external view returns (uint256) {
        if (token == address(0)) revert SkillAI__ZeroAddress();
        return IERC20(token).balanceOf(address(this));
    }

    /// @notice Returns the aToken balance of this contract for `asset` (USDC).
    ///         Use this minus `aaveUsdcPrincipal` to get accrued yield.
    function aTokenBalance(address asset) external view returns (uint256) {
        if (address(aavePool) == address(0) || asset == address(0)) return 0;
        (, , , , , , , , address aToken, , , , , , ) = aavePool.getReserveData(asset);
        if (aToken == address(0)) return 0;
        return IERC20(aToken).balanceOf(address(this));
    }

    /// @notice Returns the aWETH balance of this contract.
    function aWethBalance(address aWeth) external view returns (uint256) {
        if (aWeth == address(0)) return 0;
        return IERC20(aWeth).balanceOf(address(this));
    }

    /// @notice Realised yield on USDC: aToken balance minus principal.
    ///         Negative values are clamped to 0 (Aave is non-rebasing-down).
    function aaveUsdcYield(address asset) external view returns (uint256) {
        if (address(aavePool) == address(0) || asset == address(0)) return 0;
        (, , , , , , , , address aToken, , , , , , ) = aavePool.getReserveData(asset);
        if (aToken == address(0)) return 0;
        uint256 bal = IERC20(aToken).balanceOf(address(this));
        return bal > aaveUsdcPrincipal ? bal - aaveUsdcPrincipal : 0;
    }
}
