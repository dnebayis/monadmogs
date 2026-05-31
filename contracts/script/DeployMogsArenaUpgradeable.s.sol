// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {MogsArenaUpgradeable} from "../src/MogsArenaUpgradeable.sol";

contract DeployMogsArenaUpgradeable is Script {
    function run() external returns (MogsArenaUpgradeable implementation, ERC1967Proxy proxy) {
        address initialAdmin = vm.envOr("ARENA_ADMIN_ADDRESS", msg.sender);

        vm.startBroadcast();

        implementation = new MogsArenaUpgradeable();
        proxy = new ERC1967Proxy(
            address(implementation),
            abi.encodeCall(MogsArenaUpgradeable.initialize, (initialAdmin))
        );

        vm.stopBroadcast();

        console.log("MogsArenaUpgradeable implementation:", address(implementation));
        console.log("MogsArenaUpgradeable proxy:", address(proxy));
        console.log("Admin:", MogsArenaUpgradeable(payable(address(proxy))).admin());
    }
}
