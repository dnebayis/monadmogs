// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test, console} from "forge-std/Test.sol";
import {MogsArena} from "../src/MogsArena.sol";

contract MogsArenaTest is Test {
    MogsArena public arena;
    address public admin = address(this);
    address public player1 = makeAddr("player1");
    address public player2 = makeAddr("player2");
    address public attacker = makeAddr("attacker");

    uint256 constant ENTRY_FEE = 10 ether;
    uint256 constant SPONSOR = 0.5 ether;

    receive() external payable {}

    function setUp() public {
        arena = new MogsArena();
        vm.deal(admin, 100 ether);
        vm.deal(player1, 50 ether);
        vm.deal(player2, 50 ether);
        vm.deal(attacker, 50 ether);
    }

    /* ------------------------------------------------------------------ */
    /*  Pool Creation                                                       */
    /* ------------------------------------------------------------------ */

    function test_createPool() public {
        uint256 poolId = arena.createPool{value: SPONSOR}(ENTRY_FEE);
        assertEq(poolId, 1);
        assertEq(arena.poolCount(), 1);

        MogsArena.Pool memory pool = arena.getPool(1);
        assertEq(pool.sponsorPrize, SPONSOR);
        assertEq(pool.entryFee, ENTRY_FEE);
        assertEq(uint8(pool.status), 0); // Open
        assertEq(pool.player1, address(0));
        assertEq(pool.player2, address(0));
    }

    function test_createPool_zeroSponsor() public {
        uint256 poolId = arena.createPool{value: 0}(ENTRY_FEE);
        assertEq(poolId, 1);
        MogsArena.Pool memory pool = arena.getPool(1);
        assertEq(pool.sponsorPrize, 0);
    }

    function test_createPool_revert_notAdmin() public {
        vm.prank(attacker);
        vm.expectRevert(MogsArena.OnlyAdmin.selector);
        arena.createPool{value: SPONSOR}(ENTRY_FEE);
    }

    function test_createPool_revert_zeroEntryFee() public {
        vm.expectRevert(MogsArena.InvalidEntryFee.selector);
        arena.createPool{value: SPONSOR}(0);
    }

    function test_createPool_revert_entryFeeTooHigh() public {
        vm.expectRevert(MogsArena.InvalidEntryFee.selector);
        arena.createPool{value: SPONSOR}(101 ether);
    }

    /* ------------------------------------------------------------------ */
    /*  Join Pool                                                           */
    /* ------------------------------------------------------------------ */

    function test_joinPool_player1() public {
        arena.createPool{value: SPONSOR}(ENTRY_FEE);

        vm.prank(player1);
        arena.joinPool{value: ENTRY_FEE}(1);

        MogsArena.Pool memory pool = arena.getPool(1);
        assertEq(pool.player1, player1);
        assertEq(pool.player2, address(0));
        assertEq(uint8(pool.status), 0); // still Open
    }

    function test_joinPool_bothPlayers() public {
        arena.createPool{value: SPONSOR}(ENTRY_FEE);

        vm.prank(player1);
        arena.joinPool{value: ENTRY_FEE}(1);

        vm.prank(player2);
        arena.joinPool{value: ENTRY_FEE}(1);

        MogsArena.Pool memory pool = arena.getPool(1);
        assertEq(pool.player1, player1);
        assertEq(pool.player2, player2);
        assertEq(uint8(pool.status), 1); // Full
    }

    function test_joinPool_revert_wrongFee() public {
        arena.createPool{value: SPONSOR}(ENTRY_FEE);

        vm.prank(player1);
        vm.expectRevert(MogsArena.WrongEntryFee.selector);
        arena.joinPool{value: 5 ether}(1);
    }

    function test_joinPool_revert_samePlayer() public {
        arena.createPool{value: SPONSOR}(ENTRY_FEE);

        vm.prank(player1);
        arena.joinPool{value: ENTRY_FEE}(1);

        vm.prank(player1);
        vm.expectRevert(MogsArena.AlreadyJoined.selector);
        arena.joinPool{value: ENTRY_FEE}(1);
    }

    function test_joinPool_revert_poolFull() public {
        arena.createPool{value: SPONSOR}(ENTRY_FEE);

        vm.prank(player1);
        arena.joinPool{value: ENTRY_FEE}(1);

        vm.prank(player2);
        arena.joinPool{value: ENTRY_FEE}(1);

        vm.prank(attacker);
        vm.expectRevert(MogsArena.PoolNotOpen.selector);
        arena.joinPool{value: ENTRY_FEE}(1);
    }

    /* ------------------------------------------------------------------ */
    /*  Resolve Pool                                                        */
    /* ------------------------------------------------------------------ */

    function test_resolvePool_player1Wins() public {
        arena.createPool{value: SPONSOR}(ENTRY_FEE);

        vm.prank(player1);
        arena.joinPool{value: ENTRY_FEE}(1);
        vm.prank(player2);
        arena.joinPool{value: ENTRY_FEE}(1);

        uint256 p1Before = player1.balance;

        arena.resolvePool(1, player1);

        MogsArena.Pool memory pool = arena.getPool(1);
        assertEq(pool.winner, player1);
        assertEq(uint8(pool.status), 2); // Resolved

        // Prize = sponsor + 2*entry - 5% of entries
        // 0.5 + 20 - 1 = 19.5 ether
        uint256 expectedPrize = SPONSOR + (ENTRY_FEE * 2) - (ENTRY_FEE * 2 * 5 / 100);
        assertEq(player1.balance - p1Before, expectedPrize);
        assertEq(arena.feeCollected(), ENTRY_FEE * 2 * 5 / 100);
    }

    function test_resolvePool_player2Wins() public {
        arena.createPool{value: SPONSOR}(ENTRY_FEE);

        vm.prank(player1);
        arena.joinPool{value: ENTRY_FEE}(1);
        vm.prank(player2);
        arena.joinPool{value: ENTRY_FEE}(1);

        uint256 p2Before = player2.balance;
        arena.resolvePool(1, player2);

        uint256 expectedPrize = SPONSOR + (ENTRY_FEE * 2) - (ENTRY_FEE * 2 * 5 / 100);
        assertEq(player2.balance - p2Before, expectedPrize);
    }

    function test_resolvePool_revert_notAdmin() public {
        arena.createPool{value: SPONSOR}(ENTRY_FEE);
        vm.prank(player1);
        arena.joinPool{value: ENTRY_FEE}(1);
        vm.prank(player2);
        arena.joinPool{value: ENTRY_FEE}(1);

        vm.prank(attacker);
        vm.expectRevert(MogsArena.OnlyAdmin.selector);
        arena.resolvePool(1, player1);
    }

    function test_resolvePool_revert_notFull() public {
        arena.createPool{value: SPONSOR}(ENTRY_FEE);
        vm.prank(player1);
        arena.joinPool{value: ENTRY_FEE}(1);

        vm.expectRevert(MogsArena.PoolNotFull.selector);
        arena.resolvePool(1, player1);
    }

    function test_resolvePool_revert_invalidWinner() public {
        arena.createPool{value: SPONSOR}(ENTRY_FEE);
        vm.prank(player1);
        arena.joinPool{value: ENTRY_FEE}(1);
        vm.prank(player2);
        arena.joinPool{value: ENTRY_FEE}(1);

        vm.expectRevert(MogsArena.InvalidWinner.selector);
        arena.resolvePool(1, attacker);
    }

    function test_resolvePool_revert_doubleResolve() public {
        arena.createPool{value: SPONSOR}(ENTRY_FEE);
        vm.prank(player1);
        arena.joinPool{value: ENTRY_FEE}(1);
        vm.prank(player2);
        arena.joinPool{value: ENTRY_FEE}(1);

        arena.resolvePool(1, player1);

        vm.expectRevert(MogsArena.PoolNotFull.selector);
        arena.resolvePool(1, player2);
    }

    /* ------------------------------------------------------------------ */
    /*  Cancel Pool                                                         */
    /* ------------------------------------------------------------------ */

    function test_cancelPool_open_noPlayers() public {
        arena.createPool{value: SPONSOR}(ENTRY_FEE);

        uint256 adminBefore = admin.balance;
        arena.cancelPool(1);

        assertEq(uint8(arena.getPool(1).status), 3); // Cancelled
        assertEq(admin.balance - adminBefore, SPONSOR);
    }

    function test_cancelPool_open_onePlayer() public {
        arena.createPool{value: SPONSOR}(ENTRY_FEE);
        vm.prank(player1);
        arena.joinPool{value: ENTRY_FEE}(1);

        uint256 p1Before = player1.balance;
        uint256 adminBefore = admin.balance;
        arena.cancelPool(1);

        assertEq(player1.balance - p1Before, ENTRY_FEE);
        assertEq(admin.balance - adminBefore, SPONSOR);
    }

    function test_cancelPool_full_refundsBoth() public {
        arena.createPool{value: SPONSOR}(ENTRY_FEE);
        vm.prank(player1);
        arena.joinPool{value: ENTRY_FEE}(1);
        vm.prank(player2);
        arena.joinPool{value: ENTRY_FEE}(1);

        uint256 p1Before = player1.balance;
        uint256 p2Before = player2.balance;
        uint256 adminBefore = admin.balance;

        arena.cancelPool(1);

        assertEq(player1.balance - p1Before, ENTRY_FEE);
        assertEq(player2.balance - p2Before, ENTRY_FEE);
        assertEq(admin.balance - adminBefore, SPONSOR);
    }

    function test_cancelPool_revert_notAdmin() public {
        arena.createPool{value: SPONSOR}(ENTRY_FEE);

        vm.prank(attacker);
        vm.expectRevert(MogsArena.OnlyAdmin.selector);
        arena.cancelPool(1);
    }

    function test_cancelPool_revert_alreadyResolved() public {
        arena.createPool{value: SPONSOR}(ENTRY_FEE);
        vm.prank(player1);
        arena.joinPool{value: ENTRY_FEE}(1);
        vm.prank(player2);
        arena.joinPool{value: ENTRY_FEE}(1);
        arena.resolvePool(1, player1);

        vm.expectRevert(MogsArena.PoolNotOpen.selector);
        arena.cancelPool(1);
    }

    function test_cancelPool_revert_alreadyCancelled() public {
        arena.createPool{value: SPONSOR}(ENTRY_FEE);
        arena.cancelPool(1);

        vm.expectRevert(MogsArena.PoolNotOpen.selector);
        arena.cancelPool(1);
    }

    /* ------------------------------------------------------------------ */
    /*  Withdraw Fees                                                       */
    /* ------------------------------------------------------------------ */

    function test_withdrawFees() public {
        arena.createPool{value: SPONSOR}(ENTRY_FEE);
        vm.prank(player1);
        arena.joinPool{value: ENTRY_FEE}(1);
        vm.prank(player2);
        arena.joinPool{value: ENTRY_FEE}(1);
        arena.resolvePool(1, player1);

        uint256 fees = arena.feeCollected();
        assertGt(fees, 0);

        uint256 adminBefore = admin.balance;
        arena.withdrawFees();

        assertEq(admin.balance - adminBefore, fees);
        assertEq(arena.feeCollected(), 0);
    }

    function test_withdrawFees_revert_notAdmin() public {
        vm.prank(attacker);
        vm.expectRevert(MogsArena.OnlyAdmin.selector);
        arena.withdrawFees();
    }

    /* ------------------------------------------------------------------ */
    /*  View: getTotalPrize                                                 */
    /* ------------------------------------------------------------------ */

    function test_getTotalPrize() public {
        arena.createPool{value: SPONSOR}(ENTRY_FEE);
        uint256 prize = arena.getTotalPrize(1);
        // 0.5 + 20 - 1 = 19.5
        assertEq(prize, SPONSOR + (ENTRY_FEE * 2) - (ENTRY_FEE * 2 * 5 / 100));
    }

    /* ------------------------------------------------------------------ */
    /*  Multiple Pools                                                      */
    /* ------------------------------------------------------------------ */

    function test_multiplePools() public {
        arena.createPool{value: 1 ether}(5 ether);
        arena.createPool{value: 2 ether}(10 ether);
        assertEq(arena.poolCount(), 2);

        MogsArena.Pool memory p1 = arena.getPool(1);
        MogsArena.Pool memory p2 = arena.getPool(2);
        assertEq(p1.entryFee, 5 ether);
        assertEq(p2.entryFee, 10 ether);
    }
}
