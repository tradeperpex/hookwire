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

contract TestToken {
    string public name = "Hookwire Test";
    string public symbol = "HWTEST";
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
    constructor(PoolKey memory key, TestToken token, PoolModifyLiquidityTest lp, uint128 liquidity) payable {
        token.mint(address(this), 1e24);
        token.approve(address(lp), type(uint256).max);
        lp.modifyLiquidity{value: msg.value}(
            key, ModifyLiquidityParams({tickLower: -887220, tickUpper: 887220, liquidityDelta: int256(uint256(liquidity)), salt: 0}), ""
        );
        (bool ok,) = msg.sender.call{value: address(this).balance}("");
        require(ok);
    }

    receive() external payable {}
}

/// Mainnet end to end test fixture. A throwaway ETH / HWTEST pool with a little liquidity, plus the
/// Uniswap test swap router, so a rule can be created, triggered and executed for real.
/// forge script script/E2EPool.s.sol --rpc-url $ROBINHOOD_RPC_URL --broadcast
contract E2EPool is Script {
    function run() external {
        require(block.chainid == 4663, "Robinhood Chain mainnet only");
        uint256 pk = vm.envUint("PRIVATE_KEY");
        IPoolManager pm = IPoolManager(0x8366a39CC670B4001A1121B8F6A443A643e40951);
        vm.startBroadcast(pk);
        TestToken token = new TestToken();
        PoolSwapTest swapper = new PoolSwapTest(pm);
        PoolModifyLiquidityTest lp = new PoolModifyLiquidityTest(pm);
        PoolKey memory key = PoolKey(Currency.wrap(address(0)), Currency.wrap(address(token)), 3000, 60, IHooks(address(0)));
        pm.initialize(key, TickMath.getSqrtPriceAtTick(69060));
        token.mint(vm.addr(pk), 100e18);
        token.approve(address(swapper), type(uint256).max);
        new Seeder{value: 0.0014 ether}(key, token, lp, 4e16);
        vm.stopBroadcast();
        console.log("TOKEN", address(token));
        console.log("SWAPPER", address(swapper));
        console.log("LP", address(lp));
    }
}
