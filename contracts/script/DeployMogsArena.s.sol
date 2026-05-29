// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {MogsArena} from "../src/MogsArena.sol";

contract DeployMogsArena is Script {
    function run() external {
        vm.startBroadcast();

        MogsArena arena = new MogsArena();
        console.log("MogsArena deployed at:", address(arena));
        console.log("Admin:", arena.admin());

        vm.stopBroadcast();
    }
}
