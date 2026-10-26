// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {Currency} from "v4-core/src/types/Currency.sol";
import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {TickMath} from "v4-core/src/libraries/TickMath.sol";
import {SwapParams, ModifyLiquidityParams} from "v4-core/src/types/PoolOperation.sol";
import {PoolSwapTest} from "v4-core/src/test/PoolSwapTest.sol";
import {PoolModifyLiquidityTest} from "v4-core/src/test/PoolModifyLiquidityTest.sol";
import {HookwireRules} from "../src/HookwireRules.sol";

contract TestToken {
    string public name = "Demo";
    string public symbol = "DEMO";
    uint8 public decimals = 18;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 a) external { balanceOf[to] += a; }
    function approve(address s, uint256 a) external returns (bool) { allowance[msg.sender][s] = a; return true; }
    function transfer(address to, uint256 a) external returns (bool) { balanceOf[msg.sender] -= a; balanceOf[to] += a; return true; }
    function transferFrom(address f, address t, uint256 a) external returns (bool) {
        uint256 al = allowance[f][msg.sender];
        if (al != type(uint256).max) allowance[f][msg.sender] = al - a;
        balanceOf[f] -= a; balanceOf[t] += a; return true;
    }
}

/// Runs against a fork of Robinhood Chain mainnet, using the real Uniswap v4 PoolManager.
contract HookwireRulesForkTest is Test {
    IPoolManager constant PM = IPoolManager(0x8366a39CC670B4001A1121B8F6A443A643e40951);

    HookwireRules rules;
    TestToken token;
    PoolSwapTest swapper;
    PoolModifyLiquidityTest lp;
    PoolKey key;

    address alice = makeAddr("alice");
    address keeper = makeAddr("keeper");
    address bob = makeAddr("bob");

    function setUp() public {
        vm.createSelectFork(vm.envString("ROBINHOOD_RPC_URL"));
        rules = new HookwireRules(PM, address(0), 0);
        token = new TestToken();
        swapper = new PoolSwapTest(PM);
        lp = new PoolModifyLiquidityTest(PM);

        // ETH / DEMO pool. Price: 1 DEMO = 0.001 ETH, so 1000 DEMO per ETH (token1 per token0).
        key = PoolKey(Currency.wrap(address(0)), Currency.wrap(address(token)), 3000, 60, IHooks(address(0)));
        PM.initialize(key, TickMath.getSqrtPriceAtTick(69060));

        vm.deal(address(this), 1_000_000 ether);
        token.mint(address(this), 1e30);
        token.approve(address(lp), type(uint256).max);
        token.approve(address(swapper), type(uint256).max);
        lp.modifyLiquidity{value: 500 ether}(
            key, ModifyLiquidityParams({tickLower: -887220, tickUpper: 887220, liquidityDelta: 5e21, salt: 0}), ""
        );

        token.mint(alice, 1_000e18);
        vm.prank(alice);
        token.approve(address(rules), type(uint256).max);
    }

    function _sellTokens(uint256 amt) internal {
        swapper.swap(
            key,
            SwapParams({zeroForOne: false, amountSpecified: -int256(amt), sqrtPriceLimitX96: TickMath.MAX_SQRT_PRICE - 1}),
            PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false}),
            ""
        );
    }

    function _buyTokens(uint256 ethIn) internal {
        swapper.swap{value: ethIn}(
            key,
            SwapParams({zeroForOne: true, amountSpecified: -int256(ethIn), sqrtPriceLimitX96: TickMath.MIN_SQRT_PRICE + 1}),
            PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false}),
            ""
        );
    }

    function _create(HookwireRules.Kind kind, uint32 bps, uint128 amt, uint16 slip, uint16 fee, uint256 minOut) internal returns (uint256) {
        vm.prank(alice);
        return rules.createRule(key, address(token), kind, bps, amt, slip, fee, uint64(block.timestamp + 1 days), minOut);
    }

    function test_stopLoss_executes_after_drop_and_pays_keeper() public {
        uint256 id = _create(HookwireRules.Kind.STOP_LOSS, 3000, 500e18, 1000, 50, 0);

        vm.expectRevert(HookwireRules.NotTriggered.selector);
        vm.prank(keeper);
        rules.execute(id);

        // Dump tokens until the price is 30% under entry.
        for (uint256 i; i < 40; i++) {
            (, , , bool trig,,) = rules.check(id);
            if (trig) break;
            _sellTokens(2_000_000e18);
        }
        (, uint256 cur, uint256 trigPrice, bool triggered,, uint256 sellable) = rules.check(id);
        assertTrue(triggered, "should be triggered");
        assertLe(cur, trigPrice);
        assertEq(sellable, 500e18);

        uint256 aliceEth = alice.balance;
        vm.prank(keeper);
        uint256 out = rules.execute(id);

        assertEq(token.balanceOf(alice), 500e18, "alice sold exactly the rule amount");
        assertEq(keeper.balance, (out * 50) / 10_000, "keeper fee");
        assertEq(alice.balance - aliceEth, out - (out * 50) / 10_000, "owner receives the rest");
        assertEq(token.balanceOf(address(rules)), 0);
        assertEq(address(rules).balance, 0, "contract holds nothing");

        (HookwireRules.Status st,,,,,) = rules.check(id);
        assertEq(uint8(st), uint8(HookwireRules.Status.Executed));

        vm.expectRevert(HookwireRules.NotActive.selector);
        vm.prank(keeper);
        rules.execute(id);
    }

    function test_takeProfit_at_2x() public {
        uint256 id = _create(HookwireRules.Kind.TAKE_PROFIT, 20_000, 1_000e18, 1500, 30, 0);
        for (uint256 i; i < 200; i++) {
            (, , , bool trig,,) = rules.check(id);
            if (trig) break;
            _buyTokens(200 ether);
        }
        (, , , bool t,,) = rules.check(id);
        assertTrue(t);
        uint256 aliceEth = alice.balance;
        vm.prank(keeper);
        rules.execute(id);
        assertEq(token.balanceOf(alice), 0);
        assertGt(alice.balance, aliceEth);
    }

    function test_trailingStop_tracks_peak() public {
        uint256 id = _create(HookwireRules.Kind.TRAILING_STOP, 3000, 1_000e18, 1500, 50, 0);

        // Price rises. Not triggered. Poke raises the stored peak.
        for (uint256 i; i < 5; i++) _buyTokens(5_000 ether);
        HookwireRules.Rule memory before_ = rules.getRule(id);
        rules.poke(id);
        HookwireRules.Rule memory after_ = rules.getRule(id);
        assertGt(after_.refPrice, before_.refPrice, "peak rose");
        (, , , bool t0,,) = rules.check(id);
        assertFalse(t0);

        // Price falls back to entry. That is more than 30% under the peak only if the run-up was large enough.
        for (uint256 i; i < 80; i++) {
            (, , , bool trig,,) = rules.check(id);
            if (trig) break;
            _sellTokens(500_000e18);
        }
        (, , , bool t1,,) = rules.check(id);
        assertTrue(t1, "30% off the peak");
        vm.prank(keeper);
        rules.execute(id);
        assertEq(token.balanceOf(alice), 0);
    }

    function test_sells_what_is_left_when_balance_or_allowance_is_lower() public {
        uint256 id = _create(HookwireRules.Kind.STOP_LOSS, 1000, 900e18, 2000, 0, 0);
        vm.prank(alice);
        token.approve(address(rules), 100e18); // allowance is the limit
        for (uint256 i; i < 40; i++) {
            (, , , bool trig,,) = rules.check(id);
            if (trig) break;
            _sellTokens(1_000_000e18);
        }
        vm.prank(keeper);
        rules.execute(id);
        assertEq(token.balanceOf(alice), 900e18, "only the 100 DEMO allowance was sold");
    }

    function test_floor_scales_down_when_balance_is_lower_than_rule_amount() public {
        // Rule for 900 DEMO with a floor. Alice only holds 100 DEMO when it fires. The floor must scale
        // with the amount actually sold, otherwise the rule could never execute.
        (, uint256 cur,,,,) = _checkAfterCreate();
        uint256 floorFull = (((900e18 * cur) >> 96) * 50) / 100; // 50% of entry value, for 900 DEMO
        uint256 id = _create(HookwireRules.Kind.STOP_LOSS, 1000, 900e18, 2000, 0, floorFull);
        vm.prank(alice);
        token.transfer(bob, 900e18); // alice now holds 100 DEMO
        for (uint256 i; i < 40; i++) {
            (, , , bool trig,,) = rules.check(id);
            if (trig) break;
            _sellTokens(20_000e18);
        }
        vm.prank(keeper);
        rules.execute(id);
        assertEq(token.balanceOf(alice), 0, "sold what was left");
    }

    function _checkAfterCreate() internal returns (HookwireRules.Status s, uint256 cur, uint256 a, bool b, bool c, uint256 d) {
        uint256 probe = _create(HookwireRules.Kind.STOP_LOSS, 1000, 1e18, 100, 0, 0);
        (s, cur, a, b, c, d) = rules.check(probe);
        vm.prank(alice);
        rules.cancel(probe);
    }

    function test_unlockCallback_only_from_pool_manager() public {
        vm.prank(bob);
        vm.expectRevert(HookwireRules.OnlyPoolManager.selector);
        rules.unlockCallback(abi.encode(uint256(1), bob, uint256(1), uint256(1)));
    }

    function test_constructor_caps_protocol_fee() public {
        vm.expectRevert(HookwireRules.BadParams.selector);
        new HookwireRules(PM, address(1), 101);
        vm.expectRevert(HookwireRules.BadParams.selector);
        new HookwireRules(PM, address(0), 50);
    }

    function test_protocol_fee_goes_to_treasury_and_contract_keeps_nothing() public {
        address treasury = makeAddr("treasury");
        HookwireRules r2 = new HookwireRules(PM, treasury, 100);
        vm.prank(alice);
        token.approve(address(r2), type(uint256).max);
        vm.prank(alice);
        uint256 id = r2.createRule(key, address(token), HookwireRules.Kind.STOP_LOSS, 1000, 500e18, 2000, 100, uint64(block.timestamp + 1 days), 0);
        for (uint256 i; i < 40; i++) {
            (, , , bool trig,,) = r2.check(id);
            if (trig) break;
            _sellTokens(20_000e18);
        }
        uint256 aliceEth = alice.balance;
        vm.prank(keeper);
        uint256 out = r2.execute(id);
        assertEq(treasury.balance, out / 100, "1% protocol fee");
        assertEq(keeper.balance, out / 100, "1% keeper fee");
        assertEq(alice.balance - aliceEth, out - out / 50, "owner gets the rest");
        assertEq(address(r2).balance, 0);
        assertEq(token.balanceOf(address(r2)), 0);
    }

    function test_zero_allowance_is_a_kill_switch() public {
        uint256 id = _create(HookwireRules.Kind.STOP_LOSS, 1000, 500e18, 2000, 0, 0);
        vm.prank(alice);
        token.approve(address(rules), 0);
        for (uint256 i; i < 40; i++) {
            (, , , bool trig,,) = rules.check(id);
            if (trig) break;
            _sellTokens(1_000_000e18);
        }
        vm.expectRevert(HookwireRules.NothingToSell.selector);
        vm.prank(keeper);
        rules.execute(id);
        assertEq(token.balanceOf(alice), 1_000e18);
    }

    function test_cancel_and_expiry() public {
        uint256 id = _create(HookwireRules.Kind.STOP_LOSS, 1000, 500e18, 2000, 0, 0);
        vm.prank(bob);
        vm.expectRevert(HookwireRules.NotOwner.selector);
        rules.cancel(id);
        vm.prank(alice);
        rules.cancel(id);
        vm.prank(keeper);
        vm.expectRevert(HookwireRules.NotActive.selector);
        rules.execute(id);

        uint256 id2 = _create(HookwireRules.Kind.STOP_LOSS, 1000, 500e18, 2000, 0, 0);
        vm.warp(block.timestamp + 2 days);
        vm.prank(keeper);
        vm.expectRevert(HookwireRules.Expired.selector);
        rules.execute(id2);
    }

    function test_minOut_floor_blocks_bad_fill() public {
        uint256 id = _create(HookwireRules.Kind.STOP_LOSS, 3000, 500e18, 5000, 0, 1000 ether); // absurd floor
        for (uint256 i; i < 40; i++) {
            (, , , bool trig,,) = rules.check(id);
            if (trig) break;
            _sellTokens(2_000_000e18);
        }
        vm.prank(keeper);
        vm.expectRevert(HookwireRules.Slippage.selector);
        rules.execute(id);
        assertEq(token.balanceOf(alice), 1_000e18, "nothing moved");
        (HookwireRules.Status st,,,,,) = rules.check(id);
        assertEq(uint8(st), uint8(HookwireRules.Status.Active), "rule stays active");
    }

    function test_bad_params_revert() public {
        vm.startPrank(alice);
        vm.expectRevert(HookwireRules.BadParams.selector);
        rules.createRule(key, address(0), HookwireRules.Kind.STOP_LOSS, 1000, 1e18, 100, 10, uint64(block.timestamp + 1 days), 0);
        vm.expectRevert(HookwireRules.BadParams.selector);
        rules.createRule(key, address(token), HookwireRules.Kind.TAKE_PROFIT, 9_000, 1e18, 100, 10, uint64(block.timestamp + 1 days), 0);
        vm.expectRevert(HookwireRules.BadParams.selector);
        rules.createRule(key, address(token), HookwireRules.Kind.STOP_LOSS, 1000, 1e18, 100, 500, uint64(block.timestamp + 1 days), 0);
        vm.expectRevert(HookwireRules.BadParams.selector);
        rules.createRule(key, address(token), HookwireRules.Kind.STOP_LOSS, 1000, 1e18, 100, 10, uint64(block.timestamp - 1), 0);
        PoolKey memory dead = key;
        dead.fee = 10_000;
        vm.expectRevert(HookwireRules.PoolNotInitialized.selector);
        rules.createRule(dead, address(token), HookwireRules.Kind.STOP_LOSS, 1000, 1e18, 100, 10, uint64(block.timestamp + 1 days), 0);
        vm.stopPrank();
    }

    function test_activeRules_listing() public {
        _create(HookwireRules.Kind.STOP_LOSS, 1000, 1e18, 100, 10, 0);
        uint256 b = _create(HookwireRules.Kind.STOP_LOSS, 1000, 1e18, 100, 10, 0);
        _create(HookwireRules.Kind.TAKE_PROFIT, 20_000, 1e18, 100, 10, 0);
        vm.prank(alice);
        rules.cancel(b);
        (uint256[] memory ids, uint256 next) = rules.activeRules(1, 50);
        assertEq(ids.length, 2);
        assertEq(ids[0], 1);
        assertEq(ids[1], 3);
        assertEq(next, 4);
    }

    receive() external payable {}
}
