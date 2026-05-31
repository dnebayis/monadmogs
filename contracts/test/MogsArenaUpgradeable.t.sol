// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {MogsArenaUpgradeable} from "../src/MogsArenaUpgradeable.sol";
import {MockERC20} from "./MockERC20.sol";
import {MockERC721} from "./MockERC721.sol";
import {RevertingReceiver} from "./RevertingReceiver.sol";

contract MogsArenaUpgradeableTest is Test {
    MogsArenaUpgradeable public arena;
    MockERC20 public mogs;
    MockERC721 public nft;

    address public adm = address(this);
    address public p1 = makeAddr("player1");
    address public p2 = makeAddr("player2");
    address public attacker = makeAddr("attacker");

    uint256 constant ENTRY = 0.01 ether;
    uint256 constant SPONSOR = 0.5 ether;
    uint256 constant TOKEN_PRIZE = 1000 ether;
    bytes32 constant HASH = keccak256("game-001");

    receive() external payable {}

    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return this.onERC721Received.selector;
    }

    function setUp() public {
        MogsArenaUpgradeable impl = new MogsArenaUpgradeable();
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), abi.encodeCall(MogsArenaUpgradeable.initialize, (adm)));
        arena = MogsArenaUpgradeable(payable(address(proxy)));

        mogs = new MockERC20();
        nft = new MockERC721();
        mogs.mint(adm, 10_000 ether);

        vm.deal(adm, 200 ether);
        vm.deal(p1, 50 ether);
        vm.deal(p2, 50 ether);
        vm.deal(attacker, 50 ether);
    }

    function test_initializeSetsAdmin() public view {
        assertEq(arena.admin(), adm);
    }

    function test_implementationCannotBeInitialized() public {
        MogsArenaUpgradeable impl = new MogsArenaUpgradeable();
        vm.expectRevert();
        impl.initialize(attacker);
    }

    function test_setAdmin_restrictsUpgradeAuthority() public {
        MogsArenaUpgradeable nextImpl = new MogsArenaUpgradeable();
        vm.prank(attacker);
        vm.expectRevert(MogsArenaUpgradeable.OnlyAdmin.selector);
        arena.upgradeToAndCall(address(nextImpl), "");

        arena.setAdmin(attacker);
        assertEq(arena.admin(), attacker);

        vm.prank(attacker);
        arena.upgradeToAndCall(address(nextImpl), "");
    }

    function test_createMatchWithToken_escrowsPrize() public {
        mogs.approve(address(arena), TOKEN_PRIZE);
        uint256 id = arena.createMatchWithToken{value: SPONSOR}(ENTRY, HASH, address(mogs), TOKEN_PRIZE);

        assertEq(id, 1);
        assertEq(mogs.balanceOf(address(arena)), TOKEN_PRIZE);
        (address token, uint256 amount) = arena.getTokenPrize(id);
        assertEq(token, address(mogs));
        assertEq(amount, TOKEN_PRIZE);
    }

    function test_createMatchWithToken_revertsWithoutApproval() public {
        vm.expectRevert();
        arena.createMatchWithToken{value: SPONSOR}(ENTRY, HASH, address(mogs), TOKEN_PRIZE);
    }

    function test_resolveMatch_sendsTokenPrizeToWinner() public {
        uint256 id = _createFullTokenMatch();
        uint256 p1Before = mogs.balanceOf(p1);

        arena.resolveMatch(id, p1);

        assertEq(mogs.balanceOf(p1) - p1Before, TOKEN_PRIZE);
        assertEq(mogs.balanceOf(address(arena)), 0);
        (address token, uint256 amount) = arena.getTokenPrize(id);
        assertEq(token, address(0));
        assertEq(amount, 0);
    }

    function test_resolveDraw_returnsTokenPrizeToAdmin() public {
        uint256 adminBefore = mogs.balanceOf(adm);
        uint256 id = _createFullTokenMatch();

        arena.resolveDraw(id);

        assertEq(mogs.balanceOf(adm), adminBefore);
        assertEq(mogs.balanceOf(address(arena)), 0);
    }

    function test_cancelMatch_returnsTokenPrizeToAdmin() public {
        uint256 adminBefore = mogs.balanceOf(adm);
        mogs.approve(address(arena), TOKEN_PRIZE);
        uint256 id = arena.createMatchWithToken{value: SPONSOR}(ENTRY, HASH, address(mogs), TOKEN_PRIZE);

        arena.cancelMatch(id);

        assertEq(mogs.balanceOf(adm), adminBefore);
        assertEq(mogs.balanceOf(address(arena)), 0);
    }

    function test_expireMatch_returnsTokenPrizeToAdmin() public {
        uint256 adminBefore = mogs.balanceOf(adm);
        mogs.approve(address(arena), TOKEN_PRIZE);
        uint256 id = arena.createMatchWithToken{value: SPONSOR}(ENTRY, HASH, address(mogs), TOKEN_PRIZE);
        vm.prank(p1);
        arena.joinMatch{value: ENTRY}(id);

        vm.warp(block.timestamp + 2 hours + 1);
        arena.expireMatch(id);

        assertEq(mogs.balanceOf(adm), adminBefore);
        assertEq(mogs.balanceOf(address(arena)), 0);
    }

    function test_expireMatch_canBeCalledByAnyoneWithoutTakingFunds() public {
        uint256 adminMonBefore = adm.balance;
        uint256 adminTokenBefore = mogs.balanceOf(adm);
        uint256 attackerMonBefore = attacker.balance;
        uint256 attackerTokenBefore = mogs.balanceOf(attacker);

        mogs.approve(address(arena), TOKEN_PRIZE);
        uint256 id = arena.createMatchWithToken{value: SPONSOR}(ENTRY, HASH, address(mogs), TOKEN_PRIZE);
        vm.prank(p1);
        arena.joinMatch{value: ENTRY}(id);

        vm.warp(block.timestamp + 2 hours + 1);
        vm.prank(attacker);
        arena.expireMatch(id);

        assertEq(attacker.balance, attackerMonBefore);
        assertEq(mogs.balanceOf(attacker), attackerTokenBefore);
        assertEq(p1.balance, 50 ether);
        assertEq(adm.balance, adminMonBefore);
        assertEq(mogs.balanceOf(adm), adminTokenBefore);
        assertEq(mogs.balanceOf(address(arena)), 0);
    }

    function test_expireMatch_fullMatchPublicCallerOnlyRefundsPlayers() public {
        uint256 attackerMonBefore = attacker.balance;
        uint256 id = _createFullTokenMatch();

        vm.warp(block.timestamp + 2 hours + 1);
        vm.prank(attacker);
        arena.expireMatch(id);

        assertEq(attacker.balance, attackerMonBefore);
        assertEq(p1.balance, 50 ether);
        assertEq(p2.balance, 50 ether);
        assertEq(mogs.balanceOf(adm), 10_000 ether);
        assertEq(mogs.balanceOf(address(arena)), 0);
    }

    function test_expireMatch_revertsBeforeDeadlineForAnyone() public {
        mogs.approve(address(arena), TOKEN_PRIZE);
        uint256 id = arena.createMatchWithToken{value: SPONSOR}(ENTRY, HASH, address(mogs), TOKEN_PRIZE);

        vm.prank(attacker);
        vm.expectRevert(MogsArenaUpgradeable.MatchNotExpired.selector);
        arena.expireMatch(id);
    }

    function test_fullMatchDeadlineResetsWhenSecondPlayerJoins() public {
        mogs.approve(address(arena), TOKEN_PRIZE);
        uint256 id = arena.createMatchWithToken{value: SPONSOR}(ENTRY, HASH, address(mogs), TOKEN_PRIZE);
        vm.prank(p1);
        arena.joinMatch{value: ENTRY}(id);

        vm.warp(block.timestamp + 2 hours - 1);
        vm.prank(p2);
        arena.joinMatch{value: ENTRY}(id);

        vm.prank(attacker);
        vm.expectRevert(MogsArenaUpgradeable.MatchNotExpired.selector);
        arena.expireMatch(id);

        vm.warp(block.timestamp + 2 hours + 1);
        vm.prank(attacker);
        arena.expireMatch(id);
        assertEq(uint8(arena.getMatch(id).status), 5);
    }

    function test_resolveMatch_usesPendingWithdrawalWhenWinnerRejectsEth() public {
        RevertingReceiver receiver = new RevertingReceiver();
        address rejectingWinner = address(receiver);
        vm.deal(rejectingWinner, 50 ether);

        mogs.approve(address(arena), TOKEN_PRIZE);
        uint256 id = arena.createMatchWithToken{value: SPONSOR}(ENTRY, HASH, address(mogs), TOKEN_PRIZE);
        vm.prank(rejectingWinner);
        arena.joinMatch{value: ENTRY}(id);
        vm.prank(p2);
        arena.joinMatch{value: ENTRY}(id);

        arena.resolveMatch(id, rejectingWinner);

        uint256 expectedPrize = SPONSOR + (ENTRY * 2) - (ENTRY * 2 * 500 / 10000);
        assertEq(arena.pendingWithdrawals(rejectingWinner), expectedPrize);
        assertEq(mogs.balanceOf(rejectingWinner), TOKEN_PRIZE);
    }

    function test_resolveDraw_usesPendingWithdrawalWhenPlayerRejectsEth() public {
        RevertingReceiver receiver = new RevertingReceiver();
        address rejectingPlayer = address(receiver);
        vm.deal(rejectingPlayer, 50 ether);

        uint256 id = arena.createMatch{value: SPONSOR}(ENTRY, HASH);
        vm.prank(rejectingPlayer);
        arena.joinMatch{value: ENTRY}(id);
        vm.prank(p2);
        arena.joinMatch{value: ENTRY}(id);

        arena.resolveDraw(id);

        uint256 halfSponsor = SPONSOR / 2;
        uint256 expectedRefund = ENTRY + halfSponsor;
        assertEq(arena.pendingWithdrawals(rejectingPlayer), expectedRefund);
        assertEq(p2.balance, 50 ether + halfSponsor);
    }

    function test_createMatchWithNftAndToken_sendsBothToWinner() public {
        nft.mint(adm, 42);
        nft.approve(address(arena), 42);
        mogs.approve(address(arena), TOKEN_PRIZE);

        uint256 id = arena.createMatchWithNftAndToken{value: SPONSOR}(
            ENTRY,
            HASH,
            address(nft),
            42,
            address(mogs),
            TOKEN_PRIZE
        );
        vm.prank(p1);
        arena.joinMatch{value: ENTRY}(id);
        vm.prank(p2);
        arena.joinMatch{value: ENTRY}(id);

        arena.resolveMatch(id, p2);

        assertEq(nft.ownerOf(42), p2);
        assertEq(mogs.balanceOf(p2), TOKEN_PRIZE);
    }

    function _createFullTokenMatch() internal returns (uint256 id) {
        mogs.approve(address(arena), TOKEN_PRIZE);
        id = arena.createMatchWithToken{value: SPONSOR}(ENTRY, HASH, address(mogs), TOKEN_PRIZE);
        vm.prank(p1);
        arena.joinMatch{value: ENTRY}(id);
        vm.prank(p2);
        arena.joinMatch{value: ENTRY}(id);
    }
}
