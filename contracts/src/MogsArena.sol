// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title MogsArena v2 — Hardened match-based prize system for Monad Mogs
/// @notice Admin creates matches (2-player). Each player joins with entry fee.
///         Backend resolves the match, winner takes the pot. Timeouts, reentrancy
///         protection, per-player limits, and draw handling built in.
contract MogsArena {
    /* ------------------------------------------------------------------ */
    /*  Types                                                               */
    /* ------------------------------------------------------------------ */

    enum MatchStatus {
        Open,       // waiting for 2 players
        Full,       // 2 players joined, waiting for resolution
        Resolved,   // winner decided, prize sent
        Draw,       // draw — both players refunded
        Cancelled,  // admin cancelled, refunds issued
        Expired     // timed out, refunds issued
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
        uint64 deadline;        // auto-expire after this timestamp
        bytes32 gameHash;       // hash of offchain game ID for verification
    }

    /* ------------------------------------------------------------------ */
    /*  State                                                               */
    /* ------------------------------------------------------------------ */

    address public immutable admin;
    uint256 public matchCount;
    mapping(uint256 => Match) public matches;

    // Per-player active match tracking — one active match at a time
    mapping(address => uint256) public activeMatch;

    uint256 public constant MAX_ENTRY_FEE = 100 ether;
    uint256 public constant MIN_ENTRY_FEE = 0.001 ether;
    uint256 public constant MATCH_TIMEOUT = 2 hours;
    uint256 public constant FEE_BPS = 500; // 5% in basis points
    uint256 public feeCollected;

    bool public paused;
    bool private _locked;

    /* ------------------------------------------------------------------ */
    /*  Events                                                              */
    /* ------------------------------------------------------------------ */

    event MatchCreated(uint256 indexed matchId, uint256 sponsorPrize, uint256 entryFee, bytes32 gameHash);
    event PlayerJoined(uint256 indexed matchId, address indexed player, uint8 slot);
    event MatchResolved(uint256 indexed matchId, address indexed winner, uint256 prize);
    event MatchDraw(uint256 indexed matchId);
    event MatchCancelled(uint256 indexed matchId);
    event MatchExpired(uint256 indexed matchId);
    event FeesWithdrawn(uint256 amount);
    event Paused();
    event Unpaused();

    /* ------------------------------------------------------------------ */
    /*  Errors                                                              */
    /* ------------------------------------------------------------------ */

    error OnlyAdmin();
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
    error NoFeesToWithdraw();
    error ContractPaused();

    /* ------------------------------------------------------------------ */
    /*  Modifiers                                                           */
    /* ------------------------------------------------------------------ */

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

    /* ------------------------------------------------------------------ */
    /*  Constructor                                                         */
    /* ------------------------------------------------------------------ */

    constructor() {
        admin = msg.sender;
    }

    /* ------------------------------------------------------------------ */
    /*  Admin: Create Match                                                 */
    /* ------------------------------------------------------------------ */

    /// @notice Create a new match. msg.value is the sponsor prize.
    /// @param entryFee MON each player must pay to join
    /// @param gameHash keccak256 of the offchain game ID for cross-reference
    function createMatch(uint256 entryFee, bytes32 gameHash) external payable onlyAdmin whenNotPaused returns (uint256 matchId) {
        if (entryFee < MIN_ENTRY_FEE || entryFee > MAX_ENTRY_FEE) revert InvalidEntryFee();
        if (gameHash == bytes32(0)) revert InvalidGameHash();

        matchId = ++matchCount;
        matches[matchId] = Match({
            id: matchId,
            sponsorPrize: msg.value,
            entryFee: entryFee,
            player1: address(0),
            player2: address(0),
            winner: address(0),
            status: MatchStatus.Open,
            createdAt: uint64(block.timestamp),
            resolvedAt: 0,
            deadline: uint64(block.timestamp + MATCH_TIMEOUT),
            gameHash: gameHash
        });

        emit MatchCreated(matchId, msg.value, entryFee, gameHash);
    }

    /* ------------------------------------------------------------------ */
    /*  Player: Join Match                                                  */
    /* ------------------------------------------------------------------ */

    /// @notice Join an open match by paying the entry fee
    function joinMatch(uint256 matchId) external payable noReentrant whenNotPaused {
        Match storage m = matches[matchId];
        if (m.status != MatchStatus.Open) revert MatchNotOpen();
        if (block.timestamp >= m.deadline) revert MatchNotExpired(); // don't join expired matches
        if (msg.value != m.entryFee) revert WrongEntryFee();
        if (msg.sender == m.player1) revert AlreadyJoined();

        // One active match per player
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
            activeMatch[msg.sender] = matchId;
            emit PlayerJoined(matchId, msg.sender, 2);
        }
    }

    /* ------------------------------------------------------------------ */
    /*  Admin: Resolve Match                                                */
    /* ------------------------------------------------------------------ */

    /// @notice Resolve a full match with a winner
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

        // Clear active match for both players
        _clearActiveMatch(m.player1, matchId);
        _clearActiveMatch(m.player2, matchId);

        (bool success,) = winner.call{value: prize}("");
        if (!success) revert TransferFailed();

        emit MatchResolved(matchId, winner, prize);
    }

    /// @notice Resolve a full match as a draw — both players refunded entry + split sponsor
    function resolveDraw(uint256 matchId) external onlyAdmin noReentrant {
        Match storage m = matches[matchId];
        if (m.status != MatchStatus.Full) revert MatchNotFull();

        m.status = MatchStatus.Draw;
        m.resolvedAt = uint64(block.timestamp);

        uint256 halfSponsor = m.sponsorPrize / 2;
        uint256 remainder = m.sponsorPrize - (halfSponsor * 2); // 0 or 1 wei
        uint256 refundP1 = m.entryFee + halfSponsor + remainder; // P1 gets the extra wei
        uint256 refundP2 = m.entryFee + halfSponsor;

        _clearActiveMatch(m.player1, matchId);
        _clearActiveMatch(m.player2, matchId);

        (bool s1,) = m.player1.call{value: refundP1}("");
        if (!s1) revert TransferFailed();
        (bool s2,) = m.player2.call{value: refundP2}("");
        if (!s2) revert TransferFailed();

        emit MatchDraw(matchId);
    }

    /* ------------------------------------------------------------------ */
    /*  Admin: Cancel Match                                                 */
    /* ------------------------------------------------------------------ */

    /// @notice Cancel an open or full match. Refunds all participants.
    ///         Uses pending withdrawals if direct transfer fails.
    function cancelMatch(uint256 matchId) external onlyAdmin noReentrant {
        Match storage m = matches[matchId];
        if (m.status == MatchStatus.Resolved || m.status == MatchStatus.Cancelled
            || m.status == MatchStatus.Draw || m.status == MatchStatus.Expired) {
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

        emit MatchCancelled(matchId);
    }

    /* ------------------------------------------------------------------ */
    /*  Anyone: Expire Timed-Out Match                                      */
    /* ------------------------------------------------------------------ */

    /// @notice Expire a match that passed its deadline. Anyone can call this.
    ///         Refunds all participants and sponsor prize.
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

        emit MatchExpired(matchId);
    }

    /* ------------------------------------------------------------------ */
    /*  Admin: Withdraw Fees                                                */
    /* ------------------------------------------------------------------ */

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

    /* ------------------------------------------------------------------ */
    /*  Views                                                               */
    /* ------------------------------------------------------------------ */

    function getMatch(uint256 matchId) external view returns (Match memory) {
        return matches[matchId];
    }

    function getTotalPrize(uint256 matchId) external view returns (uint256) {
        Match memory m = matches[matchId];
        uint256 totalEntries = m.entryFee * 2;
        uint256 adminCut = (totalEntries * FEE_BPS) / 10000;
        return m.sponsorPrize + totalEntries - adminCut;
    }

    function isMatchExpired(uint256 matchId) external view returns (bool) {
        Match memory m = matches[matchId];
        return block.timestamp >= m.deadline
            && (m.status == MatchStatus.Open || m.status == MatchStatus.Full);
    }

    /* ------------------------------------------------------------------ */
    /*  Pending Withdrawals (fallback if direct transfer fails)             */
    /* ------------------------------------------------------------------ */

    mapping(address => uint256) public pendingWithdrawals;

    event WithdrawalPending(address indexed player, uint256 amount);

    /// @notice Withdraw pending funds if a direct transfer failed during cancel/expire
    function withdraw() external noReentrant {
        uint256 amount = pendingWithdrawals[msg.sender];
        if (amount == 0) revert NoFeesToWithdraw();
        pendingWithdrawals[msg.sender] = 0;
        (bool success,) = msg.sender.call{value: amount}("");
        if (!success) revert TransferFailed();
    }

    /* ------------------------------------------------------------------ */
    /*  Internal                                                            */
    /* ------------------------------------------------------------------ */

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
