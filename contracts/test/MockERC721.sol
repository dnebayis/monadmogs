// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract MockERC721 {
    mapping(uint256 => address) public ownerOf;
    mapping(address => mapping(address => bool)) public isApprovedForAll;
    mapping(uint256 => address) public getApproved;

    function mint(address to, uint256 tokenId) external {
        ownerOf[tokenId] = to;
    }

    function approve(address to, uint256 tokenId) external {
        getApproved[tokenId] = to;
    }

    function setApprovalForAll(address operator, bool approved) external {
        isApprovedForAll[msg.sender][operator] = approved;
    }

    function safeTransferFrom(address from, address to, uint256 tokenId) external {
        require(ownerOf[tokenId] == from, "not owner");
        require(
            msg.sender == from || isApprovedForAll[from][msg.sender] || getApproved[tokenId] == msg.sender,
            "not approved"
        );
        ownerOf[tokenId] = to;

        if (to.code.length > 0) {
            (bool ok, bytes memory ret) = to.call(
                abi.encodeWithSignature("onERC721Received(address,address,uint256,bytes)", msg.sender, from, tokenId, "")
            );
            require(ok && abi.decode(ret, (bytes4)) == bytes4(0x150b7a02), "receiver rejected");
        }
    }
}
