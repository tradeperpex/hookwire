// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {IUnlockCallback} from "v4-core/src/interfaces/callback/IUnlockCallback.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {SwapParams} from "v4-core/src/types/PoolOperation.sol";
import {PoolId, PoolIdLibrary} from "v4-core/src/types/PoolId.sol";
import {Currency} from "v4-core/src/types/Currency.sol";
import {BalanceDelta} from "v4-core/src/types/BalanceDelta.sol";
import {StateLibrary} from "v4-core/src/libraries/StateLibrary.sol";
import {TickMath} from "v4-core/src/libraries/TickMath.sol";
import {FullMath} from "v4-core/src/libraries/FullMath.sol";

interface IERC20Min {
    function balanceOf(address) external view returns (uint256);
    function allowance(address, address) external view returns (uint256);
}

/// @title HookwireRules
/// @notice Non-custodial sell rules on Uniswap v4. The contract never holds user funds between
///         transactions. A user approves an amount of an ERC-20 to this contract, writes a rule, and
///         anyone (a keeper) can execute the rule once its trigger is met. Execution pulls at most the
///         rule amount from the owner straight into the PoolManager, and sends the proceeds straight
///         back to the owner, minus a keeper fee. The ERC-20 allowance is the spend limit and
///         cancelling a rule or setting the allowance to zero is the kill switch.
/// @dev    Experimental and unaudited. Trigger prices are read from pool spot price, which can be
///         moved inside a block. See docs on the site for the full list of known limits.
contract HookwireRules is IUnlockCallback {
    using PoolIdLibrary for PoolKey;
    using StateLibrary for IPoolManager;

    enum Kind {
        TAKE_PROFIT, // sell when price >= entry * triggerBps / 10_000      (30_000 = 3x)
        STOP_LOSS, // sell when price <= entry * (10_000 - triggerBps) / 10_000
        TRAILING_STOP // sell when price <= peak  * (10_000 - triggerBps) / 10_000
    }

    enum Status {
        None,
        Active,
        Executed,
        Cancelled
    }

    struct Rule {
        address owner;
        address tokenIn;
        Kind kind;
        Status status;
        bool zeroForOne;
        uint16 slippageBps;
        uint16 keeperFeeBps;
        uint32 triggerBps;
        uint64 expiry;
        uint64 createdAt;
        uint128 amountIn;
        uint256 minOut; // absolute floor on output for the full amountIn, raw units. 0 = none. Scaled down if less is sold.
        uint256 refPrice; // entry price, or running peak for trailing stops. Q96, output per input.
        PoolKey key;
    }

    uint256 public constant BPS = 10_000;
    uint16 public constant MAX_KEEPER_FEE_BPS = 200;
    uint16 public constant MAX_PROTOCOL_FEE_BPS = 100;
    uint16 public constant MAX_SLIPPAGE_BPS = 5_000;
    uint32 public constant MAX_TAKE_PROFIT_BPS = 10_000_000; // 1000x

    IPoolManager public immutable poolManager;
    address public immutable treasury;
    uint16 public immutable protocolFeeBps;

    uint256 public ruleCount;
    mapping(uint256 => Rule) internal _rules;
    mapping(address => uint256[]) internal _ownerRules;

    uint256 private _lock = 1;

    event RuleCreated(
        uint256 indexed id,
        address indexed owner,
        address indexed tokenIn,
        bytes32 poolId,
        Kind kind,
        uint32 triggerBps,
        uint128 amountIn,
        uint256 refPrice,
        uint64 expiry
    );
    event RuleExecuted(uint256 indexed id, address indexed keeper, uint256 amountIn, uint256 amountOut, uint256 keeperFee);
    event RuleCancelled(uint256 indexed id);
    event PeakUpdated(uint256 indexed id, uint256 peak);

    error NotOwner();
    error NotActive();
    error Expired();
    error NotTriggered();
    error BadParams();
    error PoolNotInitialized();
    error NothingToSell();
    error Slippage();
    error Reentrancy();
    error OnlyPoolManager();
    error TransferFailed();

    modifier nonReentrant() {
        if (_lock != 1) revert Reentrancy();
        _lock = 2;
        _;
        _lock = 1;
    }

    constructor(IPoolManager _pm, address _treasury, uint16 _protocolFeeBps) {
        if (_protocolFeeBps > MAX_PROTOCOL_FEE_BPS) revert BadParams();
        if (_protocolFeeBps > 0 && _treasury == address(0)) revert BadParams();
        poolManager = _pm;
        treasury = _treasury;
        protocolFeeBps = _protocolFeeBps;
    }

    // ---------------------------------------------------------------------------------------
    // Create and cancel
    // ---------------------------------------------------------------------------------------

    function createRule(
        PoolKey calldata key,
        address tokenIn,
        Kind kind,
        uint32 triggerBps,
        uint128 amountIn,
        uint16 slippageBps,
        uint16 keeperFeeBps,
        uint64 expiry,
        uint256 minOut
    ) external returns (uint256 id) {
        bool zeroForOne;
        if (tokenIn == Currency.unwrap(key.currency0)) zeroForOne = true;
        else if (tokenIn != Currency.unwrap(key.currency1)) revert BadParams();
        if (tokenIn == address(0)) revert BadParams(); // ERC-20 only
        if (amountIn == 0) revert BadParams();
        if (slippageBps > MAX_SLIPPAGE_BPS || keeperFeeBps > MAX_KEEPER_FEE_BPS) revert BadParams();
        if (expiry <= block.timestamp) revert BadParams();
        if (kind == Kind.TAKE_PROFIT) {
            if (triggerBps <= BPS || triggerBps > MAX_TAKE_PROFIT_BPS) revert BadParams();
        } else {
            if (triggerBps == 0 || triggerBps >= BPS) revert BadParams();
        }

        uint256 price = _price(key, zeroForOne);
        if (price == 0) revert PoolNotInitialized();

        id = ++ruleCount;
        Rule storage r = _rules[id];
        r.owner = msg.sender;
        r.tokenIn = tokenIn;
        r.kind = kind;
        r.status = Status.Active;
        r.zeroForOne = zeroForOne;
        r.slippageBps = slippageBps;
        r.keeperFeeBps = keeperFeeBps;
        r.triggerBps = triggerBps;
        r.expiry = expiry;
        r.createdAt = uint64(block.timestamp);
        r.amountIn = amountIn;
        r.minOut = minOut;
        r.refPrice = price;
        r.key = key;
        _ownerRules[msg.sender].push(id);

        emit RuleCreated(id, msg.sender, tokenIn, PoolId.unwrap(key.toId()), kind, triggerBps, amountIn, price, expiry);
    }

    function cancel(uint256 id) external {
        Rule storage r = _rules[id];
        if (r.owner != msg.sender) revert NotOwner();
        if (r.status != Status.Active) revert NotActive();
        r.status = Status.Cancelled;
        emit RuleCancelled(id);
    }

    // ---------------------------------------------------------------------------------------
    // Keeper entry points
    // ---------------------------------------------------------------------------------------

    /// @notice Raise the stored peak of a trailing stop to the current price. Anyone can call it.
    function poke(uint256 id) external {
        Rule storage r = _rules[id];
        if (r.status != Status.Active) revert NotActive();
        if (r.kind != Kind.TRAILING_STOP) revert BadParams();
        uint256 p = _price(r.key, r.zeroForOne);
        if (p > r.refPrice) {
            r.refPrice = p;
            emit PeakUpdated(id, p);
        }
    }

    /// @notice Execute a rule whose trigger is met. The caller is the keeper and earns the keeper fee.
    function execute(uint256 id) external nonReentrant returns (uint256 amountOut) {
        Rule storage r = _rules[id];
        if (r.status != Status.Active) revert NotActive();
        if (block.timestamp > r.expiry) revert Expired();

        uint256 p = _price(r.key, r.zeroForOne);
        if (r.kind == Kind.TRAILING_STOP && p > r.refPrice) {
            r.refPrice = p;
            emit PeakUpdated(id, p);
        }
        if (!_isTriggered(r, p)) revert NotTriggered();

        uint256 amt = _sellable(r);
        if (amt == 0) revert NothingToSell();

        r.status = Status.Executed;
        bytes memory res = poolManager.unlock(abi.encode(id, msg.sender, amt, p));
        uint256 keeperFee;
        (amountOut, keeperFee) = abi.decode(res, (uint256, uint256));
        emit RuleExecuted(id, msg.sender, amt, amountOut, keeperFee);
    }

    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        if (msg.sender != address(poolManager)) revert OnlyPoolManager();
        (uint256 id, address keeper, uint256 amt, uint256 spot) = abi.decode(data, (uint256, address, uint256, uint256));
        Rule storage r = _rules[id];

        BalanceDelta d = poolManager.swap(
            r.key,
            SwapParams({
                zeroForOne: r.zeroForOne,
                amountSpecified: -int256(amt),
                sqrtPriceLimitX96: r.zeroForOne ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1
            }),
            ""
        );

        int128 dIn = r.zeroForOne ? d.amount0() : d.amount1();
        int128 dOut = r.zeroForOne ? d.amount1() : d.amount0();
        if (dIn > 0 || dOut < 0) revert BadParams();
        uint256 owed = uint256(uint128(-dIn));
        uint256 out = uint256(uint128(dOut));

        // Output must be within the rule slippage of the spot price read at the start of this call,
        // and above the optional absolute floor.
        uint256 expected = FullMath.mulDiv(amt, spot, 1 << 96);
        // The absolute floor was set for the full rule amount, so it scales down if less is sold.
        uint256 floor_ = r.minOut == 0 ? 0 : FullMath.mulDiv(r.minOut, amt, r.amountIn);
        if (out < (expected * (BPS - r.slippageBps)) / BPS || out < floor_) revert Slippage();

        address owner_ = r.owner;
        Currency cIn = Currency.wrap(r.tokenIn);
        Currency cOut = r.zeroForOne ? r.key.currency1 : r.key.currency0;

        // Pay the pool straight from the owner. This is bounded by the owner's allowance to this contract.
        poolManager.sync(cIn);
        _pull(r.tokenIn, owner_, address(poolManager), owed);
        poolManager.settle();

        uint256 keeperFee = (out * r.keeperFeeBps) / BPS;
        uint256 protocolFee = (out * protocolFeeBps) / BPS;
        poolManager.take(cOut, owner_, out - keeperFee - protocolFee);
        if (keeperFee > 0) poolManager.take(cOut, keeper, keeperFee);
        if (protocolFee > 0) poolManager.take(cOut, treasury, protocolFee);

        return abi.encode(out, keeperFee);
    }

    // ---------------------------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------------------------

    function getRule(uint256 id) external view returns (Rule memory) {
        return _rules[id];
    }

    function rulesOf(address owner_) external view returns (uint256[] memory) {
        return _ownerRules[owner_];
    }

    /// @return status Rule status.
    /// @return currentPrice Spot price now, Q96, output per input.
    /// @return triggerPrice The price at which the rule triggers, Q96.
    /// @return triggered True if the trigger condition holds now.
    /// @return expired True if the rule is past its expiry.
    /// @return sellable Amount that would be sold now: min(rule amount, balance, allowance).
    function check(uint256 id)
        external
        view
        returns (Status status, uint256 currentPrice, uint256 triggerPrice, bool triggered, bool expired, uint256 sellable)
    {
        Rule storage r = _rules[id];
        status = r.status;
        if (status == Status.None) return (status, 0, 0, false, false, 0);
        currentPrice = _price(r.key, r.zeroForOne);
        uint256 ref = r.refPrice;
        if (r.kind == Kind.TRAILING_STOP && currentPrice > ref) ref = currentPrice;
        triggerPrice = _triggerPrice(r.kind, r.triggerBps, ref);
        triggered = _isTriggeredAt(r.kind, currentPrice, triggerPrice);
        expired = block.timestamp > r.expiry;
        sellable = _sellable(r);
    }

    /// @notice Ids of active, unexpired rules in [from, from + limit). For keepers.
    function activeRules(uint256 from, uint256 limit) external view returns (uint256[] memory ids, uint256 next) {
        uint256 end = from + limit;
        if (end > ruleCount + 1) end = ruleCount + 1;
        if (from == 0) from = 1;
        uint256[] memory tmp = new uint256[](end > from ? end - from : 0);
        uint256 n;
        for (uint256 i = from; i < end; i++) {
            Rule storage r = _rules[i];
            if (r.status == Status.Active && block.timestamp <= r.expiry) tmp[n++] = i;
        }
        ids = new uint256[](n);
        for (uint256 j; j < n; j++) ids[j] = tmp[j];
        next = end;
    }

    // ---------------------------------------------------------------------------------------
    // Internals
    // ---------------------------------------------------------------------------------------

    function _sellable(Rule storage r) internal view returns (uint256 amt) {
        amt = r.amountIn;
        uint256 bal = IERC20Min(r.tokenIn).balanceOf(r.owner);
        if (bal < amt) amt = bal;
        uint256 allow = IERC20Min(r.tokenIn).allowance(r.owner, address(this));
        if (allow < amt) amt = allow;
    }

    function _isTriggered(Rule storage r, uint256 price) internal view returns (bool) {
        return _isTriggeredAt(r.kind, price, _triggerPrice(r.kind, r.triggerBps, r.refPrice));
    }

    function _isTriggeredAt(Kind kind, uint256 price, uint256 triggerPrice) internal pure returns (bool) {
        if (kind == Kind.TAKE_PROFIT) return price >= triggerPrice;
        return price <= triggerPrice;
    }

    function _triggerPrice(Kind kind, uint32 triggerBps, uint256 ref) internal pure returns (uint256) {
        if (kind == Kind.TAKE_PROFIT) return FullMath.mulDiv(ref, triggerBps, BPS);
        return FullMath.mulDiv(ref, BPS - triggerBps, BPS);
    }

    /// @dev Price of the sold token in the other token, Q96, in raw units.
    function _price(PoolKey memory key, bool zeroForOne) internal view returns (uint256) {
        (uint160 sqrtP,,,) = poolManager.getSlot0(key.toId());
        if (sqrtP == 0) return 0;
        if (zeroForOne) return FullMath.mulDiv(sqrtP, sqrtP, 1 << 96);
        uint256 inv = FullMath.mulDiv(1 << 96, 1 << 96, sqrtP);
        return FullMath.mulDiv(inv, 1 << 96, sqrtP);
    }

    function _pull(address token, address from, address to, uint256 amount) internal {
        // transferFrom(address,address,uint256), tolerant of tokens that return nothing.
        (bool ok, bytes memory ret) = token.call(abi.encodeWithSelector(0x23b872dd, from, to, amount));
        if (!ok || (ret.length != 0 && !abi.decode(ret, (bool)))) revert TransferFailed();
    }
}
