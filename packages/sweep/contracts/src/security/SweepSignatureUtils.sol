// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title SweepSignatureVerifier
/// @author Sweep Team
/// @notice Signature verification utilities for Sweep contracts
/// @dev Provides EIP-712 and ECDSA signature verification
library SweepSignatureVerifier {
    // ============================================================
    // ERRORS
    // ============================================================

    error InvalidSignature();
    error SignatureExpired();
    error InvalidSignatureLength();
    error InvalidS();
    error InvalidV();

    // ============================================================
    // SIGNATURE VERIFICATION
    // ============================================================

    /// @notice Recover signer from ECDSA signature
    /// @param hash Message hash that was signed
    /// @param signature ECDSA signature (65 bytes)
    /// @return signer Recovered signer address
    function recoverSigner(bytes32 hash, bytes memory signature) internal pure returns (address signer) {
        if (signature.length != 65) revert InvalidSignatureLength();

        bytes32 r;
        bytes32 s;
        uint8 v;

        // Extract r, s, v from signature
        assembly {
            r := mload(add(signature, 32))
            s := mload(add(signature, 64))
            v := byte(0, mload(add(signature, 96)))
        }

        // EIP-2 conformance check
        if (uint256(s) > 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0) {
            revert InvalidS();
        }

        // Normalize v
        if (v < 27) {
            v += 27;
        }

        if (v != 27 && v != 28) {
            revert InvalidV();
        }

        // Recover signer
        signer = ecrecover(hash, v, r, s);
        if (signer == address(0)) revert InvalidSignature();
    }

    /// @notice Recover signer from compact ECDSA signature (EIP-2098)
    /// @param hash Message hash that was signed
    /// @param r R component of signature
    /// @param vs VS component (v in high bit, s in low 255 bits)
    /// @return signer Recovered signer address
    function recoverSignerCompact(bytes32 hash, bytes32 r, bytes32 vs) internal pure returns (address signer) {
        bytes32 s = vs & bytes32(0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF);
        uint8 v = uint8((uint256(vs) >> 255) + 27);

        // EIP-2 conformance check
        if (uint256(s) > 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0) {
            revert InvalidS();
        }

        signer = ecrecover(hash, v, r, s);
        if (signer == address(0)) revert InvalidSignature();
    }

    /// @notice Verify a signature is valid for a hash and signer
    /// @param hash Message hash
    /// @param signature ECDSA signature
    /// @param expectedSigner Expected signer address
    /// @return valid Whether signature is valid
    function verifySignature(
        bytes32 hash,
        bytes memory signature,
        address expectedSigner
    ) internal pure returns (bool valid) {
        address recovered = recoverSigner(hash, signature);
        return recovered == expectedSigner;
    }

    /// @notice Create EIP-191 signed message hash
    /// @param messageHash Original message hash
    /// @return ethSignedMessageHash Ethereum signed message hash
    function toEthSignedMessageHash(bytes32 messageHash) internal pure returns (bytes32 ethSignedMessageHash) {
        assembly {
            mstore(0x00, "\x19Ethereum Signed Message:\n32")
            mstore(0x1c, messageHash)
            ethSignedMessageHash := keccak256(0x00, 0x3c)
        }
    }
}

/// @title SweepEIP712
/// @notice EIP-712 typed data hashing for Sweep
library SweepEIP712 {
    /// @notice EIP-712 type hash for domain separator
    bytes32 internal constant TYPE_HASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");

    /// @notice Build domain separator
    /// @param name Contract name
    /// @param version Contract version
    /// @param verifyingContract Contract address
    /// @return domainSeparator The EIP-712 domain separator
    function buildDomainSeparator(
        string memory name,
        string memory version,
        address verifyingContract
    ) internal view returns (bytes32 domainSeparator) {
        return keccak256(
            abi.encode(
                TYPE_HASH,
                keccak256(bytes(name)),
                keccak256(bytes(version)),
                block.chainid,
                verifyingContract
            )
        );
    }

    /// @notice Hash typed data with domain separator
    /// @param domainSeparator The domain separator
    /// @param structHash The struct hash
    /// @return digest The EIP-712 digest
    function hashTypedData(bytes32 domainSeparator, bytes32 structHash) internal pure returns (bytes32 digest) {
        assembly {
            let freeMemoryPointer := mload(0x40)
            mstore(freeMemoryPointer, "\x19\x01")
            mstore(add(freeMemoryPointer, 0x02), domainSeparator)
            mstore(add(freeMemoryPointer, 0x22), structHash)
            digest := keccak256(freeMemoryPointer, 0x42)
        }
    }
}

/// @title SweepMerkleProof
/// @notice Merkle proof verification for whitelists
library SweepMerkleProof {
    /// @notice Verify a Merkle proof
    /// @param proof Array of proof hashes
    /// @param root Merkle root
    /// @param leaf Leaf to verify
    /// @return valid Whether proof is valid
    function verify(
        bytes32[] calldata proof,
        bytes32 root,
        bytes32 leaf
    ) internal pure returns (bool valid) {
        bytes32 computedHash = leaf;

        for (uint256 i = 0; i < proof.length; ) {
            bytes32 proofElement = proof[i];

            if (computedHash <= proofElement) {
                computedHash = keccak256(abi.encodePacked(computedHash, proofElement));
            } else {
                computedHash = keccak256(abi.encodePacked(proofElement, computedHash));
            }

            unchecked {
                ++i;
            }
        }

        return computedHash == root;
    }

    /// @notice Verify a Merkle proof for an address
    /// @param proof Array of proof hashes
    /// @param root Merkle root
    /// @param account Address to verify
    /// @return valid Whether proof is valid
    function verifyAddress(
        bytes32[] calldata proof,
        bytes32 root,
        address account
    ) internal pure returns (bool valid) {
        bytes32 leaf = keccak256(abi.encodePacked(account));
        return verify(proof, root, leaf);
    }

    /// @notice Verify a Merkle proof for an address with amount
    /// @param proof Array of proof hashes
    /// @param root Merkle root
    /// @param account Address to verify
    /// @param amount Amount associated with address
    /// @return valid Whether proof is valid
    function verifyAddressWithAmount(
        bytes32[] calldata proof,
        bytes32 root,
        address account,
        uint256 amount
    ) internal pure returns (bool valid) {
        bytes32 leaf = keccak256(abi.encodePacked(account, amount));
        return verify(proof, root, leaf);
    }
}
