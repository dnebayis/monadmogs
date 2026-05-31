// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";

interface IERC721Prize {
    function safeTransferFrom(address from, address to, uint256 tokenId) external;
    function ownerOf(uint256 tokenId) external view returns (address);
}

/// @title MogsArena upgradeable
/// @notice UUPS arena proxy implementation with MON, NFT, and ERC20 prize escrow.
contract MogsArenaUpgradeable is Initializable, UUPSUpgradeable {
    using SafeERC20 for IERC20;

    enum MatchStatus {
        Open,
        Full,
        Resolved,
        Draw,
        Cancelled,
        Expired
    }

    struct NftPrize {
        address collection;
        uint256 tokenId;
    }

    struct TokenPrize {
        address token;
        uint256 amount;
    }

    struct Match {
        uint256 id;
        uint256 sponsorPrize;
        uint256 entryFee;
        address player1;
        address player2;
        address winner;
        MatchStatus status;
        uint64 createdAt;
        uint64 resolvedAt;
        uint64 deadline;
        bytes32 gameHash;
        NftPrize nftPrize;
    }

    address public admin;
    uint256 public matchCount;
    mapping(uint256 => Match) public matches;
    mapping(uint256 => TokenPrize) public tokenPrizes;
    mapping(address => uint256) public activeMatch;
    mapping(address => uint256) public pendingWithdrawals;

    uint256 public constant MAX_ENTRY_FEE = 100 ether;
    uint256 public constant MIN_ENTRY_FEE = 0.001 ether;
    uint256 public constant MATCH_TIMEOUT = 2 hours;
    uint256 public constant FEE_BPS = 500;
    uint256 public feeCollected;

    bool public paused;
    bool private _locked;

    event MatchCreated(
        uint256 indexed matchId,
        uint256 sponsorPrize,
        uint256 entryFee,
        bytes32 gameHash,
        address nftCollection,
        uint256 nftTokenId
    );
    event TokenPrizeEscrowed(uint256 indexed matchId, address indexed token, uint256 amount);
    event TokenPrizePaid(uint256 indexed matchId, address indexed token, address indexed winner, uint256 amount);
    event TokenPrizeReturned(uint256 indexed matchId, address indexed token, address indexed recipient, uint256 amount);
    event AdminUpdated(address indexed previousAdmin, address indexed newAdmin);
    event PlayerJoined(uint256 indexed matchId, address indexed player, uint8 slot);
    event MatchResolved(uint256 indexed matchId, address indexed winner, uint256 prize, address nftCollection, uint256 nftTokenId);
    event MatchDraw(uint256 indexed matchId);
    event MatchCancelled(uint256 indexed matchId);
    event MatchExpired(uint256 indexed matchId);
    event FeesWithdrawn(uint256 amount);
    event WithdrawalPending(address indexed player, uint256 amount);
    event Paused();
    event Unpaused();

    error OnlyAdmin();
    error InvalidAdmin();
    error InvalidEntryFee();
    error MatchNotOpen();
    error MatchNotFull();
    error AlreadyJoined();
    error AlreadyInMatch();
    error WrongEntryFee();
    error InvalidWinner();
    error TransferFailed();
    error MatchNotExpired();
    error Reentrancy();
    error InvalidGameHash();
    error InvalidTokenPrize();
    error NoFeesToWithdraw();
    error ContractPaused();
    error NftNotReceived();
    error TokenNotReceived();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address initialAdmin) external initializer {
        if (initialAdmin == address(0)) revert InvalidAdmin();
        admin = initialAdmin;
    }

    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return this.onERC721Received.selector;
    }

    modifier onlyAdmin() {
        if (msg.sender != admin) revert OnlyAdmin();
        _;
    }

    modifier noReentrant() {
        if (_locked) revert Reentrancy();
        _locked = true;
        _;
        _locked = false;
    }

    modifier whenNotPaused() {
        if (paused) revert ContractPaused();
        _;
    }

    function setAdmin(address newAdmin) external onlyAdmin {
        if (newAdmin == address(0)) revert InvalidAdmin();
        address previous = admin;
        admin = newAdmin;
        emit AdminUpdated(previous, newAdmin);
    }

    function createMatch(uint256 entryFee, bytes32 gameHash) external payable onlyAdmin whenNotPaused returns (uint256) {
        return _createMatch(entryFee, gameHash, address(0), 0);
    }

    function createMatchWithNft(
        uint256 entryFee,
        bytes32 gameHash,
        address nftCollection,
        uint256 nftTokenId
    ) external payable onlyAdmin whenNotPaused returns (uint256) {
        IERC721Prize(nftCollection).safeTransferFrom(msg.sender, address(this), nftTokenId);
        if (IERC721Prize(nftCollection).ownerOf(nftTokenId) != address(this)) revert NftNotReceived();

        return _createMatch(entryFee, gameHash, nftCollection, nftTokenId);
    }

    function createMatchWithToken(
        uint256 entryFee,
        bytes32 gameHash,
        address prizeToken,
        uint256 prizeAmount
    ) external payable onlyAdmin whenNotPaused returns (uint256) {
        uint256 matchId = _createMatch(entryFee, gameHash, address(0), 0);
        _escrowTokenPrize(matchId, prizeToken, prizeAmount);
        return matchId;
    }

    function createMatchWithNftAndToken(
        uint256 entryFee,
        bytes32 gameHash,
        address nftCollection,
        uint256 nftTokenId,
        address prizeToken,
        uint256 prizeAmount
    ) external payable onlyAdmin whenNotPaused returns (uint256) {
        IERC721Prize(nftCollection).safeTransferFrom(msg.sender, address(this), nftTokenId);
        if (IERC721Prize(nftCollection).ownerOf(nftTokenId) != address(this)) revert NftNotReceived();

        uint256 matchId = _createMatch(entryFee, gameHash, nftCollection, nftTokenId);
        _escrowTokenPrize(matchId, prizeToken, prizeAmount);
        return matchId;
    }

    function joinMatch(uint256 matchId) external payable noReentrant whenNotPaused {
        Match storage m = matches[matchId];
        if (m.status != MatchStatus.Open) revert MatchNotOpen();
        if (block.timestamp >= m.deadline) revert MatchNotExpired();
        if (msg.value != m.entryFee) revert WrongEntryFee();
        if (msg.sender == m.player1) revert AlreadyJoined();

        uint256 currentActive = activeMatch[msg.sender];
        if (currentActive != 0) {
            MatchStatus currentStatus = matches[currentActive].status;
            if (currentStatus == MatchStatus.Open || currentStatus == MatchStatus.Full) {
                revert AlreadyInMatch();
            }
        }

        if (m.player1 == address(0)) {
            m.player1 = msg.sender;
            activeMatch[msg.sender] = matchId;
            emit PlayerJoined(matchId, msg.sender, 1);
        } else {
            m.player2 = msg.sender;
            m.status = MatchStatus.Full;
            m.deadline = uint64(block.timestamp + MATCH_TIMEOUT);
            activeMatch[msg.sender] = matchId;
            emit PlayerJoined(matchId, msg.sender, 2);
        }
    }

    function resolveMatch(uint256 matchId, address winner) external onlyAdmin noReentrant {
        Match storage m = matches[matchId];
        if (m.status != MatchStatus.Full) revert MatchNotFull();
        if (winner != m.player1 && winner != m.player2) revert InvalidWinner();

        m.winner = winner;
        m.status = MatchStatus.Resolved;
        m.resolvedAt = uint64(block.timestamp);

        uint256 totalEntries = m.entryFee * 2;
        uint256 adminCut = (totalEntries * FEE_BPS) / 10000;
        uint256 prize = m.sponsorPrize + totalEntries - adminCut;

        feeCollected += adminCut;

        _clearActiveMatch(m.player1, matchId);
        _clearActiveMatch(m.player2, matchId);

        _safeTransfer(winner, prize);

        if (m.nftPrize.collection != address(0)) {
            IERC721Prize(m.nftPrize.collection).safeTransferFrom(address(this), winner, m.nftPrize.tokenId);
        }
        _sendTokenPrize(matchId, winner);

        emit MatchResolved(matchId, winner, prize, m.nftPrize.collection, m.nftPrize.tokenId);
    }

    function resolveDraw(uint256 matchId) external onlyAdmin noReentrant {
        Match storage m = matches[matchId];
        if (m.status != MatchStatus.Full) revert MatchNotFull();

        m.status = MatchStatus.Draw;
        m.resolvedAt = uint64(block.timestamp);

        uint256 halfSponsor = m.sponsorPrize / 2;
        uint256 remainder = m.sponsorPrize - (halfSponsor * 2);
        uint256 refundP1 = m.entryFee + halfSponsor + remainder;
        uint256 refundP2 = m.entryFee + halfSponsor;

        _clearActiveMatch(m.player1, matchId);
        _clearActiveMatch(m.player2, matchId);

        _safeTransfer(m.player1, refundP1);
        _safeTransfer(m.player2, refundP2);

        if (m.nftPrize.collection != address(0)) {
            IERC721Prize(m.nftPrize.collection).safeTransferFrom(address(this), admin, m.nftPrize.tokenId);
        }
        _returnTokenPrize(matchId);

        emit MatchDraw(matchId);
    }

    function cancelMatch(uint256 matchId) external onlyAdmin noReentrant {
        Match storage m = matches[matchId];
        if (
            m.status == MatchStatus.Resolved || m.status == MatchStatus.Cancelled || m.status == MatchStatus.Draw
                || m.status == MatchStatus.Expired
        ) {
            revert MatchNotOpen();
        }

        m.status = MatchStatus.Cancelled;

        if (m.player1 != address(0)) {
            _clearActiveMatch(m.player1, matchId);
            _safeTransfer(m.player1, m.entryFee);
        }
        if (m.player2 != address(0)) {
            _clearActiveMatch(m.player2, matchId);
            _safeTransfer(m.player2, m.entryFee);
        }
        if (m.sponsorPrize > 0) {
            _safeTransfer(admin, m.sponsorPrize);
        }

        if (m.nftPrize.collection != address(0)) {
            IERC721Prize(m.nftPrize.collection).safeTransferFrom(address(this), admin, m.nftPrize.tokenId);
        }
        _returnTokenPrize(matchId);

        emit MatchCancelled(matchId);
    }

    function expireMatch(uint256 matchId) external noReentrant {
        Match storage m = matches[matchId];
        if (m.status != MatchStatus.Open && m.status != MatchStatus.Full) revert MatchNotOpen();
        if (block.timestamp < m.deadline) revert MatchNotExpired();

        m.status = MatchStatus.Expired;

        if (m.player1 != address(0)) {
            _clearActiveMatch(m.player1, matchId);
            _safeTransfer(m.player1, m.entryFee);
        }
        if (m.player2 != address(0)) {
            _clearActiveMatch(m.player2, matchId);
            _safeTransfer(m.player2, m.entryFee);
        }
        if (m.sponsorPrize > 0) {
            _safeTransfer(admin, m.sponsorPrize);
        }

        if (m.nftPrize.collection != address(0)) {
            IERC721Prize(m.nftPrize.collection).safeTransferFrom(address(this), admin, m.nftPrize.tokenId);
        }
        _returnTokenPrize(matchId);

        emit MatchExpired(matchId);
    }

    function pause() external onlyAdmin {
        paused = true;
        emit Paused();
    }

    function unpause() external onlyAdmin {
        paused = false;
        emit Unpaused();
    }

    function withdrawFees() external onlyAdmin noReentrant {
        uint256 amount = feeCollected;
        if (amount == 0) revert NoFeesToWithdraw();
        feeCollected = 0;
        (bool success,) = admin.call{value: amount}("");
        if (!success) revert TransferFailed();
        emit FeesWithdrawn(amount);
    }

    function withdraw() external noReentrant {
        uint256 amount = pendingWithdrawals[msg.sender];
        if (amount == 0) revert NoFeesToWithdraw();
        pendingWithdrawals[msg.sender] = 0;
        (bool success,) = msg.sender.call{value: amount}("");
        if (!success) revert TransferFailed();
    }

    function getMatch(uint256 matchId) external view returns (Match memory) {
        return matches[matchId];
    }

    function getTotalPrize(uint256 matchId) external view returns (uint256) {
        Match memory m = matches[matchId];
        uint256 totalEntries = m.entryFee * 2;
        uint256 adminCut = (totalEntries * FEE_BPS) / 10000;
        return m.sponsorPrize + totalEntries - adminCut;
    }

    function getTokenPrize(uint256 matchId) external view returns (address token, uint256 amount) {
        TokenPrize memory p = tokenPrizes[matchId];
        return (p.token, p.amount);
    }

    function isMatchExpired(uint256 matchId) external view returns (bool) {
        Match memory m = matches[matchId];
        return block.timestamp >= m.deadline && (m.status == MatchStatus.Open || m.status == MatchStatus.Full);
    }

    function getMatchNftPrize(uint256 matchId) external view returns (address collection, uint256 tokenId) {
        NftPrize memory p = matches[matchId].nftPrize;
        return (p.collection, p.tokenId);
    }

    function _authorizeUpgrade(address) internal view override onlyAdmin {}

    function _createMatch(
        uint256 entryFee,
        bytes32 gameHash,
        address nftCollection,
        uint256 nftTokenId
    ) internal returns (uint256 matchId) {
        if (entryFee < MIN_ENTRY_FEE || entryFee > MAX_ENTRY_FEE) revert InvalidEntryFee();
        if (gameHash == bytes32(0)) revert InvalidGameHash();

        matchId = ++matchCount;
        Match storage m = matches[matchId];
        m.id = matchId;
        m.sponsorPrize = msg.value;
        m.entryFee = entryFee;
        m.status = MatchStatus.Open;
        m.createdAt = uint64(block.timestamp);
        m.deadline = uint64(block.timestamp + MATCH_TIMEOUT);
        m.gameHash = gameHash;
        m.nftPrize = NftPrize(nftCollection, nftTokenId);

        emit MatchCreated(matchId, msg.value, entryFee, gameHash, nftCollection, nftTokenId);
    }

    function _escrowTokenPrize(uint256 matchId, address prizeToken, uint256 prizeAmount) internal {
        if (prizeToken == address(0) || prizeAmount == 0) revert InvalidTokenPrize();
        IERC20 token = IERC20(prizeToken);
        uint256 beforeBalance = token.balanceOf(address(this));
        token.safeTransferFrom(msg.sender, address(this), prizeAmount);
        uint256 received = token.balanceOf(address(this)) - beforeBalance;
        if (received != prizeAmount) revert TokenNotReceived();
        tokenPrizes[matchId] = TokenPrize(prizeToken, prizeAmount);
        emit TokenPrizeEscrowed(matchId, prizeToken, prizeAmount);
    }

    function _sendTokenPrize(uint256 matchId, address winner) internal {
        TokenPrize storage p = tokenPrizes[matchId];
        if (p.token == address(0)) return;
        address token = p.token;
        uint256 amount = p.amount;
        delete tokenPrizes[matchId];
        IERC20(token).safeTransfer(winner, amount);
        emit TokenPrizePaid(matchId, token, winner, amount);
    }

    function _returnTokenPrize(uint256 matchId) internal {
        TokenPrize storage p = tokenPrizes[matchId];
        if (p.token == address(0)) return;
        address token = p.token;
        uint256 amount = p.amount;
        delete tokenPrizes[matchId];
        IERC20(token).safeTransfer(admin, amount);
        emit TokenPrizeReturned(matchId, token, admin, amount);
    }

    function _clearActiveMatch(address player, uint256 matchId) internal {
        if (activeMatch[player] == matchId) {
            activeMatch[player] = 0;
        }
    }

    function _safeTransfer(address to, uint256 amount) internal {
        (bool success,) = to.call{value: amount}("");
        if (!success) {
            pendingWithdrawals[to] += amount;
            emit WithdrawalPending(to, amount);
        }
    }
}
