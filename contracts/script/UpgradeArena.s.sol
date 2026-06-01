// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {MogsArenaUpgradeable} from "../src/MogsArenaUpgradeable.sol";

contract UpgradeArena is Script {
    function run() external {
        address proxy = vm.envOr("ARENA_PROXY", address(0x328a9D6060Ce914e3ba707fBDa453cb8dB39f5C9));

        vm.startBroadcast();

        MogsArenaUpgradeable newImpl = new MogsArenaUpgradeable();
        console.log("New implementation:", address(newImpl));

        MogsArenaUpgradeable(payable(proxy)).upgradeToAndCall(address(newImpl), "");
        console.log("Proxy upgraded:", proxy);

        vm.stopBroadcast();
    }
}
