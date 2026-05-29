// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title MogsArena — Prize pool for Monad Mogs agent games
/// @notice Admin creates pools with a sponsor prize. Two players join with an entry fee.
///         Backend resolves the game and the winner takes the full pool.
contract MogsArena {
    /* ------------------------------------------------------------------ */
    /*  Types                                                               */
    /* ------------------------------------------------------------------ */

    enum PoolStatus {
        Open,       // waiting for players
        Full,       // two players joined, waiting for resolution
        Resolved,   // winner decided, prize sent
        Cancelled   // admin cancelled, refunds issued
    }

    struct Pool {
        uint256 id;
        uint256 sponsorPrize;   // MON deposited by admin
        uint256 entryFee;       // MON each player must pay
        address player1;
        address player2;
        address winner;
        PoolStatus status;
        uint64 createdAt;
        uint64 resolvedAt;
    }

    /* ------------------------------------------------------------------ */
    /*  State                                                               */
    /* ------------------------------------------------------------------ */

    address public immutable admin;
    uint256 public poolCount;
    mapping(uint256 => Pool) public pools;

    uint256 public constant MAX_ENTRY_FEE = 100 ether;
    uint256 public feeCollected; // admin's cut from resolved pools

    /* ------------------------------------------------------------------ */
    /*  Events                                                              */
    /* ------------------------------------------------------------------ */

    event PoolCreated(uint256 indexed poolId, uint256 sponsorPrize, uint256 entryFee);
    event PlayerJoined(uint256 indexed poolId, address indexed player, uint8 slot);
    event PoolResolved(uint256 indexed poolId, address indexed winner, uint256 prize);
    event PoolCancelled(uint256 indexed poolId);

    /* ------------------------------------------------------------------ */
    /*  Errors                                                              */
    /* ------------------------------------------------------------------ */

    error OnlyAdmin();
    error InvalidEntryFee();
    error PoolNotOpen();
    error PoolNotFull();
    error AlreadyJoined();
    error WrongEntryFee();
    error InvalidWinner();
    error TransferFailed();

    /* ------------------------------------------------------------------ */
    /*  Modifiers                                                           */
    /* ------------------------------------------------------------------ */

    modifier onlyAdmin() {
        if (msg.sender != admin) revert OnlyAdmin();
        _;
    }

    /* ------------------------------------------------------------------ */
    /*  Constructor                                                         */
    /* ------------------------------------------------------------------ */

    constructor() {
        admin = msg.sender;
    }

    /* ------------------------------------------------------------------ */
    /*  Admin: Create Pool                                                  */
    /* ------------------------------------------------------------------ */

    /// @notice Create a new prize pool. msg.value is the sponsor prize.
    /// @param entryFee MON each player must pay to join
    function createPool(uint256 entryFee) external payable onlyAdmin returns (uint256 poolId) {
        if (entryFee == 0 || entryFee > MAX_ENTRY_FEE) revert InvalidEntryFee();

        poolId = ++poolCount;
        pools[poolId] = Pool({
            id: poolId,
            sponsorPrize: msg.value,
            entryFee: entryFee,
            player1: address(0),
            player2: address(0),
            winner: address(0),
            status: PoolStatus.Open,
            createdAt: uint64(block.timestamp),
            resolvedAt: 0
        });

        emit PoolCreated(poolId, msg.value, entryFee);
    }

    /* ------------------------------------------------------------------ */
    /*  Player: Join Pool                                                   */
    /* ------------------------------------------------------------------ */

    /// @notice Join an open pool by paying the entry fee
    function joinPool(uint256 poolId) external payable {
        Pool storage pool = pools[poolId];
        if (pool.status != PoolStatus.Open) revert PoolNotOpen();
        if (msg.value != pool.entryFee) revert WrongEntryFee();
        if (msg.sender == pool.player1) revert AlreadyJoined();

        if (pool.player1 == address(0)) {
            pool.player1 = msg.sender;
            emit PlayerJoined(poolId, msg.sender, 1);
        } else {
            pool.player2 = msg.sender;
            pool.status = PoolStatus.Full;
            emit PlayerJoined(poolId, msg.sender, 2);
        }
    }

    /* ------------------------------------------------------------------ */
    /*  Admin: Resolve Pool                                                 */
    /* ------------------------------------------------------------------ */

    /// @notice Resolve a full pool. Winner receives sponsor prize + both entry fees.
    /// @param poolId The pool to resolve
    /// @param winner Must be player1 or player2
    function resolvePool(uint256 poolId, address winner) external onlyAdmin {
        Pool storage pool = pools[poolId];
        if (pool.status != PoolStatus.Full) revert PoolNotFull();
        if (winner != pool.player1 && winner != pool.player2) revert InvalidWinner();

        pool.winner = winner;
        pool.status = PoolStatus.Resolved;
        pool.resolvedAt = uint64(block.timestamp);

        // Winner gets: sponsor prize + both entry fees (minus 5% admin fee)
        uint256 totalEntries = pool.entryFee * 2;
        uint256 adminCut = totalEntries * 5 / 100;
        uint256 prize = pool.sponsorPrize + totalEntries - adminCut;

        feeCollected += adminCut;

        (bool success,) = winner.call{value: prize}("");
        if (!success) revert TransferFailed();

        emit PoolResolved(poolId, winner, prize);
    }

    /* ------------------------------------------------------------------ */
    /*  Admin: Cancel Pool                                                  */
    /* ------------------------------------------------------------------ */

    /// @notice Cancel an open or full pool. Refunds all participants.
    function cancelPool(uint256 poolId) external onlyAdmin {
        Pool storage pool = pools[poolId];
        if (pool.status == PoolStatus.Resolved || pool.status == PoolStatus.Cancelled) {
            revert PoolNotOpen();
        }

        pool.status = PoolStatus.Cancelled;

        // Refund players
        if (pool.player1 != address(0)) {
            (bool s1,) = pool.player1.call{value: pool.entryFee}("");
            if (!s1) revert TransferFailed();
        }
        if (pool.player2 != address(0)) {
            (bool s2,) = pool.player2.call{value: pool.entryFee}("");
            if (!s2) revert TransferFailed();
        }

        // Refund sponsor prize to admin
        if (pool.sponsorPrize > 0) {
            (bool s3,) = admin.call{value: pool.sponsorPrize}("");
            if (!s3) revert TransferFailed();
        }

        emit PoolCancelled(poolId);
    }

    /* ------------------------------------------------------------------ */
    /*  Admin: Withdraw Fees                                                */
    /* ------------------------------------------------------------------ */

    /// @notice Withdraw accumulated admin fees
    function withdrawFees() external onlyAdmin {
        uint256 amount = feeCollected;
        feeCollected = 0;
        (bool success,) = admin.call{value: amount}("");
        if (!success) revert TransferFailed();
    }

    /* ------------------------------------------------------------------ */
    /*  Views                                                               */
    /* ------------------------------------------------------------------ */

    function getPool(uint256 poolId) external view returns (Pool memory) {
        return pools[poolId];
    }

    function getTotalPrize(uint256 poolId) external view returns (uint256) {
        Pool memory pool = pools[poolId];
        uint256 totalEntries = pool.entryFee * 2;
        uint256 adminCut = totalEntries * 5 / 100;
        return pool.sponsorPrize + totalEntries - adminCut;
    }
}
