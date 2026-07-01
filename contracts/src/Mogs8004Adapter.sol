// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IMogs721 {
    function ownerOf(uint256 tokenId) external view returns (address);
}

interface IERC8004IdentityRegistry {
    struct Metadata {
        string metadataKey;
        bytes metadataValue;
    }

    function register(string calldata agentURI, Metadata[] calldata metadata) external returns (uint256 agentId);
    function ownerOf(uint256 agentId) external view returns (address);
    function tokenURI(uint256 agentId) external view returns (string memory);
    function setAgentURI(uint256 agentId, string calldata newURI) external;
    function setMetadata(uint256 agentId, string calldata metadataKey, bytes calldata metadataValue) external;
    function getMetadata(uint256 agentId, string calldata metadataKey) external view returns (bytes memory);
}

interface IERC721Receiver {
    function onERC721Received(address operator, address from, uint256 tokenId, bytes calldata data) external returns (bytes4);
}

/// @title Mogs8004Adapter
/// @notice Adapter8004-style registry for Monad Mogs agent identities.
///         The adapter owns ERC-8004 identity NFTs and maps control to the current Mog owner.
contract Mogs8004Adapter is IERC721Receiver {
    enum TokenStandard {
        ERC721,
        ERC1155,
        ERC6909
    }

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
    event AgentURIUpdated(uint256 indexed agentId, uint256 indexed mogId, string agentURI, address updatedBy);
    event AgentMetadataUpdated(uint256 indexed agentId, uint256 indexed mogId, string metadataKey, bytes metadataValue, address updatedBy);

    error InvalidMogId();
    error NotMogOwner(uint256 mogId);
    error MogAlreadyAwakened(uint256 mogId, uint256 agentId);
    error AgentNotFound(uint256 agentId);
    error ReservedMetadataKey();
    error RegistryDidNotMintToAdapter(uint256 agentId);

    string public constant AGENT_BINDING_METADATA_KEY = "agent-binding";

    address public immutable NFT_CONTRACT;
    address public immutable IDENTITY_REGISTRY;
    uint256 public immutable CHAIN_ID;

    mapping(uint256 agentId => Binding binding) private _bindings;
    mapping(uint256 mogId => uint256 agentId) private _mogToAgent;

    constructor(address nftContract, address identityRegistry) {
        NFT_CONTRACT = nftContract;
        IDENTITY_REGISTRY = identityRegistry;
        CHAIN_ID = block.chainid;
    }

    /// @notice Register an ERC-8004 identity controlled by the current owner of `mogId`.
    /// @dev The ERC-8004 identity NFT is permanently held by this adapter.
    function registerMogAgent(uint256 mogId, string calldata agentURI) external returns (uint256 agentId) {
        if (mogId == 0) revert InvalidMogId();
        if (IMogs721(NFT_CONTRACT).ownerOf(mogId) != msg.sender) revert NotMogOwner(mogId);
        if (_mogToAgent[mogId] != 0) revert MogAlreadyAwakened(mogId, _mogToAgent[mogId]);

        IERC8004IdentityRegistry.Metadata[] memory metadata = new IERC8004IdentityRegistry.Metadata[](2);
        metadata[0] = IERC8004IdentityRegistry.Metadata({
            metadataKey: AGENT_BINDING_METADATA_KEY,
            metadataValue: abi.encodePacked(address(this))
        });
        metadata[1] = IERC8004IdentityRegistry.Metadata({
            metadataKey: "agent-binding-spec",
            metadataValue: bytes("ERC-8217")
        });

        agentId = IERC8004IdentityRegistry(IDENTITY_REGISTRY).register(agentURI, metadata);
        if (IERC8004IdentityRegistry(IDENTITY_REGISTRY).ownerOf(agentId) != address(this)) {
            revert RegistryDidNotMintToAdapter(agentId);
        }

        _bindings[agentId] = Binding({
            standard: TokenStandard.ERC721,
            tokenContract: NFT_CONTRACT,
            tokenId: mogId
        });
        _mogToAgent[mogId] = agentId;

        emit AgentBound(agentId, TokenStandard.ERC721, NFT_CONTRACT, mogId, msg.sender);
    }

    function setAgentURI(uint256 agentId, string calldata agentURI) external {
        uint256 mogId = _requireController(agentId);
        IERC8004IdentityRegistry(IDENTITY_REGISTRY).setAgentURI(agentId, agentURI);
        emit AgentURIUpdated(agentId, mogId, agentURI, msg.sender);
    }

    function setAgentMetadata(uint256 agentId, string calldata metadataKey, bytes calldata metadataValue) external {
        uint256 mogId = _requireController(agentId);
        if (_isReservedMetadataKey(metadataKey)) revert ReservedMetadataKey();
        IERC8004IdentityRegistry(IDENTITY_REGISTRY).setMetadata(agentId, metadataKey, metadataValue);
        emit AgentMetadataUpdated(agentId, mogId, metadataKey, metadataValue, msg.sender);
    }

    function bindingOf(uint256 agentId) external view returns (Binding memory) {
        return _bindings[agentId];
    }

    function agentOf(uint256 mogId) external view returns (uint256) {
        return _mogToAgent[mogId];
    }

    function isController(uint256 agentId, address account) external view returns (bool) {
        Binding memory binding = _bindings[agentId];
        if (binding.tokenContract == address(0)) return false;
        return IMogs721(binding.tokenContract).ownerOf(binding.tokenId) == account;
    }

    function controllerOf(uint256 agentId) external view returns (address) {
        Binding memory binding = _bindings[agentId];
        if (binding.tokenContract == address(0)) revert AgentNotFound(agentId);
        return IMogs721(binding.tokenContract).ownerOf(binding.tokenId);
    }

    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == 0x01ffc9a7 || interfaceId == 0x9f8abe28;
    }

    function _requireController(uint256 agentId) private view returns (uint256 mogId) {
        Binding memory binding = _bindings[agentId];
        if (binding.tokenContract == address(0)) revert AgentNotFound(agentId);
        mogId = binding.tokenId;
        if (IMogs721(binding.tokenContract).ownerOf(mogId) != msg.sender) revert NotMogOwner(mogId);
    }

    function _isReservedMetadataKey(string calldata metadataKey) private pure returns (bool) {
        bytes32 keyHash = keccak256(bytes(metadataKey));
        return keyHash == keccak256(bytes(AGENT_BINDING_METADATA_KEY)) || keyHash == keccak256(bytes("agent-binding-spec"));
    }
}
