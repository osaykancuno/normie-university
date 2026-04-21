// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title SkillTypes
/// @notice Shared types, structs, enums, and custom errors for the SKILLAI protocol
library SkillTypes {
    // =========================================================================
    //                              ENUMS
    // =========================================================================

    /// @notice Skill difficulty levels
    enum Difficulty {
        Beginner,    // 0
        Intermediate, // 1
        Advanced,    // 2
        Expert       // 3
    }

    /// @notice Skill categories
    enum Category {
        DeFi,        // 0
        NFT,         // 1
        Governance,  // 2
        Social,      // 3
        Trading,     // 4
        Security,    // 5
        CrossChain,  // 6
        Custom       // 7
    }

    /// @notice Reputation tiers based on score
    enum ReputationTier {
        Novice,      // 0     - 0 to 1999
        Apprentice,  // 1  - 2000 to 3999
        Skilled,     // 2  - 4000 to 5999
        Expert,      // 3  - 6000 to 7999
        Master       // 4  - 8000 to 10000
    }

    /// @notice Verification types for skill completion
    enum VerificationType {
        OffChainSigned, // 0 - Off-chain proof, verified via ECDSA signature
        OnChainTx       // 1 - On-chain tx proof submitted by agent
    }

    // =========================================================================
    //                              STRUCTS
    // =========================================================================

    /// @notice Profile of a registered agent (ERC-8004 Identity compliant)
    /// @dev Each agent is represented as an ERC-721 NFT. The tokenId is the agent's
    ///      canonical identity. The registrationFileURI follows the ERC-8004 spec
    ///      (JSON file with agent metadata, supported protocols, endpoints, etc.)
    struct AgentProfile {
        uint256 tokenId;             // ERC-721 tokenId (agent identity)
        address agentAddress;        // Owner / controller address
        string  registrationFileURI; // ERC-8004 registration file URI (IPFS / HTTPS)
        uint256 registeredAt;
        uint256 updatedAt;
        bool    isActive;
    }

    /// @notice Full description of a skill available on the platform
    struct Skill {
        uint256  skillId;
        string   name;
        string   description;
        Category category;
        Difficulty difficulty;
        uint256  priceInWei;   // Price in ETH (wei). 0 = free
        uint256  priceInUsdc;  // Price in USDC (6 decimals). 0 = not available in USDC
        uint256[] prerequisites; // skillIds that must be acquired first
        string   contentURI;   // IPFS URI pointing to the skill module JSON
        address  creator;
        uint256  createdAt;
        uint256  updatedAt;
        bool     isActive;
        uint256  totalPurchases;
        uint256  totalCompletions;
        uint256  ratingSum;    // Sum of all ratings (1-5)
        uint256  ratingCount;  // Number of ratings
    }

    /// @notice Parameters for creating or updating a skill
    struct SkillParams {
        string   name;
        string   description;
        Category category;
        Difficulty difficulty;
        uint256  priceInWei;
        uint256  priceInUsdc;
        uint256[] prerequisites;
        string   contentURI;
    }

    /// @notice A skill credential (Soulbound Token) issued to an agent
    struct CredentialData {
        uint256 tokenId;
        address agent;
        uint256 skillId;
        uint8   level;        // 1 = Base, 2 = Advanced, 3 = Expert
        uint256 score;        // 0-100
        uint256 acquiredAt;
        bool    verified;
    }

    /// @notice A pending purchase / escrow record
    struct Purchase {
        address agent;
        uint256 skillId;
        uint256 amountPaid;   // in wei (ETH) or USDC raw amount
        bool    paidInUsdc;
        uint256 purchasedAt;
        bool    completed;
        bool    refunded;
    }

    /// @notice Reputation snapshot for an agent
    struct ReputationData {
        uint256 score;            // 0-10000 (basis points)
        ReputationTier tier;
        uint256 skillCount;
        uint256 avgSkillLevel;    // 1-3 scaled by 100 (e.g. 150 = 1.5)
        uint256 categoryDiversity;// Number of distinct categories
        uint256 avgVerifyScore;   // 0-100 scaled
        uint256 lastUpdated;
    }
}

// =========================================================================
//                          GLOBAL CUSTOM ERRORS
// =========================================================================
// Declared outside library so they can be used directly in contracts

error SkillAI__NotRegistered(address caller);
error SkillAI__AlreadyRegistered(address agent);
error SkillAI__NotSkillCreator(address caller, uint256 skillId);
error SkillAI__SkillNotFound(uint256 skillId);
error SkillAI__SkillNotActive(uint256 skillId);
error SkillAI__PrerequisiteNotMet(uint256 missingSkillId);
error SkillAI__InsufficientPayment(uint256 sent, uint256 required);
error SkillAI__AlreadyPurchased(address agent, uint256 skillId);
error SkillAI__AlreadyCompleted(address agent, uint256 skillId);
error SkillAI__PurchaseNotFound(address agent, uint256 skillId);
error SkillAI__RefundExpired();
error SkillAI__InvalidRating(uint8 rating);
error SkillAI__NotVerifier(address caller);
error SkillAI__InvalidSignature();
error SkillAI__InvalidMetadataURI();
error SkillAI__InvalidContentURI();
error SkillAI__InvalidPrice();
error SkillAI__TransferNotAllowed();
error SkillAI__ZeroAddress();
error SkillAI__InvalidScore(uint256 score);
error SkillAI__InvalidLevel(uint8 level);
error SkillAI__Cooldown(uint256 availableAt);
error SkillAI__WithdrawFailed();
