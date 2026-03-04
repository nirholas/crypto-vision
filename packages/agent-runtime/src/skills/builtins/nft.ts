/**
 * NFT Skills — Minting, Listing, Transfer, Collection Info
 *
 * Interact with ERC-721 and ERC-1155 NFTs on BNB Chain and EVM networks.
 */

import type { Skill, SkillHandler } from '../types.js';
import type { DataPart, TaskSendParams } from '../../protocols/a2a/types.js';

function extractParams(params: TaskSendParams): Record<string, unknown> {
  for (const part of params.message?.parts ?? []) {
    if (part.type === 'data') return (part as DataPart).data;
    if (part.type === 'text') {
      try { return JSON.parse(part.text) as Record<string, unknown>; } catch { /* continue */ }
    }
  }
  return {};
}

// ─── Transfer NFT Skill ────────────────────────────────────────────

const transferHandler: SkillHandler = async (params, context) => {
  const data = extractParams(params);
  const { collection, tokenId, to, standard } = data;

  if (!collection || !tokenId || !to) {
    return { status: 'failed', message: 'Missing required parameters: collection, tokenId, to' };
  }

  context.logger.info('Transferring NFT', {
    collection: String(collection), tokenId: String(tokenId), to: String(to),
  });

  try {
    const { ethers } = await import('ethers');
    const rpcUrls: Record<string, string> = {
      'bsc': 'https://bsc-dataseed1.binance.org',
      'bsc-testnet': 'https://data-seed-prebsc-1-s1.binance.org:8545',
    };
    const provider = new ethers.JsonRpcProvider(rpcUrls[context.chain] ?? rpcUrls['bsc']);
    const wallet = new ethers.Wallet(context.privateKey, provider);

    const isErc1155 = standard === 'ERC-1155' || standard === 'erc1155';

    if (isErc1155) {
      const amount = data.amount ?? 1;
      const abi = [
        'function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes data)',
      ];
      const contract = new ethers.Contract(String(collection), abi, wallet);
      const tx = await contract.safeTransferFrom(
        wallet.address, String(to), BigInt(String(tokenId)), BigInt(String(amount)), '0x'
      );
      const receipt = await tx.wait();

      return {
        status: 'completed',
        result: {
          transactionHash: receipt.hash,
          standard: 'ERC-1155',
          collection: String(collection),
          tokenId: String(tokenId),
          amount: String(amount),
          from: wallet.address,
          to: String(to),
          chain: context.chain,
        },
        message: `Transferred ${amount}x NFT #${tokenId} to ${String(to).slice(0, 10)}...`,
      };
    }

    // ERC-721
    const erc721Abi = [
      'function safeTransferFrom(address from, address to, uint256 tokenId)',
      'function ownerOf(uint256 tokenId) view returns (address)',
    ];
    const contract = new ethers.Contract(String(collection), erc721Abi, wallet);

    // Verify ownership
    const owner = await contract.ownerOf(BigInt(String(tokenId))) as string;
    if (owner.toLowerCase() !== wallet.address.toLowerCase()) {
      return { status: 'failed', message: `Not the owner of token #${tokenId}. Owner: ${owner}` };
    }

    const tx = await contract.safeTransferFrom(wallet.address, String(to), BigInt(String(tokenId)));
    const receipt = await tx.wait();

    return {
      status: 'completed',
      result: {
        transactionHash: receipt.hash,
        standard: 'ERC-721',
        collection: String(collection),
        tokenId: String(tokenId),
        from: wallet.address,
        to: String(to),
        chain: context.chain,
      },
      message: `Transferred NFT #${tokenId} to ${String(to).slice(0, 10)}...`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { status: 'failed', message: `NFT transfer failed: ${message}` };
  }
};

// ─── NFT Metadata Skill ────────────────────────────────────────────

const metadataHandler: SkillHandler = async (params, context) => {
  const data = extractParams(params);
  const { collection, tokenId } = data;

  if (!collection || tokenId === undefined) {
    return { status: 'failed', message: 'Missing required parameters: collection, tokenId' };
  }

  try {
    const { ethers } = await import('ethers');
    const rpcUrls: Record<string, string> = {
      'bsc': 'https://bsc-dataseed1.binance.org',
      'bsc-testnet': 'https://data-seed-prebsc-1-s1.binance.org:8545',
    };
    const provider = new ethers.JsonRpcProvider(rpcUrls[context.chain] ?? rpcUrls['bsc']);

    const abi = [
      'function tokenURI(uint256 tokenId) view returns (string)',
      'function ownerOf(uint256 tokenId) view returns (address)',
      'function name() view returns (string)',
      'function symbol() view returns (string)',
      'function totalSupply() view returns (uint256)',
    ];

    const contract = new ethers.Contract(String(collection), abi, provider);
    const pid = BigInt(String(tokenId));

    const [tokenURI, owner, name, symbol] = await Promise.all([
      contract.tokenURI(pid).catch(() => null) as Promise<string | null>,
      contract.ownerOf(pid).catch(() => null) as Promise<string | null>,
      contract.name().catch(() => null) as Promise<string | null>,
      contract.symbol().catch(() => null) as Promise<string | null>,
    ]);

    let metadata: Record<string, unknown> | null = null;
    if (tokenURI) {
      let resolvedUri = tokenURI;
      if (resolvedUri.startsWith('ipfs://')) {
        resolvedUri = `https://ipfs.io/ipfs/${resolvedUri.slice(7)}`;
      }
      if (resolvedUri.startsWith('http')) {
        try {
          const resp = await fetch(resolvedUri, { signal: AbortSignal.timeout(15_000) });
          if (resp.ok) {
            metadata = await resp.json() as Record<string, unknown>;
          }
        } catch { /* metadata fetch failed, non-critical */ }
      }
    }

    return {
      status: 'completed',
      result: {
        collection: String(collection),
        tokenId: String(tokenId),
        name: metadata?.name ?? name ?? 'Unknown',
        symbol: symbol ?? 'Unknown',
        description: metadata?.description ?? null,
        image: metadata?.image ?? null,
        attributes: metadata?.attributes ?? [],
        tokenURI: tokenURI ?? null,
        owner: owner ?? 'Unknown',
        chain: context.chain,
        timestamp: new Date().toISOString(),
      },
      message: `NFT #${tokenId}: ${metadata?.name ?? name ?? 'Unknown'} — Owner: ${(owner ?? 'Unknown').slice(0, 10)}...`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { status: 'failed', message: `NFT metadata failed: ${message}` };
  }
};

// ─── Collection Info Skill ──────────────────────────────────────────

const collectionInfoHandler: SkillHandler = async (params, context) => {
  const data = extractParams(params);
  const { collection } = data;

  if (!collection) {
    return { status: 'failed', message: 'Missing required parameter: collection' };
  }

  try {
    const { ethers } = await import('ethers');
    const rpcUrls: Record<string, string> = {
      'bsc': 'https://bsc-dataseed1.binance.org',
      'bsc-testnet': 'https://data-seed-prebsc-1-s1.binance.org:8545',
    };
    const provider = new ethers.JsonRpcProvider(rpcUrls[context.chain] ?? rpcUrls['bsc']);

    const abi = [
      'function name() view returns (string)',
      'function symbol() view returns (string)',
      'function totalSupply() view returns (uint256)',
      'function owner() view returns (address)',
      'function supportsInterface(bytes4 interfaceId) view returns (bool)',
    ];

    const contract = new ethers.Contract(String(collection), abi, provider);

    const [name, symbol, totalSupply, contractOwner] = await Promise.all([
      contract.name().catch(() => 'Unknown') as Promise<string>,
      contract.symbol().catch(() => 'Unknown') as Promise<string>,
      contract.totalSupply().catch(() => 0n) as Promise<bigint>,
      contract.owner().catch(() => null) as Promise<string | null>,
    ]);

    // Check supported interfaces
    const ERC721_INTERFACE = '0x80ac58cd';
    const ERC1155_INTERFACE = '0xd9b67a26';
    const ERC2981_INTERFACE = '0x2a55205a'; // Royalty

    const [isErc721, isErc1155, hasRoyalties] = await Promise.all([
      contract.supportsInterface(ERC721_INTERFACE).catch(() => false) as Promise<boolean>,
      contract.supportsInterface(ERC1155_INTERFACE).catch(() => false) as Promise<boolean>,
      contract.supportsInterface(ERC2981_INTERFACE).catch(() => false) as Promise<boolean>,
    ]);

    let standard = 'Unknown';
    if (isErc721) standard = 'ERC-721';
    else if (isErc1155) standard = 'ERC-1155';

    return {
      status: 'completed',
      result: {
        collection: String(collection),
        name,
        symbol,
        standard,
        totalSupply: totalSupply.toString(),
        owner: contractOwner,
        hasRoyalties,
        chain: context.chain,
        timestamp: new Date().toISOString(),
      },
      message: `${name} (${symbol}) — ${standard}, ${totalSupply.toString()} tokens`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { status: 'failed', message: `Collection info failed: ${message}` };
  }
};

// ─── Set Approval Skill ─────────────────────────────────────────────

const approvalHandler: SkillHandler = async (params, context) => {
  const data = extractParams(params);
  const { collection, operator, approved, tokenId } = data;

  if (!collection || !operator) {
    return { status: 'failed', message: 'Missing required parameters: collection, operator' };
  }

  context.logger.info('Setting NFT approval', {
    collection: String(collection), operator: String(operator),
  });

  try {
    const { ethers } = await import('ethers');
    const rpcUrls: Record<string, string> = {
      'bsc': 'https://bsc-dataseed1.binance.org',
      'bsc-testnet': 'https://data-seed-prebsc-1-s1.binance.org:8545',
    };
    const provider = new ethers.JsonRpcProvider(rpcUrls[context.chain] ?? rpcUrls['bsc']);
    const wallet = new ethers.Wallet(context.privateKey, provider);

    // If tokenId is provided, approve for specific token; otherwise setApprovalForAll
    if (tokenId !== undefined) {
      const abi = ['function approve(address to, uint256 tokenId)'];
      const contract = new ethers.Contract(String(collection), abi, wallet);
      const tx = await contract.approve(String(operator), BigInt(String(tokenId)));
      const receipt = await tx.wait();

      return {
        status: 'completed',
        result: {
          transactionHash: receipt.hash,
          type: 'approve',
          collection: String(collection),
          tokenId: String(tokenId),
          approved: String(operator),
          chain: context.chain,
        },
        message: `Approved ${String(operator).slice(0, 10)}... for token #${tokenId}`,
      };
    }

    const isApproved = approved !== false && approved !== 'false';
    const abi = ['function setApprovalForAll(address operator, bool approved)'];
    const contract = new ethers.Contract(String(collection), abi, wallet);
    const tx = await contract.setApprovalForAll(String(operator), isApproved);
    const receipt = await tx.wait();

    return {
      status: 'completed',
      result: {
        transactionHash: receipt.hash,
        type: 'setApprovalForAll',
        collection: String(collection),
        operator: String(operator),
        approved: isApproved,
        chain: context.chain,
      },
      message: `${isApproved ? 'Approved' : 'Revoked'} ${String(operator).slice(0, 10)}... for all tokens`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { status: 'failed', message: `NFT approval failed: ${message}` };
  }
};

// ─── Skill Definitions ─────────────────────────────────────────────

export const transferNftSkill: Skill = {
  definition: {
    id: 'nft/transfer',
    name: 'Transfer NFT',
    description: 'Transfer an ERC-721 or ERC-1155 NFT to another address. Verifies ownership before transfer.',
    category: 'nft',
    version: '1.0.0',
    tags: ['nft', 'transfer', 'erc721', 'erc1155'],
    inputModes: ['application/json'],
    outputModes: ['application/json'],
    chains: ['bsc', 'bsc-testnet', 'ethereum'],
    parameters: {
      collection: { type: 'string', description: 'NFT contract address', required: true },
      tokenId: { type: 'string', description: 'Token ID to transfer', required: true },
      to: { type: 'string', description: 'Recipient address', required: true },
      standard: { type: 'string', description: 'Token standard: ERC-721 (default) or ERC-1155' },
      amount: { type: 'number', description: 'Amount for ERC-1155 transfers (default: 1)' },
    },
    requiredConfig: ['PRIVATE_KEY'],
  },
  handler: transferHandler,
};

export const nftMetadataSkill: Skill = {
  definition: {
    id: 'nft/metadata',
    name: 'NFT Metadata',
    description: 'Get full metadata for an NFT: name, description, image, attributes, owner, and tokenURI. Resolves IPFS URIs.',
    category: 'nft',
    version: '1.0.0',
    tags: ['nft', 'metadata', 'erc721', 'info'],
    inputModes: ['application/json'],
    outputModes: ['application/json'],
    chains: ['bsc', 'bsc-testnet', 'ethereum'],
    parameters: {
      collection: { type: 'string', description: 'NFT contract address', required: true },
      tokenId: { type: 'string', description: 'Token ID', required: true },
    },
  },
  handler: metadataHandler,
};

export const collectionInfoSkill: Skill = {
  definition: {
    id: 'nft/collection-info',
    name: 'Collection Info',
    description: 'Get information about an NFT collection: name, symbol, total supply, standard (ERC-721/1155), and royalty support.',
    category: 'nft',
    version: '1.0.0',
    tags: ['nft', 'collection', 'info', 'erc721', 'erc1155'],
    inputModes: ['application/json'],
    outputModes: ['application/json'],
    chains: ['bsc', 'bsc-testnet', 'ethereum'],
    parameters: {
      collection: { type: 'string', description: 'NFT contract address', required: true },
    },
  },
  handler: collectionInfoHandler,
};

export const nftApprovalSkill: Skill = {
  definition: {
    id: 'nft/approval',
    name: 'NFT Approval',
    description: 'Approve or revoke operators for NFT transfers. Supports single-token approve and setApprovalForAll.',
    category: 'nft',
    version: '1.0.0',
    tags: ['nft', 'approval', 'operator', 'erc721'],
    inputModes: ['application/json'],
    outputModes: ['application/json'],
    chains: ['bsc', 'bsc-testnet', 'ethereum'],
    parameters: {
      collection: { type: 'string', description: 'NFT contract address', required: true },
      operator: { type: 'string', description: 'Operator address to approve/revoke', required: true },
      approved: { type: 'boolean', description: 'Whether to approve or revoke (default: true)' },
      tokenId: { type: 'string', description: 'Specific token ID (omit for setApprovalForAll)' },
    },
    requiredConfig: ['PRIVATE_KEY'],
  },
  handler: approvalHandler,
};

/** All NFT skills */
export const nftSkills: Skill[] = [
  transferNftSkill,
  nftMetadataSkill,
  collectionInfoSkill,
  nftApprovalSkill,
];
