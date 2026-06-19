// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {PixelOracleAnchor} from "../src/anchor/PixelOracleAnchor.sol";
import {IPixelOracleAnchor} from "../src/anchor/interfaces/IPixelOracleAnchor.sol";

contract PixelOracleAnchorTest is Test {
    PixelOracleAnchor internal anchor;

    uint256 internal universityPk = 0xAAA1;
    uint256 internal oraclePk     = 0xBEEF;
    address internal universitySigner;
    address internal oracleSigner;

    function setUp() public {
        universitySigner = vm.addr(universityPk);
        oracleSigner     = vm.addr(oraclePk);
        anchor = new PixelOracleAnchor(universitySigner, oracleSigner);
    }

    // -----------------------------------------------------------------
    // Construction
    // -----------------------------------------------------------------
    function test_constructor_storesSigners() public view {
        assertEq(anchor.universitySigner(), universitySigner);
        assertEq(anchor.oracleSigner(), oracleSigner);
        assertEq(anchor.latestEpoch(), 0);
    }

    function test_constructor_revertsOnZeroSigner() public {
        vm.expectRevert();
        new PixelOracleAnchor(address(0), oracleSigner);
        vm.expectRevert();
        new PixelOracleAnchor(universitySigner, address(0));
    }

    function test_constructor_revertsOnEqualSigners() public {
        vm.expectRevert();
        new PixelOracleAnchor(universitySigner, universitySigner);
    }

    // -----------------------------------------------------------------
    // Checkpoint signature verification
    // -----------------------------------------------------------------
    function test_checkpoint_succeedsWithBothSignatures() public {
        uint256 epochId = 1;
        bytes32 merkleRoot = keccak256("hello");
        uint256 anchorBlock = block.number;
        uint32 credCount = 5;
        uint32 repCount = 7;

        bytes32 stateRoot = _expectedStateRoot(epochId, merkleRoot, credCount, repCount);
        bytes32 digest = _checkpointDigest(epochId, stateRoot, anchorBlock, credCount, repCount);

        bytes memory univSig = _sign(universityPk, digest);
        bytes memory oracSig = _sign(oraclePk, digest);

        anchor.checkpoint(epochId, merkleRoot, anchorBlock, credCount, repCount, univSig, oracSig);

        assertEq(anchor.latestEpoch(), epochId);
        assertEq(anchor.stateRootOf(epochId), stateRoot);
        assertEq(anchor.merkleRootOf(epochId), merkleRoot);
        (uint32 c, uint32 r) = anchor.decodeCounts(epochId);
        assertEq(c, credCount);
        assertEq(r, repCount);
    }

    function test_checkpoint_rejectsBadUniversitySig() public {
        uint256 epochId = 1;
        bytes32 merkleRoot = keccak256("x");

        bytes32 stateRoot = _expectedStateRoot(epochId, merkleRoot, 1, 1);
        bytes32 digest = _checkpointDigest(epochId, stateRoot, 0, 1, 1);
        bytes memory bad = _sign(0xDEAD, digest);
        bytes memory oracSig = _sign(oraclePk, digest);

        vm.expectRevert(abi.encodeWithSelector(PixelOracleAnchor.InvalidSignature.selector, "university"));
        anchor.checkpoint(epochId, merkleRoot, 0, 1, 1, bad, oracSig);
    }

    function test_checkpoint_rejectsBadOracleSig() public {
        uint256 epochId = 1;
        bytes32 merkleRoot = keccak256("x");
        bytes32 stateRoot = _expectedStateRoot(epochId, merkleRoot, 1, 1);
        bytes32 digest = _checkpointDigest(epochId, stateRoot, 0, 1, 1);

        bytes memory univSig = _sign(universityPk, digest);
        bytes memory bad = _sign(0xDEAD, digest);

        vm.expectRevert(abi.encodeWithSelector(PixelOracleAnchor.InvalidSignature.selector, "oracle"));
        anchor.checkpoint(epochId, merkleRoot, 0, 1, 1, univSig, bad);
    }

    function test_checkpoint_rejectsReplay() public {
        uint256 epochId = 1;
        bytes32 merkleRoot = keccak256("x");
        bytes32 stateRoot = _expectedStateRoot(epochId, merkleRoot, 1, 1);
        bytes32 digest = _checkpointDigest(epochId, stateRoot, 0, 1, 1);
        bytes memory univSig = _sign(universityPk, digest);
        bytes memory oracSig = _sign(oraclePk, digest);

        anchor.checkpoint(epochId, merkleRoot, 0, 1, 1, univSig, oracSig);

        vm.expectRevert();
        anchor.checkpoint(epochId, merkleRoot, 0, 1, 1, univSig, oracSig);
    }

    function test_checkpoint_enforcesMonotonicEpoch() public {
        // commit epoch 5
        {
            bytes32 merkleRoot = keccak256("x");
            bytes32 stateRoot = _expectedStateRoot(5, merkleRoot, 1, 1);
            bytes32 digest = _checkpointDigest(5, stateRoot, 0, 1, 1);
            anchor.checkpoint(5, merkleRoot, 0, 1, 1, _sign(universityPk, digest), _sign(oraclePk, digest));
        }
        // attempt to commit epoch 4
        bytes32 m2 = keccak256("y");
        bytes32 s2 = _expectedStateRoot(4, m2, 0, 0);
        bytes32 d2 = _checkpointDigest(4, s2, 0, 0, 0);
        vm.expectRevert();
        anchor.checkpoint(4, m2, 0, 0, 0, _sign(universityPk, d2), _sign(oraclePk, d2));
    }

    // -----------------------------------------------------------------
    // Single-leaf credential verification (root = leaf)
    // -----------------------------------------------------------------
    function test_verifyCredential_singleLeaf() public {
        IPixelOracleAnchor.Credential memory c = IPixelOracleAnchor.Credential({
            tokenId: 42,
            skillId: bytes32(uint256(0xabcd)),
            issuedAt: 1_700_000_000,
            nonce: 1,
            evidenceTxHash: bytes32(uint256(0xdead))
        });
        bytes32 leaf = _credLeaf(c);

        bytes32 stateRoot = _expectedStateRoot(1, leaf, 1, 0);
        bytes32 digest = _checkpointDigest(1, stateRoot, 0, 1, 0);
        anchor.checkpoint(1, leaf, 0, 1, 0, _sign(universityPk, digest), _sign(oraclePk, digest));

        bytes32[] memory proof = new bytes32[](0);
        bool[] memory flags = new bool[](0);
        assertTrue(anchor.verifyCredential(1, c, proof, flags));
    }

    function test_verifyCredential_rejectsTampered() public {
        IPixelOracleAnchor.Credential memory c = IPixelOracleAnchor.Credential({
            tokenId: 42,
            skillId: bytes32(uint256(0xabcd)),
            issuedAt: 1_700_000_000,
            nonce: 1,
            evidenceTxHash: bytes32(uint256(0xdead))
        });
        bytes32 leaf = _credLeaf(c);
        bytes32 stateRoot = _expectedStateRoot(1, leaf, 1, 0);
        bytes32 digest = _checkpointDigest(1, stateRoot, 0, 1, 0);
        anchor.checkpoint(1, leaf, 0, 1, 0, _sign(universityPk, digest), _sign(oraclePk, digest));

        // tamper with nonce
        c.nonce = 2;
        bytes32[] memory proof = new bytes32[](0);
        bool[] memory flags = new bool[](0);
        assertFalse(anchor.verifyCredential(1, c, proof, flags));
    }

    // -----------------------------------------------------------------
    // Multi-leaf proof
    // -----------------------------------------------------------------
    function test_verifyCredential_twoLeafProof() public {
        IPixelOracleAnchor.Credential memory c0 = _makeCred(0, 1);
        IPixelOracleAnchor.Credential memory c1 = _makeCred(1, 1);
        bytes32 leaf0 = _credLeaf(c0);
        bytes32 leaf1 = _credLeaf(c1);
        bytes32 root = sha256(abi.encodePacked(leaf0, leaf1));

        bytes32 stateRoot = _expectedStateRoot(1, root, 2, 0);
        bytes32 digest = _checkpointDigest(1, stateRoot, 0, 2, 0);
        anchor.checkpoint(1, root, 0, 2, 0, _sign(universityPk, digest), _sign(oraclePk, digest));

        // proof for c0 (left child): sibling is leaf1, on the right.
        bytes32[] memory proof = new bytes32[](1);
        proof[0] = leaf1;
        bool[] memory flags = new bool[](1);
        flags[0] = false; // sibling on the right
        assertTrue(anchor.verifyCredential(1, c0, proof, flags));

        // proof for c1 (right child): sibling is leaf0, on the left.
        bytes32[] memory proof2 = new bytes32[](1);
        proof2[0] = leaf0;
        bool[] memory flags2 = new bool[](1);
        flags2[0] = true;
        assertTrue(anchor.verifyCredential(1, c1, proof2, flags2));
    }

    function test_verifyCredential_unknownEpochReverts() public {
        IPixelOracleAnchor.Credential memory c = _makeCred(0, 1);
        bytes32[] memory proof = new bytes32[](0);
        bool[] memory flags = new bool[](0);
        vm.expectRevert();
        anchor.verifyCredential(999, c, proof, flags);
    }

    function test_verifyCredential_proofLengthMismatchReverts() public {
        IPixelOracleAnchor.Credential memory c = _makeCred(0, 1);
        bytes32 leaf = _credLeaf(c);
        bytes32 stateRoot = _expectedStateRoot(1, leaf, 1, 0);
        bytes32 digest = _checkpointDigest(1, stateRoot, 0, 1, 0);
        anchor.checkpoint(1, leaf, 0, 1, 0, _sign(universityPk, digest), _sign(oraclePk, digest));

        bytes32[] memory proof = new bytes32[](1);
        proof[0] = bytes32(0);
        bool[] memory flags = new bool[](0);
        vm.expectRevert();
        anchor.verifyCredential(1, c, proof, flags);
    }

    // -----------------------------------------------------------------
    // Fuzz: random credentials always produce distinct leaves
    // -----------------------------------------------------------------
    function testFuzz_credentialLeafIsCollisionResistant(
        uint16 tokenIdA, uint16 tokenIdB,
        bytes32 skillA, bytes32 skillB,
        uint64 nonceA, uint64 nonceB
    ) public {
        vm.assume(tokenIdA < 10_000);
        vm.assume(tokenIdB < 10_000);
        IPixelOracleAnchor.Credential memory a = IPixelOracleAnchor.Credential({
            tokenId: tokenIdA, skillId: skillA, issuedAt: 1, nonce: nonceA, evidenceTxHash: bytes32(uint256(1))
        });
        IPixelOracleAnchor.Credential memory b = IPixelOracleAnchor.Credential({
            tokenId: tokenIdB, skillId: skillB, issuedAt: 1, nonce: nonceB, evidenceTxHash: bytes32(uint256(1))
        });
        bool sameInputs = tokenIdA == tokenIdB && skillA == skillB && nonceA == nonceB;
        if (sameInputs) {
            assertEq(_credLeaf(a), _credLeaf(b));
        } else {
            assertTrue(_credLeaf(a) != _credLeaf(b));
        }
    }

    // -----------------------------------------------------------------
    // Helpers — mirror the off-chain core/anchor.ts logic exactly
    // -----------------------------------------------------------------
    function _makeCred(uint256 tokenId, uint64 nonce) internal pure returns (IPixelOracleAnchor.Credential memory) {
        return IPixelOracleAnchor.Credential({
            tokenId: tokenId,
            skillId: bytes32(uint256(0xc0ffee)),
            issuedAt: 1_700_000_000,
            nonce: nonce,
            evidenceTxHash: bytes32(uint256(0xfeed))
        });
    }

    function _credLeaf(IPixelOracleAnchor.Credential memory c) internal pure returns (bytes32) {
        return sha256(
            abi.encodePacked(
                bytes("PIXEL_ANCHOR_CREDENTIAL_V1"),
                _u32be(uint32(c.tokenId)),
                c.skillId,
                _u64be(c.issuedAt),
                _u64be(c.nonce),
                c.evidenceTxHash
            )
        );
    }

    function _expectedStateRoot(uint256 epochId, bytes32 merkleRoot, uint32 credCount, uint32 repCount)
        internal pure returns (bytes32)
    {
        return sha256(
            abi.encodePacked(
                bytes("PIXEL_ANCHOR_STATE_V1"),
                _u64be(uint64(epochId)),
                merkleRoot,
                _u32be(credCount),
                _u32be(repCount)
            )
        );
    }

    function _checkpointDigest(
        uint256 epochId, bytes32 stateRoot, uint256 anchorBlock, uint32 cred, uint32 rep
    ) internal view returns (bytes32) {
        bytes32 typeHash = keccak256(
            "Checkpoint(uint256 epochId,bytes32 stateRoot,uint256 anchorBlock,uint64 credentialCount,uint64 reputationCount)"
        );
        bytes32 structHash = keccak256(abi.encode(typeHash, epochId, stateRoot, anchorBlock, uint64(cred), uint64(rep)));
        bytes32 domain = anchor.DOMAIN_SEPARATOR();
        return keccak256(abi.encodePacked("\x19\x01", domain, structHash));
    }

    function _sign(uint256 pk, bytes32 digest) internal pure returns (bytes memory sig) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        sig = abi.encodePacked(r, s, v);
    }

    function _u32be(uint32 x) internal pure returns (bytes memory b) {
        b = new bytes(4);
        b[0] = bytes1(uint8(x >> 24));
        b[1] = bytes1(uint8(x >> 16));
        b[2] = bytes1(uint8(x >> 8));
        b[3] = bytes1(uint8(x));
    }
    function _u64be(uint64 x) internal pure returns (bytes memory b) {
        b = new bytes(8);
        b[0] = bytes1(uint8(x >> 56));
        b[1] = bytes1(uint8(x >> 48));
        b[2] = bytes1(uint8(x >> 40));
        b[3] = bytes1(uint8(x >> 32));
        b[4] = bytes1(uint8(x >> 24));
        b[5] = bytes1(uint8(x >> 16));
        b[6] = bytes1(uint8(x >> 8));
        b[7] = bytes1(uint8(x));
    }
}

// vm.sign emits ECDSA components — Foundry built-in.
interface IVm {
    function sign(uint256 pk, bytes32 digest) external pure returns (uint8 v, bytes32 r, bytes32 s);
}
