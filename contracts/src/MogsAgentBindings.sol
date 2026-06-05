// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IERC721Minimal {
    function ownerOf(uint256 tokenId) external view returns (address);
}

interface IERC8004Minimal {
    function ownerOf(uint256 agentId) external view returns (address);
}

/// @title MogsAgentBindings
/// @notice ERC-8217 compliant per-collection binding registry.
///         Binds a Monad Mogs NFT (ERC-721) to an ERC-8004 agent identity.
///         Each Mog can bind to exactly one agent. Bindings are immutable once written.
contract MogsAgentBindings {
    /* ------------------------------------------------------------------ */
    /*  ERC-8217 Interface                                                 */
    /* ------------------------------------------------------------------ */

    enum TokenStandard { ERC721, ERC1155, ERC6909 }

    struct Binding {
        TokenStandard standard;
        address tokenContract;
        uint256 tokenId;
    }

    event AgentBound(
        uint256 indexed agentId,
        TokenStandard indexed standard,
        address indexed tokenContract,
        uint256 tokenId,
        address registeredBy
    );

    /* ------------------------------------------------------------------ */
    /*  Errors                                                             */
    /* ------------------------------------------------------------------ */

    error AlreadyBound(uint256 agentId);
    error MogAlreadyBound(uint256 mogId, uint256 existingAgentId);
    error NotAgentOwner(uint256 agentId);
    error NotMogOwner(uint256 mogId);

    /* ------------------------------------------------------------------ */
    /*  Immutable references                                               */
    /* ------------------------------------------------------------------ */

    address public immutable NFT_CONTRACT;
    address public immutable IDENTITY_REGISTRY;
    uint256 public immutable CHAIN_ID;

    /* ------------------------------------------------------------------ */
    /*  Storage                                                            */
    /* ------------------------------------------------------------------ */

    mapping(uint256 => Binding) private _bindings;
    mapping(uint256 => uint256) private _mogToAgent;

    /* ------------------------------------------------------------------ */
    /*  Constructor                                                        */
    /* ------------------------------------------------------------------ */

    constructor(address nftContract, address identityRegistry) {
        NFT_CONTRACT = nftContract;
        IDENTITY_REGISTRY = identityRegistry;
        CHAIN_ID = block.chainid;
    }

    /* ------------------------------------------------------------------ */
    /*  Write                                                              */
    /* ------------------------------------------------------------------ */

    /// @notice Bind an ERC-8004 agent to a Monad Mogs NFT.
    /// @dev Caller must own both the ERC-8004 agent NFT and the Mog NFT.
    ///      Bindings are immutable — once set, they cannot be changed.
    function bind(uint256 agentId, uint256 mogId) external {
        if (IERC8004Minimal(IDENTITY_REGISTRY).ownerOf(agentId) != msg.sender) {
            revert NotAgentOwner(agentId);
        }
        if (IERC721Minimal(NFT_CONTRACT).ownerOf(mogId) != msg.sender) {
            revert NotMogOwner(mogId);
        }
        if (_bindings[agentId].tokenContract != address(0)) {
            revert AlreadyBound(agentId);
        }
        if (_mogToAgent[mogId] != 0) {
            revert MogAlreadyBound(mogId, _mogToAgent[mogId]);
        }

        _bindings[agentId] = Binding({
            standard: TokenStandard.ERC721,
            tokenContract: NFT_CONTRACT,
            tokenId: mogId
        });
        _mogToAgent[mogId] = agentId;

        emit AgentBound(agentId, TokenStandard.ERC721, NFT_CONTRACT, mogId, msg.sender);
    }

    /* ------------------------------------------------------------------ */
    /*  Read                                                               */
    /* ------------------------------------------------------------------ */

    /// @notice ERC-8217 required — returns the NFT bound to an agent.
    function bindingOf(uint256 agentId) external view returns (Binding memory) {
        return _bindings[agentId];
    }

    /// @notice Reverse lookup — which agent is bound to this Mog?
    /// @return agentId The bound agent ID, or 0 if unbound.
    function agentOf(uint256 mogId) external view returns (uint256) {
        return _mogToAgent[mogId];
    }

    /// @notice Returns true if the agent has an active binding.
    function isBound(uint256 agentId) external view returns (bool) {
        return _bindings[agentId].tokenContract != address(0);
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == 0x01ffc9a7 || interfaceId == 0x9f8abe28;
    }
}
