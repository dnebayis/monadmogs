// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {Mogs8004Adapter} from "../src/Mogs8004Adapter.sol";
import {MockERC721} from "./MockERC721.sol";
import {MockERC8004IdentityRegistry} from "./MockERC8004IdentityRegistry.sol";

contract Mogs8004AdapterTest is Test {
    Mogs8004Adapter public adapter;
    MockERC721 public mogs;
    MockERC8004IdentityRegistry public registry;

    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");
    uint256 public constant MOG_ID = 123;

    function setUp() public {
        mogs = new MockERC721();
        registry = new MockERC8004IdentityRegistry();
        adapter = new Mogs8004Adapter(address(mogs), address(registry));
        mogs.mint(alice, MOG_ID);
    }

    function test_registerMogAgent_succeedsForMogOwner() public {
        vm.prank(alice);
        uint256 agentId = adapter.registerMogAgent(MOG_ID, "https://api.monadmogs.xyz/api/agents/metadata/123");

        assertEq(agentId, 1);
        assertEq(registry.ownerOf(agentId), address(adapter));
        assertEq(adapter.agentOf(MOG_ID), agentId);

        Mogs8004Adapter.Binding memory binding = adapter.bindingOf(agentId);
        assertEq(uint8(binding.standard), uint8(Mogs8004Adapter.TokenStandard.ERC721));
        assertEq(binding.tokenContract, address(mogs));
        assertEq(binding.tokenId, MOG_ID);

        assertEq(registry.getMetadata(agentId, "agent-binding"), abi.encodePacked(address(adapter)));
    }

    function test_adapterAcceptsSafeMintedERC8004AgentNft() public view {
        assertEq(
            adapter.onERC721Received(address(registry), address(0), 1, ""),
            bytes4(0x150b7a02)
        );
    }

    function test_registerMogAgent_revertsForNonOwner() public {
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(Mogs8004Adapter.NotMogOwner.selector, MOG_ID));
        adapter.registerMogAgent(MOG_ID, "uri");
    }

    function test_registerMogAgent_revertsForAlreadyAwakenedMog() public {
        vm.prank(alice);
        adapter.registerMogAgent(MOG_ID, "uri");

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Mogs8004Adapter.MogAlreadyAwakened.selector, MOG_ID, 1));
        adapter.registerMogAgent(MOG_ID, "uri2");
    }

    function test_mogTransferChangesControllerPermissions() public {
        vm.prank(alice);
        uint256 agentId = adapter.registerMogAgent(MOG_ID, "uri");

        assertTrue(adapter.isController(agentId, alice));
        assertFalse(adapter.isController(agentId, bob));

        vm.prank(alice);
        mogs.safeTransferFrom(alice, bob, MOG_ID);

        assertFalse(adapter.isController(agentId, alice));
        assertTrue(adapter.isController(agentId, bob));
        assertEq(adapter.controllerOf(agentId), bob);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Mogs8004Adapter.NotMogOwner.selector, MOG_ID));
        adapter.setAgentURI(agentId, "old-owner-uri");

        vm.prank(bob);
        adapter.setAgentURI(agentId, "new-owner-uri");
        assertEq(registry.tokenURI(agentId), "new-owner-uri");
    }

    function test_controllerCanSetNonReservedMetadata() public {
        vm.prank(alice);
        uint256 agentId = adapter.registerMogAgent(MOG_ID, "uri");

        vm.prank(alice);
        adapter.setAgentMetadata(agentId, "endpoint[restap]", bytes("https://api.monadmogs.xyz/api/agent-runtime/123"));

        assertEq(registry.getMetadata(agentId, "endpoint[restap]"), bytes("https://api.monadmogs.xyz/api/agent-runtime/123"));
    }

    function test_controllerCannotOverwriteAgentBindingMetadata() public {
        vm.prank(alice);
        uint256 agentId = adapter.registerMogAgent(MOG_ID, "uri");

        vm.prank(alice);
        vm.expectRevert(Mogs8004Adapter.ReservedMetadataKey.selector);
        adapter.setAgentMetadata(agentId, "agent-binding", abi.encodePacked(address(0xBEEF)));
    }
}
