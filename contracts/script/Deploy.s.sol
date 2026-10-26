// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {HookwireRules} from "../src/HookwireRules.sol";

/// forge script script/Deploy.s.sol --rpc-url $ROBINHOOD_RPC_URL --broadcast
/// Env. PRIVATE_KEY (deployer, pays gas only). TREASURY (optional). PROTOCOL_FEE_BPS (optional, default 0).
contract Deploy is Script {
    address constant POOL_MANAGER = 0x8366a39CC670B4001A1121B8F6A443A643e40951;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address treasury = vm.envOr("TREASURY", address(0));
        uint16 feeBps = uint16(vm.envOr("PROTOCOL_FEE_BPS", uint256(0)));
        require(block.chainid == 4663, "not Robinhood Chain mainnet");
        vm.startBroadcast(pk);
        HookwireRules rules = new HookwireRules(IPoolManager(POOL_MANAGER), treasury, feeBps);
        vm.stopBroadcast();
        console.log("HookwireRules", address(rules));
    }
}
