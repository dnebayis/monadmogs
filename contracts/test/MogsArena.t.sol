// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {MogsArena} from "../src/MogsArena.sol";
import {MockERC721} from "./MockERC721.sol";

contract MogsArenaTest is Test {
    MogsArena public arena;
    MockERC721 public nft;
    address public adm = address(this);
    address public p1 = makeAddr("player1");
    address public p2 = makeAddr("player2");
    address public attacker = makeAddr("attacker");

    uint256 constant ENTRY = 10 ether;
    uint256 constant SPONSOR = 0.5 ether;
    bytes32 constant HASH = keccak256("game-001");
    bytes32 constant HASH2 = keccak256("game-002");

    receive() external payable {}

    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return this.onERC721Received.selector;
    }

    function setUp() public {
        arena = new MogsArena();
        nft = new MockERC721();
        vm.deal(adm, 200 ether);
        vm.deal(p1, 50 ether);
        vm.deal(p2, 50 ether);
        vm.deal(attacker, 50 ether);
    }

    /* ---- Create ---- */

    function test_createMatch() public {
        uint256 id = arena.createMatch{value: SPONSOR}(ENTRY, HASH);
        assertEq(id, 1);
        MogsArena.Match memory m = arena.getMatch(1);
        assertEq(m.sponsorPrize, SPONSOR);
        assertEq(m.entryFee, ENTRY);
        assertEq(m.gameHash, HASH);
        assertEq(uint8(m.status), 0);
        assertGt(m.deadline, block.timestamp);
    }

    function test_createMatch_revert_notAdmin() public {
        vm.prank(attacker);
        vm.expectRevert(MogsArena.OnlyAdmin.selector);
        arena.createMatch{value: SPONSOR}(ENTRY, HASH);
    }

    function test_createMatch_revert_feeTooLow() public {
        vm.expectRevert(MogsArena.InvalidEntryFee.selector);
        arena.createMatch{value: SPONSOR}(0.0001 ether, HASH);
    }

    function test_createMatch_revert_feeTooHigh() public {
        vm.expectRevert(MogsArena.InvalidEntryFee.selector);
        arena.createMatch{value: SPONSOR}(101 ether, HASH);
    }

    function test_createMatch_revert_zeroHash() public {
        vm.expectRevert(MogsArena.InvalidGameHash.selector);
        arena.createMatch{value: SPONSOR}(ENTRY, bytes32(0));
    }

    /* ---- Join ---- */

    function test_joinMatch_p1() public {
        arena.createMatch{value: SPONSOR}(ENTRY, HASH);
        vm.prank(p1);
        arena.joinMatch{value: ENTRY}(1);
        MogsArena.Match memory m = arena.getMatch(1);
        assertEq(m.player1, p1);
        assertEq(uint8(m.status), 0);
    }

    function test_joinMatch_bothPlayers() public {
        arena.createMatch{value: SPONSOR}(ENTRY, HASH);
        vm.prank(p1);
        arena.joinMatch{value: ENTRY}(1);
        vm.prank(p2);
        arena.joinMatch{value: ENTRY}(1);
        MogsArena.Match memory m = arena.getMatch(1);
        assertEq(m.player1, p1);
        assertEq(m.player2, p2);
        assertEq(uint8(m.status), 1); // Full
    }

    function test_joinMatch_revert_wrongFee() public {
        arena.createMatch{value: SPONSOR}(ENTRY, HASH);
        vm.prank(p1);
        vm.expectRevert(MogsArena.WrongEntryFee.selector);
        arena.joinMatch{value: 5 ether}(1);
    }

    function test_joinMatch_revert_samePlayer() public {
        arena.createMatch{value: SPONSOR}(ENTRY, HASH);
        vm.prank(p1);
        arena.joinMatch{value: ENTRY}(1);
        vm.prank(p1);
        vm.expectRevert(MogsArena.AlreadyJoined.selector);
        arena.joinMatch{value: ENTRY}(1);
    }

    function test_joinMatch_revert_alreadyInMatch() public {
        arena.createMatch{value: SPONSOR}(ENTRY, HASH);
        arena.createMatch{value: SPONSOR}(ENTRY, HASH2);
        vm.prank(p1);
        arena.joinMatch{value: ENTRY}(1);
        vm.prank(p1);
        vm.expectRevert(MogsArena.AlreadyInMatch.selector);
        arena.joinMatch{value: ENTRY}(2);
    }

    function test_joinMatch_revert_fullMatch() public {
        arena.createMatch{value: SPONSOR}(ENTRY, HASH);
        vm.prank(p1);
        arena.joinMatch{value: ENTRY}(1);
        vm.prank(p2);
        arena.joinMatch{value: ENTRY}(1);
        vm.prank(attacker);
        vm.expectRevert(MogsArena.MatchNotOpen.selector);
        arena.joinMatch{value: ENTRY}(1);
    }

    /* ---- Resolve ---- */

    function _createFullMatch() internal returns (uint256) {
        uint256 id = arena.createMatch{value: SPONSOR}(ENTRY, HASH);
        vm.prank(p1);
        arena.joinMatch{value: ENTRY}(id);
        vm.prank(p2);
        arena.joinMatch{value: ENTRY}(id);
        return id;
    }

    function test_resolveMatch_p1Wins() public {
        uint256 id = _createFullMatch();
        uint256 p1Before = p1.balance;
        arena.resolveMatch(id, p1);

        MogsArena.Match memory m = arena.getMatch(id);
        assertEq(m.winner, p1);
        assertEq(uint8(m.status), 2); // Resolved

        uint256 expectedPrize = SPONSOR + (ENTRY * 2) - (ENTRY * 2 * 500 / 10000);
        assertEq(p1.balance - p1Before, expectedPrize);
    }

    function test_resolveMatch_p2Wins() public {
        uint256 id = _createFullMatch();
        uint256 p2Before = p2.balance;
        arena.resolveMatch(id, p2);
        uint256 expectedPrize = SPONSOR + (ENTRY * 2) - (ENTRY * 2 * 500 / 10000);
        assertEq(p2.balance - p2Before, expectedPrize);
    }

    function test_resolveMatch_revert_notAdmin() public {
        uint256 id = _createFullMatch();
        vm.prank(attacker);
        vm.expectRevert(MogsArena.OnlyAdmin.selector);
        arena.resolveMatch(id, p1);
    }

    function test_resolveMatch_revert_notFull() public {
        arena.createMatch{value: SPONSOR}(ENTRY, HASH);
        vm.prank(p1);
        arena.joinMatch{value: ENTRY}(1);
        vm.expectRevert(MogsArena.MatchNotFull.selector);
        arena.resolveMatch(1, p1);
    }

    function test_resolveMatch_revert_invalidWinner() public {
        uint256 id = _createFullMatch();
        vm.expectRevert(MogsArena.InvalidWinner.selector);
        arena.resolveMatch(id, attacker);
    }

    function test_resolveMatch_revert_doubleResolve() public {
        uint256 id = _createFullMatch();
        arena.resolveMatch(id, p1);
        vm.expectRevert(MogsArena.MatchNotFull.selector);
        arena.resolveMatch(id, p2);
    }

    function test_resolveMatch_clearsActiveMatch() public {
        uint256 id = _createFullMatch();
        assertEq(arena.activeMatch(p1), id);
        assertEq(arena.activeMatch(p2), id);
        arena.resolveMatch(id, p1);
        assertEq(arena.activeMatch(p1), 0);
        assertEq(arena.activeMatch(p2), 0);
    }

    function test_resolveMatch_playerCanJoinNewMatch() public {
        uint256 id1 = _createFullMatch();
        arena.resolveMatch(id1, p1);

        uint256 id2 = arena.createMatch{value: SPONSOR}(ENTRY, HASH2);
        vm.prank(p1);
        arena.joinMatch{value: ENTRY}(id2);
        assertEq(arena.activeMatch(p1), id2);
    }

    /* ---- Draw ---- */

    function test_resolveDraw() public {
        uint256 id = _createFullMatch();
        uint256 p1Before = p1.balance;
        uint256 p2Before = p2.balance;
        arena.resolveDraw(id);

        MogsArena.Match memory m = arena.getMatch(id);
        assertEq(uint8(m.status), 3); // Draw

        uint256 refundEach = ENTRY + (SPONSOR / 2);
        assertEq(p1.balance - p1Before, refundEach);
        assertEq(p2.balance - p2Before, refundEach);
    }

    function test_resolveDraw_revert_notFull() public {
        arena.createMatch{value: SPONSOR}(ENTRY, HASH);
        vm.expectRevert(MogsArena.MatchNotFull.selector);
        arena.resolveDraw(1);
    }

    /* ---- Cancel ---- */

    function test_cancelMatch_open() public {
        arena.createMatch{value: SPONSOR}(ENTRY, HASH);
        uint256 admBefore = adm.balance;
        arena.cancelMatch(1);
        assertEq(uint8(arena.getMatch(1).status), 4); // Cancelled
        assertEq(adm.balance - admBefore, SPONSOR);
    }

    function test_cancelMatch_onePlayer() public {
        arena.createMatch{value: SPONSOR}(ENTRY, HASH);
        vm.prank(p1);
        arena.joinMatch{value: ENTRY}(1);
        uint256 p1Before = p1.balance;
        arena.cancelMatch(1);
        assertEq(p1.balance - p1Before, ENTRY);
    }

    function test_cancelMatch_full() public {
        uint256 id = _createFullMatch();
        uint256 p1Before = p1.balance;
        uint256 p2Before = p2.balance;
        arena.cancelMatch(id);
        assertEq(p1.balance - p1Before, ENTRY);
        assertEq(p2.balance - p2Before, ENTRY);
    }

    function test_cancelMatch_revert_resolved() public {
        uint256 id = _createFullMatch();
        arena.resolveMatch(id, p1);
        vm.expectRevert(MogsArena.MatchNotOpen.selector);
        arena.cancelMatch(id);
    }

    /* ---- Expire ---- */

    function test_expireMatch() public {
        arena.createMatch{value: SPONSOR}(ENTRY, HASH);
        vm.prank(p1);
        arena.joinMatch{value: ENTRY}(1);

        uint256 p1Before = p1.balance;
        vm.warp(block.timestamp + 2 hours + 1);

        // Anyone can expire
        vm.prank(attacker);
        arena.expireMatch(1);

        assertEq(uint8(arena.getMatch(1).status), 5); // Expired
        assertEq(p1.balance - p1Before, ENTRY);
    }

    function test_expireMatch_revert_notExpired() public {
        arena.createMatch{value: SPONSOR}(ENTRY, HASH);
        vm.expectRevert(MogsArena.MatchNotExpired.selector);
        arena.expireMatch(1);
    }

    function test_expireMatch_full() public {
        uint256 id = _createFullMatch();
        uint256 p1Before = p1.balance;
        uint256 p2Before = p2.balance;
        vm.warp(block.timestamp + 2 hours + 1);
        arena.expireMatch(id);
        assertEq(p1.balance - p1Before, ENTRY);
        assertEq(p2.balance - p2Before, ENTRY);
    }

    /* ---- Withdraw ---- */

    function test_withdrawFees() public {
        uint256 id = _createFullMatch();
        arena.resolveMatch(id, p1);
        uint256 fees = arena.feeCollected();
        assertGt(fees, 0);
        uint256 admBefore = adm.balance;
        arena.withdrawFees();
        assertEq(adm.balance - admBefore, fees);
        assertEq(arena.feeCollected(), 0);
    }

    function test_withdrawFees_revert_noFees() public {
        vm.expectRevert(MogsArena.NoFeesToWithdraw.selector);
        arena.withdrawFees();
    }

    /* ---- Views ---- */

    function test_getTotalPrize() public {
        arena.createMatch{value: SPONSOR}(ENTRY, HASH);
        uint256 prize = arena.getTotalPrize(1);
        assertEq(prize, SPONSOR + (ENTRY * 2) - (ENTRY * 2 * 500 / 10000));
    }

    function test_isMatchExpired() public {
        arena.createMatch{value: SPONSOR}(ENTRY, HASH);
        assertFalse(arena.isMatchExpired(1));
        vm.warp(block.timestamp + 2 hours + 1);
        assertTrue(arena.isMatchExpired(1));
    }

    /* ---- Pause ---- */

    function test_pause() public {
        arena.pause();
        assertTrue(arena.paused());
    }

    function test_pause_blocksCreate() public {
        arena.pause();
        vm.expectRevert(MogsArena.ContractPaused.selector);
        arena.createMatch{value: SPONSOR}(ENTRY, HASH);
    }

    function test_pause_blocksJoin() public {
        arena.createMatch{value: SPONSOR}(ENTRY, HASH);
        arena.pause();
        vm.prank(p1);
        vm.expectRevert(MogsArena.ContractPaused.selector);
        arena.joinMatch{value: ENTRY}(1);
    }

    function test_unpause() public {
        arena.pause();
        arena.unpause();
        arena.createMatch{value: SPONSOR}(ENTRY, HASH);
        assertEq(arena.matchCount(), 1);
    }

    function test_pause_revert_notAdmin() public {
        vm.prank(attacker);
        vm.expectRevert(MogsArena.OnlyAdmin.selector);
        arena.pause();
    }

    function test_pause_resolveStillWorks() public {
        uint256 id = _createFullMatch();
        arena.pause();
        // resolve should still work when paused (to settle existing matches)
        arena.resolveMatch(id, p1);
        assertEq(uint8(arena.getMatch(id).status), 2);
    }

    /* ---- NFT Prize ---- */

    function _mintAndApproveNft(uint256 tokenId) internal {
        nft.mint(adm, tokenId);
        nft.approve(address(arena), tokenId);
    }

    function test_createMatchWithNft() public {
        _mintAndApproveNft(42);
        uint256 id = arena.createMatchWithNft{value: SPONSOR}(ENTRY, HASH, address(nft), 42);
        assertEq(id, 1);
        assertEq(nft.ownerOf(42), address(arena));
        (address col, uint256 tid) = arena.getMatchNftPrize(1);
        assertEq(col, address(nft));
        assertEq(tid, 42);
    }

    function test_resolveMatch_nftGoesToWinner() public {
        _mintAndApproveNft(42);
        arena.createMatchWithNft{value: SPONSOR}(ENTRY, HASH, address(nft), 42);
        vm.prank(p1);
        arena.joinMatch{value: ENTRY}(1);
        vm.prank(p2);
        arena.joinMatch{value: ENTRY}(1);

        arena.resolveMatch(1, p1);
        assertEq(nft.ownerOf(42), p1);
    }

    function test_resolveDraw_nftReturnsToAdmin() public {
        _mintAndApproveNft(42);
        arena.createMatchWithNft{value: SPONSOR}(ENTRY, HASH, address(nft), 42);
        vm.prank(p1);
        arena.joinMatch{value: ENTRY}(1);
        vm.prank(p2);
        arena.joinMatch{value: ENTRY}(1);

        arena.resolveDraw(1);
        assertEq(nft.ownerOf(42), adm);
    }

    function test_cancelMatch_nftReturnsToAdmin() public {
        _mintAndApproveNft(42);
        arena.createMatchWithNft{value: SPONSOR}(ENTRY, HASH, address(nft), 42);
        arena.cancelMatch(1);
        assertEq(nft.ownerOf(42), adm);
    }

    function test_expireMatch_nftReturnsToAdmin() public {
        _mintAndApproveNft(42);
        arena.createMatchWithNft{value: SPONSOR}(ENTRY, HASH, address(nft), 42);
        vm.warp(block.timestamp + 2 hours + 1);
        arena.expireMatch(1);
        assertEq(nft.ownerOf(42), adm);
    }

    function test_createMatch_noNft() public {
        arena.createMatch{value: SPONSOR}(ENTRY, HASH);
        (address col, uint256 tid) = arena.getMatchNftPrize(1);
        assertEq(col, address(0));
        assertEq(tid, 0);
    }

    /* ---- Multiple Matches ---- */

    function test_multipleMatches() public {
        arena.createMatch{value: 1 ether}(5 ether, HASH);
        arena.createMatch{value: 2 ether}(10 ether, HASH2);
        assertEq(arena.matchCount(), 2);
    }
}
