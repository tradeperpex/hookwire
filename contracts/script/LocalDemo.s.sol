// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {Currency} from "v4-core/src/types/Currency.sol";
import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {TickMath} from "v4-core/src/libraries/TickMath.sol";
import {ModifyLiquidityParams} from "v4-core/src/types/PoolOperation.sol";
import {PoolSwapTest} from "v4-core/src/test/PoolSwapTest.sol";
import {PoolModifyLiquidityTest} from "v4-core/src/test/PoolModifyLiquidityTest.sol";
import {HookwireRules} from "../src/HookwireRules.sol";

contract DemoToken {
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

contract Seeder {
    constructor(IPoolManager pm, PoolKey memory key, DemoToken token, PoolModifyLiquidityTest lp) payable {
        token.mint(address(this), 1e27);
        token.approve(address(lp), type(uint256).max);
        lp.modifyLiquidity{value: msg.value}(
            key, ModifyLiquidityParams({tickLower: -887220, tickUpper: 887220, liquidityDelta: 5e21, salt: 0}), ""
        );
        pm; // silence
    }
}

/// LOCAL FORK ONLY. Deploys the rule contract plus a demo ETH/DEMO pool on an anvil fork, for end to end UI testing.
/// forge script script/LocalDemo.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
contract LocalDemo is Script {
    function run() external {
        require(block.chainid == 4663, "fork of Robinhood Chain only");
        IPoolManager pm = IPoolManager(0x8366a39CC670B4001A1121B8F6A443A643e40951);
        vm.deal(msg.sender, 1000 ether); // simulation only
        vm.startBroadcast(vm.envUint("PRIVATE_KEY"));
        HookwireRules rules = new HookwireRules(pm, address(0), 0);
        DemoToken token = new DemoToken();
        PoolSwapTest swapper = new PoolSwapTest(pm);
        PoolModifyLiquidityTest lp = new PoolModifyLiquidityTest(pm);
        PoolKey memory key = PoolKey(Currency.wrap(address(0)), Currency.wrap(address(token)), 3000, 60, IHooks(address(0)));
        pm.initialize(key, TickMath.getSqrtPriceAtTick(69060));
        token.mint(vm.addr(vm.envUint("PRIVATE_KEY")), 1e30);
        token.approve(address(swapper), type(uint256).max);
        new Seeder{value: 500 ether}(pm, key, token, lp);
        vm.stopBroadcast();
        console.log("RULES", address(rules));
        console.log("TOKEN", address(token));
        console.log("SWAPPER", address(swapper));
    }
}
