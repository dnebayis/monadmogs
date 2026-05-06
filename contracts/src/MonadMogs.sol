// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

contract MonadMogs is ERC721, Ownable {
    using Strings for uint256;

    uint256 public constant MAX_SUPPLY = 5_000;
    uint256 public constant WALLET_LIMIT = 5;

    bool public mintOpen;
    bool public metadataFrozen;

    uint256 private _nextTokenId = 1;

    mapping(address account => uint256 count) public mintedCount;
    mapping(uint256 tokenId => uint256 seed) private _tokenSeeds;

    event MintOpenSet(bool open);
    event MetadataFrozen();

    error MintClosed();
    error SoldOut();
    error WalletLimitReached();
    error MetadataAlreadyFrozen();
    error NonexistentToken();

    constructor(address initialOwner) ERC721("Monad Mogs", "MOGS") Ownable(initialOwner) {}

    function totalSupply() public view returns (uint256) {
        return _nextTokenId - 1;
    }

    function setMintOpen(bool open) external onlyOwner {
        mintOpen = open;
        emit MintOpenSet(open);
    }

    function freezeMetadata() external onlyOwner {
        if (metadataFrozen) revert MetadataAlreadyFrozen();
        metadataFrozen = true;
        emit MetadataFrozen();
    }

    function mint() external returns (uint256 tokenId) {
        if (!mintOpen) revert MintClosed();
        if (_nextTokenId > MAX_SUPPLY) revert SoldOut();
        if (mintedCount[msg.sender] >= WALLET_LIMIT) revert WalletLimitReached();

        tokenId = _nextTokenId++;
        mintedCount[msg.sender]++;
        _tokenSeeds[tokenId] = uint256(
            keccak256(
                abi.encodePacked(
                    tokenId,
                    msg.sender,
                    blockhash(block.number - 1),
                    block.timestamp,
                    block.prevrandao,
                    address(this)
                )
            )
        );

        _safeMint(msg.sender, tokenId);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        if (_ownerOf(tokenId) == address(0)) revert NonexistentToken();

        uint256 seed = _tokenSeeds[tokenId];
        string memory image = Base64.encode(bytes(_svg(seed)));
        string memory json = Base64.encode(
            bytes(
                string.concat(
                    '{"name":"Monad Mogs #',
                    tokenId.toString(),
                    '","description":"A 5K free mint collection of fully onchain pixel meme relics on Monad.',
                    '","image":"data:image/svg+xml;base64,',
                    image,
                    '","attributes":[',
                    _attributes(seed),
                    "]}"
                )
            )
        );

        return string.concat("data:application/json;base64,", json);
    }

    function _attributes(uint256 seed) private pure returns (string memory) {
        return string.concat(
            _attribute("Background", _backgroundName(_pick(seed, 0, 8))),
            ",",
            _attribute("Body", _bodyName(_pick(seed, 1, 6))),
            ",",
            _attribute("Eyes", _eyesName(_pick(seed, 2, 6))),
            ",",
            _attribute("Mouth", _mouthName(_pick(seed, 3, 6))),
            ",",
            _attribute("Head", _headName(_pick(seed, 4, 7))),
            ",",
            _attribute("Hands", _handsName(_pick(seed, 5, 6))),
            ",",
            _attribute("Aura", _auraName(_pick(seed, 6, 7))),
            ",",
            _attribute("Glitch", _glitchName(_pick(seed, 7, 5))),
            ",",
            _attribute("Meme Tag", _memeTagName(_pick(seed, 8, 8)))
        );
    }

    function _attribute(string memory traitType, string memory value) private pure returns (string memory) {
        return string.concat('{"trait_type":"', traitType, '","value":"', value, '"}');
    }

    function _svg(uint256 seed) private pure returns (string memory) {
        uint256 background = _pick(seed, 0, 8);
        uint256 body = _pick(seed, 1, 6);
        uint256 eyes = _pick(seed, 2, 6);
        uint256 mouth = _pick(seed, 3, 6);
        uint256 head = _pick(seed, 4, 7);
        uint256 hands = _pick(seed, 5, 6);
        uint256 aura = _pick(seed, 6, 7);
        uint256 glitch = _pick(seed, 7, 5);

        return string.concat(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" shape-rendering="crispEdges">',
            _svgStyle(),
            '<rect width="240" height="240" fill="',
            _backgroundColor(background),
            '"/>',
            _backgroundPattern(background),
            _aura(aura),
            _glitch(glitch),
            _body(body),
            _head(head),
            _eyes(eyes),
            _mouth(mouth),
            _hands(hands),
            "</svg>"
        );
    }

    function _svgStyle() private pure returns (string memory) {
        return
            '<style>.line{fill:#0e100f}.light{fill:#fbfaf9}.shade{opacity:.45}.soft{opacity:.22}.blush{fill:#ff8ee4;opacity:.55}</style>';
    }

    function _body(uint256 body) private pure returns (string memory) {
        string memory fur = body == 1 ? "#f3b05a" : body == 2 ? "#d889ff" : body == 3 ? "#b9e3f9" : body == 4
            ? "#ff7a3d"
            : body == 5 ? "#ddd7fe" : "#f28a42";
        string memory shadow = body == 1 ? "#c67532" : body == 2 ? "#8d42d6" : body == 3 ? "#6b9ab6" : body == 4
            ? "#b84b29"
            : body == 5 ? "#836ef9" : "#a74624";

        return string.concat(
            '<rect x="80" y="74" width="18" height="30" fill="',
            fur,
            '"/><rect x="142" y="74" width="18" height="30" fill="',
            fur,
            '"/><rect x="88" y="62" width="10" height="16" fill="#ff9b63"/><rect x="142" y="62" width="10" height="16" fill="#ff9b63"/><rect x="76" y="96" width="88" height="58" fill="',
            fur,
            '"/><rect x="64" y="112" width="112" height="44" fill="',
            fur,
            '"/><rect x="88" y="112" width="64" height="38" fill="#ffe8b8"/><rect x="76" y="154" width="88" height="18" fill="',
            fur,
            '"/><rect x="146" y="118" width="30" height="54" fill="',
            shadow,
            '" class="shade"/><rect x="72" y="172" width="28" height="12" fill="',
            shadow,
            '"/><rect x="140" y="172" width="28" height="12" fill="',
            shadow,
            '"/><rect x="48" y="132" width="20" height="26" fill="',
            fur,
            '"/><rect x="172" y="132" width="20" height="26" fill="',
            fur,
            '"/>'
        );
    }

    function _head(uint256 head) private pure returns (string memory) {
        if (head == 0) return '<rect x="82" y="88" width="76" height="12" fill="#200052"/><rect x="126" y="76" width="16" height="12" fill="#6e54ff"/>';
        if (head == 1) return '<rect x="76" y="82" width="88" height="8" fill="#ddd7fe"/><rect x="94" y="72" width="52" height="10" fill="#ddd7fe"/>';
        if (head == 2) return '<rect x="84" y="80" width="72" height="12" fill="#ffae45"/><rect x="98" y="68" width="14" height="14" fill="#ffae45"/><rect x="128" y="68" width="14" height="14" fill="#ffae45"/>';
        if (head == 3) return '<rect x="82" y="80" width="76" height="12" fill="#85e6ff"/><rect x="98" y="72" width="44" height="8" fill="#0e091c"/>';
        if (head == 4) return '<rect x="78" y="82" width="84" height="14" fill="#ff8ee4"/><rect x="98" y="70" width="44" height="12" fill="#ff8ee4"/>';
        if (head == 5) return "";
        return '<rect x="74" y="84" width="92" height="8" fill="#0e100f"/><rect x="88" y="74" width="64" height="10" fill="#6e54ff"/>';
    }

    function _eyes(uint256 eyes) private pure returns (string memory) {
        if (eyes == 0) return '<rect x="92" y="120" width="12" height="18" class="line"/><rect x="136" y="120" width="12" height="18" class="line"/><rect x="96" y="124" width="4" height="6" class="light"/><rect x="140" y="124" width="4" height="6" class="light"/><rect x="82" y="142" width="20" height="8" class="blush"/><rect x="138" y="142" width="20" height="8" class="blush"/>';
        if (eyes == 1) return '<rect x="88" y="118" width="18" height="18" fill="#85e6ff"/><rect x="134" y="118" width="18" height="18" fill="#85e6ff"/><rect x="94" y="122" width="8" height="10" class="line"/><rect x="140" y="122" width="8" height="10" class="line"/>';
        if (eyes == 2) return '<rect x="88" y="126" width="22" height="6" class="line"/><rect x="130" y="126" width="22" height="6" class="line"/>';
        if (eyes == 3) return '<rect x="84" y="118" width="28" height="18" fill="#0e100f"/><rect x="128" y="118" width="28" height="18" fill="#0e100f"/><rect x="92" y="124" width="12" height="4" fill="#85e6ff"/><rect x="136" y="124" width="12" height="4" fill="#85e6ff"/>';
        if (eyes == 4) return '<rect x="90" y="118" width="16" height="18" fill="#ff8ee4"/><rect x="134" y="118" width="16" height="18" fill="#ff8ee4"/><rect x="96" y="124" width="6" height="8" class="line"/><rect x="140" y="124" width="6" height="8" class="line"/>';
        return '<rect x="90" y="122" width="16" height="12" fill="#0e091c"/><rect x="134" y="122" width="16" height="12" fill="#0e091c"/>';
    }

    function _mouth(uint256 mouth) private pure returns (string memory) {
        if (mouth == 0) return '<rect x="112" y="142" width="16" height="8" fill="#d23f57"/>';
        if (mouth == 1) return '<rect x="104" y="142" width="12" height="6" class="line"/><rect x="120" y="142" width="16" height="6" class="line"/>';
        if (mouth == 2) return '<rect x="106" y="142" width="28" height="8" class="line"/><rect x="112" y="150" width="16" height="6" fill="#fbfaf9"/>';
        if (mouth == 3) return '<rect x="106" y="140" width="28" height="6" fill="#85e6ff"/><rect x="114" y="146" width="12" height="6" fill="#85e6ff"/>';
        if (mouth == 4) return '<rect x="108" y="142" width="24" height="6" fill="#ff8ee4"/>';
        return '<rect x="114" y="144" width="12" height="5" class="line"/>';
    }

    function _hands(uint256 hands) private pure returns (string memory) {
        if (hands == 0) return '<rect x="44" y="142" width="20" height="18" fill="#85e6ff"/><rect x="176" y="142" width="20" height="18" fill="#85e6ff"/>';
        if (hands == 1) return '<rect x="38" y="138" width="30" height="18" fill="#fbfaf9"/><rect x="172" y="138" width="30" height="18" fill="#fbfaf9"/><rect x="44" y="144" width="18" height="5" class="line"/>';
        if (hands == 2) return '<rect x="42" y="128" width="18" height="38" fill="#ddd7fe"/><rect x="60" y="128" width="14" height="10" fill="#6e54ff"/>';
        if (hands == 3) return '<rect x="38" y="142" width="30" height="16" class="line"/><rect x="172" y="142" width="30" height="16" class="line"/><rect x="46" y="146" width="6" height="6" fill="#85e6ff"/>';
        if (hands == 4) return '<rect x="42" y="138" width="22" height="22" fill="#85e6ff"/><rect x="176" y="138" width="22" height="22" fill="#85e6ff"/><rect x="50" y="130" width="6" height="36" fill="#fbfaf9"/>';
        return '<rect x="48" y="148" width="18" height="12" fill="#ddd7fe"/><rect x="174" y="148" width="18" height="12" fill="#ddd7fe"/>';
    }

    function _aura(uint256 aura) private pure returns (string memory) {
        if (aura == 6) return "";
        string memory color = aura == 0 ? "#ddd7fe" : aura == 1 ? "#85e6ff" : aura == 2 ? "#6e54ff" : aura == 3
            ? "#ffae45"
            : aura == 4 ? "#ff8ee4" : "#b9e3f9";
        return string.concat(
            '<rect x="42" y="42" width="16" height="16" fill="',
            color,
            '" class="soft"/><rect x="182" y="50" width="16" height="16" fill="',
            color,
            '" class="soft"/><rect x="34" y="176" width="18" height="18" fill="',
            color,
            '" class="soft"/><rect x="188" y="170" width="18" height="18" fill="',
            color,
            '" class="soft"/>'
        );
    }

    function _glitch(uint256 glitch) private pure returns (string memory) {
        if (glitch == 0) return "";
        string memory color = glitch == 1 ? "#85e6ff" : glitch == 2 ? "#ff8ee4" : glitch == 3 ? "#ffae45" : "#fbfaf9";
        return string.concat(
            '<rect x="18" y="',
            (42 + glitch * 18).toString(),
            '" width="46" height="6" fill="',
            color,
            '" class="soft"/><rect x="176" y="',
            (72 + glitch * 14).toString(),
            '" width="38" height="6" fill="',
            color,
            '" class="soft"/>'
        );
    }

    function _backgroundPattern(uint256 background) private pure returns (string memory) {
        if (background < 5) return '<path d="M0 40H240M0 80H240M0 120H240M0 160H240M0 200H240M40 0V240M80 0V240M120 0V240M160 0V240M200 0V240" stroke="#ffffff" stroke-opacity=".08" stroke-width="2"/>';
        if (background == 5) return '<rect x="0" y="0" width="240" height="80" fill="#ff8ee4" opacity=".14"/>';
        if (background == 6) return '<path d="M0 24H240M0 48H240M0 72H240M0 96H240M0 120H240M0 144H240M0 168H240M0 192H240M0 216H240" stroke="#85e6ff" stroke-opacity=".18" stroke-width="2"/>';
        return '<circle cx="54" cy="58" r="6" fill="#85e6ff"/><circle cx="188" cy="48" r="6" fill="#ff8ee4"/><circle cx="198" cy="182" r="6" fill="#ffae45"/><circle cx="38" cy="180" r="6" fill="#ddd7fe"/>';
    }

    function _backgroundColor(uint256 background) private pure returns (string memory) {
        if (background == 0) return "#fbfaf9";
        if (background == 1) return "#6e54ff";
        if (background == 2) return "#200052";
        if (background == 3) return "#a0055d";
        if (background == 4) return "#0e091c";
        if (background == 5) return "#2b1235";
        if (background == 6) return "#07181d";
        return "#140b28";
    }

    function _pick(uint256 seed, uint256 slot, uint256 modulo) private pure returns (uint256) {
        return uint256(keccak256(abi.encodePacked(seed, slot))) % modulo;
    }

    function _backgroundName(uint256 value) private pure returns (string memory) {
        if (value == 0) return "Off-White";
        if (value == 1) return "Monad Purple";
        if (value == 2) return "Monad Blue";
        if (value == 3) return "Berry";
        if (value == 4) return "Terminal Black";
        if (value == 5) return "Finality Pink";
        if (value == 6) return "Mempool Grid";
        return "Validator Map";
    }

    function _bodyName(uint256 value) private pure returns (string memory) {
        if (value == 0) return "Nad";
        if (value == 1) return "Pixel Bot";
        if (value == 2) return "Parallel Runner";
        if (value == 3) return "Mempool Ghost";
        if (value == 4) return "Block Builder";
        return "Validator Kid";
    }

    function _eyesName(uint256 value) private pure returns (string memory) {
        if (value == 0) return "400ms Blink";
        if (value == 1) return "Diamond Eyes";
        if (value == 2) return "Sleepy Gmonad";
        if (value == 3) return "Terminal Scan";
        if (value == 4) return "Purple Rage";
        return "Empty Mempool";
    }

    function _mouthName(uint256 value) private pure returns (string memory) {
        if (value == 0) return "GM";
        if (value == 1) return "Gmonad";
        if (value == 2) return "Cope Smile";
        if (value == 3) return "Finalized";
        if (value == 4) return "Reorg No";
        return "Silent";
    }

    function _headName(uint256 value) private pure returns (string memory) {
        if (value == 0) return "Monad Cap";
        if (value == 1) return "Validator Halo";
        if (value == 2) return "Block Crown";
        if (value == 3) return "Gas Meter";
        if (value == 4) return "Purple Beanie";
        if (value == 5) return "No Hat";
        return "Mempool Crown";
    }

    function _handsName(uint256 value) private pure returns (string memory) {
        if (value == 0) return "Faucet Cup";
        if (value == 1) return "Block Receipt";
        if (value == 2) return "Pixel Flag";
        if (value == 3) return "Keyboard";
        if (value == 4) return "Diamond";
        return "Empty Hands";
    }

    function _auraName(uint256 value) private pure returns (string memory) {
        if (value == 0) return "Proposed";
        if (value == 1) return "Voted";
        if (value == 2) return "Finalized";
        if (value == 3) return "Verified";
        if (value == 4) return "Async";
        if (value == 5) return "Raptor";
        return "None";
    }

    function _glitchName(uint256 value) private pure returns (string memory) {
        if (value == 0) return "None";
        if (value == 1) return "Low";
        if (value == 2) return "Parallel Split";
        if (value == 3) return "JIT Burn";
        return "State Root";
    }

    function _memeTagName(uint256 value) private pure returns (string memory) {
        if (value == 0) return "gmonad";
        if (value == 1) return "400ms";
        if (value == 2) return "800ms";
        if (value == 3) return "no global mempool";
        if (value == 4) return "sendRawSync";
        if (value == 5) return "monanimal energy";
        if (value == 6) return "full onchain";
        return "testnet relic";
    }
}
