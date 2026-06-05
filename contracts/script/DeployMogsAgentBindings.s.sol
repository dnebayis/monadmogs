// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";
import "../src/MogsAgentBindings.sol";

contract DeployMogsAgentBindings is Script {
    // Monad mainnet (chain ID 143)
    address constant MOGS_NFT      = 0x1414f3BAF22404C42fD656af4aFAab4934045137;
    address constant ERC8004_IDR   = 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432;

    function run() external {
        vm.startBroadcast();
        MogsAgentBindings bindings = new MogsAgentBindings(MOGS_NFT, ERC8004_IDR);
        vm.stopBroadcast();
        console.log("MogsAgentBindings deployed:", address(bindings));
        console.log("NFT_CONTRACT:      ", bindings.NFT_CONTRACT());
        console.log("IDENTITY_REGISTRY: ", bindings.IDENTITY_REGISTRY());
        console.log("CHAIN_ID:          ", bindings.CHAIN_ID());
    }
}
