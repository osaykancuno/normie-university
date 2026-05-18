// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title  IPathRegistry
/// @notice Catalogue of curated Learning Paths — bundles of skills sold at
///         a discount. v1: protocol-curated only (admin creates paths).
///         v2: open to creators with bond + review.
interface IPathRegistry {
    // =========================================================================
    //                              EVENTS
    // =========================================================================

    event PathCreated(
        uint256 indexed pathId,
        address indexed creator,
        string name,
        uint256[] skillIds,
        uint16 discountBps,
        uint256 timestamp
    );

    event PathUpdated(
        uint256 indexed pathId,
        address indexed editor,
        uint256 timestamp
    );

    event PathDeactivated(uint256 indexed pathId, uint256 timestamp);

    event PathPurchased(
        address indexed agent,
        uint256 indexed pathId,
        uint256 amountPaid,
        bool paidInUsdc,
        uint256 timestamp
    );

    // =========================================================================
    //                              STRUCTS
    // =========================================================================

    struct PathParams {
        string name;
        string description;
        uint256[] skillIds;     // ordered list of skills in the path
        uint16 discountBps;     // e.g. 2500 = 25% off the sum of individual skill prices
        string contentURI;      // optional IPFS docs / curriculum
    }

    struct Path {
        uint256 pathId;
        string name;
        string description;
        uint256[] skillIds;
        uint16 discountBps;
        string contentURI;
        address creator;
        uint256 createdAt;
        uint256 updatedAt;
        bool isActive;
        uint256 totalPurchases;
    }

    // =========================================================================
    //                              FUNCTIONS
    // =========================================================================

    function createPath(PathParams calldata params) external returns (uint256 pathId);
    function updatePath(uint256 pathId, PathParams calldata params) external;
    function deactivatePath(uint256 pathId) external;

    /// @notice Buy a path with native ETH — pays the discounted bundle price.
    function purchasePath(uint256 pathId) external payable;

    /// @notice Buy a path with USDC (requires prior approve to the registry).
    function purchasePathWithUsdc(uint256 pathId) external;

    function getPath(uint256 pathId) external view returns (Path memory);
    function getPathPriceInWei(uint256 pathId) external view returns (uint256);
    function getPathPriceInUsdc(uint256 pathId) external view returns (uint256);
    function totalPaths() external view returns (uint256);
}
