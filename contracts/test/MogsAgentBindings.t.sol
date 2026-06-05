// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {MogsAgentBindings} from "../src/MogsAgentBindings.sol";
import {MockERC721} from "./MockERC721.sol";

contract MogsAgentBindingsTest is Test {
    MogsAgentBindings public bindings;
    MockERC721 public mogNft;
    MockERC721 public identityRegistry;

    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");

    // Agent token IDs
    uint256 constant AGENT_1 = 1;
    uint256 constant AGENT_2 = 2;

    // Mog token IDs
    uint256 constant MOG_1 = 100;
    uint256 constant MOG_2 = 200;

    function setUp() public {
        mogNft = new MockERC721();
        identityRegistry = new MockERC721();
        bindings = new MogsAgentBindings(address(mogNft), address(identityRegistry));
    }

    // -----------------------------------------------------------------------
    // Immutable addresses
    // -----------------------------------------------------------------------

    function test_immutables_setCorrectly() public view {
        assertEq(bindings.NFT_CONTRACT(), address(mogNft));
        assertEq(bindings.IDENTITY_REGISTRY(), address(identityRegistry));
        assertEq(bindings.CHAIN_ID(), block.chainid);
    }

    // -----------------------------------------------------------------------
    // Happy path: bind
    // -----------------------------------------------------------------------

    function test_bind_succeedsWhenCallerOwnsBoth() public {
        identityRegistry.mint(alice, AGENT_1);
        mogNft.mint(alice, MOG_1);

        vm.prank(alice);
        bindings.bind(AGENT_1, MOG_1);

        // isBound returns true after bind
        assertTrue(bindings.isBound(AGENT_1));
    }

    function test_bindingOf_returnsCorrectStructAfterBind() public {
        identityRegistry.mint(alice, AGENT_1);
        mogNft.mint(alice, MOG_1);

        vm.prank(alice);
        bindings.bind(AGENT_1, MOG_1);

        MogsAgentBindings.Binding memory b = bindings.bindingOf(AGENT_1);
        assertEq(uint8(b.standard), uint8(MogsAgentBindings.TokenStandard.ERC721));
        assertEq(b.tokenContract, address(mogNft));
        assertEq(b.tokenId, MOG_1);
    }

    function test_agentOf_returnsCorrectAgentIdAfterBind() public {
        identityRegistry.mint(alice, AGENT_1);
        mogNft.mint(alice, MOG_1);

        vm.prank(alice);
        bindings.bind(AGENT_1, MOG_1);

        assertEq(bindings.agentOf(MOG_1), AGENT_1);
    }

    function test_isBound_falseBeforeBindTrueAfter() public {
        identityRegistry.mint(alice, AGENT_1);
        mogNft.mint(alice, MOG_1);

        assertFalse(bindings.isBound(AGENT_1));

        vm.prank(alice);
        bindings.bind(AGENT_1, MOG_1);

        assertTrue(bindings.isBound(AGENT_1));
    }

    function test_bind_emitsAgentBoundWithCorrectArgs() public {
        identityRegistry.mint(alice, AGENT_1);
        mogNft.mint(alice, MOG_1);

        vm.prank(alice);
        vm.expectEmit(true, true, true, true);
        emit MogsAgentBindings.AgentBound(
            AGENT_1,
            MogsAgentBindings.TokenStandard.ERC721,
            address(mogNft),
            MOG_1,
            alice
        );
        bindings.bind(AGENT_1, MOG_1);
    }

    // -----------------------------------------------------------------------
    // Reverts
    // -----------------------------------------------------------------------

    function test_revert_AlreadyBound_cannotBindSameAgentTwice() public {
        identityRegistry.mint(alice, AGENT_1);
        mogNft.mint(alice, MOG_1);
        mogNft.mint(alice, MOG_2);

        vm.startPrank(alice);
        bindings.bind(AGENT_1, MOG_1);

        vm.expectRevert(abi.encodeWithSelector(MogsAgentBindings.AlreadyBound.selector, AGENT_1));
        bindings.bind(AGENT_1, MOG_2);
        vm.stopPrank();
    }

    function test_revert_MogAlreadyBound_cannotBindSameMogToDifferentAgent() public {
        identityRegistry.mint(alice, AGENT_1);
        identityRegistry.mint(alice, AGENT_2);
        mogNft.mint(alice, MOG_1);

        vm.startPrank(alice);
        bindings.bind(AGENT_1, MOG_1);

        vm.expectRevert(abi.encodeWithSelector(MogsAgentBindings.MogAlreadyBound.selector, MOG_1, AGENT_1));
        bindings.bind(AGENT_2, MOG_1);
        vm.stopPrank();
    }

    function test_revert_NotAgentOwner_callerDoesNotOwnAgent() public {
        // alice owns the agent, bob tries to bind
        identityRegistry.mint(alice, AGENT_1);
        mogNft.mint(bob, MOG_1);

        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(MogsAgentBindings.NotAgentOwner.selector, AGENT_1));
        bindings.bind(AGENT_1, MOG_1);
    }

    function test_revert_NotMogOwner_callerDoesNotOwnMog() public {
        // bob owns the mog, alice tries to bind
        identityRegistry.mint(alice, AGENT_1);
        mogNft.mint(bob, MOG_1);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(MogsAgentBindings.NotMogOwner.selector, MOG_1));
        bindings.bind(AGENT_1, MOG_1);
    }

    // -----------------------------------------------------------------------
    // Different caller cannot bind someone else's pair
    // -----------------------------------------------------------------------

    function test_revert_differentCallerCannotBindElsesPair() public {
        identityRegistry.mint(alice, AGENT_1);
        mogNft.mint(alice, MOG_1);

        // bob attempts to bind alice's agent to alice's mog
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(MogsAgentBindings.NotAgentOwner.selector, AGENT_1));
        bindings.bind(AGENT_1, MOG_1);
    }

    // -----------------------------------------------------------------------
    // Two different agents can each bind to their own Mog (independent)
    // -----------------------------------------------------------------------

    function test_twoIndependentBindingsWork() public {
        identityRegistry.mint(alice, AGENT_1);
        mogNft.mint(alice, MOG_1);

        identityRegistry.mint(bob, AGENT_2);
        mogNft.mint(bob, MOG_2);

        vm.prank(alice);
        bindings.bind(AGENT_1, MOG_1);

        vm.prank(bob);
        bindings.bind(AGENT_2, MOG_2);

        assertTrue(bindings.isBound(AGENT_1));
        assertTrue(bindings.isBound(AGENT_2));

        assertEq(bindings.agentOf(MOG_1), AGENT_1);
        assertEq(bindings.agentOf(MOG_2), AGENT_2);

        MogsAgentBindings.Binding memory b1 = bindings.bindingOf(AGENT_1);
        assertEq(b1.tokenId, MOG_1);

        MogsAgentBindings.Binding memory b2 = bindings.bindingOf(AGENT_2);
        assertEq(b2.tokenId, MOG_2);
    }

    // -----------------------------------------------------------------------
    // View helpers on unbound agents
    // -----------------------------------------------------------------------

    function test_bindingOf_returnsEmptyForUnboundAgent() public view {
        MogsAgentBindings.Binding memory b = bindings.bindingOf(AGENT_1);
        assertEq(b.tokenContract, address(0));
        assertEq(b.tokenId, 0);
    }

    function test_agentOf_returnsZeroForUnboundMog() public view {
        assertEq(bindings.agentOf(MOG_1), 0);
    }
}
