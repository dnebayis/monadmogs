// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";
import "../src/Mogs8004Adapter.sol";

contract DeployMogs8004Adapter is Script {
    address constant DEFAULT_MOGS_NFT = 0x1414f3BAF22404C42fD656af4aFAab4934045137;
    address constant ERC8004_IDR_MAINNET = 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432;
    address constant ERC8004_IDR_TESTNET = 0x8004A818BFB912233c491871b3d84c89A494BD9e;

    function run() external {
        address mogsNft = vm.envOr("MOGS_NFT_ADDRESS", DEFAULT_MOGS_NFT);
        address identityRegistry = vm.envOr(
            "ERC8004_IDENTITY_REGISTRY_ADDRESS",
            block.chainid == 10143 ? ERC8004_IDR_TESTNET : ERC8004_IDR_MAINNET
        );

        vm.startBroadcast();
        Mogs8004Adapter adapter = new Mogs8004Adapter(mogsNft, identityRegistry);
        vm.stopBroadcast();

        console.log("Mogs8004Adapter deployed:", address(adapter));
        console.log("NFT_CONTRACT:      ", adapter.NFT_CONTRACT());
        console.log("IDENTITY_REGISTRY: ", adapter.IDENTITY_REGISTRY());
        console.log("CHAIN_ID:          ", adapter.CHAIN_ID());
    }
}
