// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {MonadMogs} from "../src/MonadMogs.sol";

contract MonadMogsTest is Test {
    MonadMogs private mogs;

    address private owner = address(0xA11CE);
    address private minter = address(0xB0B);
    address private stranger = address(0xCAFE);

    function setUp() public {
        mogs = new MonadMogs(owner);
    }

    function testConstants() public view {
        assertEq(mogs.MAX_SUPPLY(), 5_000);
        assertEq(mogs.WALLET_LIMIT(), 5);
        assertEq(mogs.totalSupply(), 0);
    }

    function testMintRevertsWhenClosed() public {
        vm.prank(minter);
        vm.expectRevert(MonadMogs.MintClosed.selector);
        mogs.mint();
    }

    function testMintSucceedsWhenOpenAndCostsZero() public {
        vm.prank(owner);
        mogs.setMintOpen(true);

        vm.deal(minter, 1 ether);
        vm.prank(minter);
        uint256 tokenId = mogs.mint();

        assertEq(tokenId, 1);
        assertEq(mogs.ownerOf(1), minter);
        assertEq(mogs.mintedCount(minter), 1);
        assertEq(mogs.totalSupply(), 1);
        assertEq(minter.balance, 1 ether);
    }

    function testWalletCannotMintMoreThanFive() public {
        vm.prank(owner);
        mogs.setMintOpen(true);

        vm.startPrank(minter);
        for (uint256 i = 0; i < 5; i++) {
            mogs.mint();
        }
        vm.expectRevert(MonadMogs.WalletLimitReached.selector);
        mogs.mint();
        vm.stopPrank();
    }

    function testMaxSupplyIsExactlyFiveThousand() public {
        vm.prank(owner);
        mogs.setMintOpen(true);

        for (uint256 i = 0; i < 5_000; i++) {
            // forge-lint: disable-next-line(unsafe-typecast)
            address account = address(uint160(10_000 + i));
            vm.prank(account);
            mogs.mint();
        }

        assertEq(mogs.totalSupply(), 5_000);

        vm.prank(address(99_999));
        vm.expectRevert(MonadMogs.SoldOut.selector);
        mogs.mint();
    }

    function testTokenURIRevertsForNonexistentToken() public {
        vm.expectRevert(MonadMogs.NonexistentToken.selector);
        mogs.tokenURI(1);
    }

    function testTokenURIReturnsJsonAndSvgDataUris() public {
        vm.prank(owner);
        mogs.setMintOpen(true);
        vm.prank(minter);
        mogs.mint();

        string memory uri = mogs.tokenURI(1);

        assertTrue(_contains(uri, "data:application/json;base64,"));
        assertTrue(_contains(uri, "eyJuYW1lIjoiTW9uYWQgTW9ncyAjMQ==") == false);
        assertGt(bytes(uri).length, 1_000);
    }

    function testTraitsRemainStableAcrossRepeatedTokenURICalls() public {
        vm.prank(owner);
        mogs.setMintOpen(true);
        vm.prank(minter);
        mogs.mint();

        string memory first = mogs.tokenURI(1);

        vm.warp(block.timestamp + 1 days);
        vm.roll(block.number + 100);

        string memory second = mogs.tokenURI(1);
        assertEq(first, second);
    }

    function testFreezeMetadataCannotBeCalledTwice() public {
        vm.startPrank(owner);
        mogs.freezeMetadata();
        vm.expectRevert(MonadMogs.MetadataAlreadyFrozen.selector);
        mogs.freezeMetadata();
        vm.stopPrank();
    }

    function testOwnerOnlyControlsRejectNonOwnerCalls() public {
        vm.startPrank(stranger);
        vm.expectRevert();
        mogs.setMintOpen(true);
        vm.expectRevert();
        mogs.freezeMetadata();
        vm.stopPrank();
    }

    function _contains(string memory source, string memory needle) private pure returns (bool) {
        bytes memory sourceBytes = bytes(source);
        bytes memory needleBytes = bytes(needle);

        if (needleBytes.length == 0 || needleBytes.length > sourceBytes.length) {
            return false;
        }

        for (uint256 i = 0; i <= sourceBytes.length - needleBytes.length; i++) {
            bool matched = true;
            for (uint256 j = 0; j < needleBytes.length; j++) {
                if (sourceBytes[i + j] != needleBytes[j]) {
                    matched = false;
                    break;
                }
            }
            if (matched) return true;
        }

        return false;
    }
}
