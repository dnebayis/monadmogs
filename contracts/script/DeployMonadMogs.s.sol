// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script} from "forge-std/Script.sol";
import {MonadMogs} from "../src/MonadMogs.sol";

contract DeployMonadMogs is Script {
    function run() external returns (MonadMogs mogs) {
        address initialOwner = vm.envAddress("INITIAL_OWNER");

        vm.startBroadcast();
        mogs = new MonadMogs(initialOwner);
        vm.stopBroadcast();
    }
}
