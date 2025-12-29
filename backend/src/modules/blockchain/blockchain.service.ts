import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { prisma } from '../../plugins/prisma.js';
import { CONFIG } from '../../config/index.js';
import { createContextLogger } from '../../utils/logger.js';
import { Block, BlockData } from '../../types/index.js';

const logger = createContextLogger('Blockchain');

// Blockchain file paths
const BLOCKCHAIN_DIR = CONFIG.blockchain.dataPath;
const CHAIN_FILE = path.join(BLOCKCHAIN_DIR, 'chain.json');
const INDEX_FILE = path.join(BLOCKCHAIN_DIR, 'index.json');

// In-memory chain for faster access
let chain: Block[] = [];
const chainIndex: Map<string, number> = new Map();

export enum BlockchainRecordType {
  TICKET_CREATED = 'TICKET_CREATED',
  TICKET_RESOLVED = 'TICKET_RESOLVED',
  RESPONSE_SUBMITTED = 'RESPONSE_SUBMITTED',
  TIME_LOGGED = 'TIME_LOGGED',
  CERTIFICATE_ISSUED = 'CERTIFICATE_ISSUED',
}

/**
 * Calculate hash for a block
 */
function calculateHash(block: Omit<Block, 'hash'>): string {
  const data = JSON.stringify({
    index: block.index,
    timestamp: block.timestamp,
    data: block.data,
    prevHash: block.prevHash,
    nonce: block.nonce,
  });
  return createHash('sha256').update(data).digest('hex');
}

/**
 * Create genesis block
 */
function createGenesisBlock(): Block {
  const genesisData: BlockData = {
    type: 'GENESIS',
    metadata: {
      message: 'ODAN Blockchain Genesis Block',
      version: '1.0.0',
      createdAt: new Date().toISOString(),
    },
  };

  const block: Omit<Block, 'hash'> = {
    index: 0,
    timestamp: new Date(),
    data: genesisData,
    prevHash: '0',
    nonce: 0,
  };

  return {
    ...block,
    hash: calculateHash(block),
  };
}

/**
 * Ensure blockchain directory exists
 */
function ensureBlockchainDir(): void {
  if (!fs.existsSync(BLOCKCHAIN_DIR)) {
    fs.mkdirSync(BLOCKCHAIN_DIR, { recursive: true });
    logger.info(`Created blockchain directory: ${BLOCKCHAIN_DIR}`);
  }
}

/**
 * Save chain to disk
 */
async function saveChain(): Promise<void> {
  ensureBlockchainDir();
  
  try {
    // Save main chain
    fs.writeFileSync(CHAIN_FILE, JSON.stringify(chain, null, 2));
    
    // Save index for quick lookups
    const indexObj = Object.fromEntries(chainIndex);
    fs.writeFileSync(INDEX_FILE, JSON.stringify(indexObj, null, 2));
    
    logger.debug(`Saved chain with ${chain.length} blocks`);
  } catch (error) {
    logger.error('Failed to save blockchain to disk', error);
    throw error;
  }
}

/**
 * Load chain from disk
 */
async function loadChain(): Promise<void> {
  ensureBlockchainDir();

  try {
    if (fs.existsSync(CHAIN_FILE)) {
      const data = fs.readFileSync(CHAIN_FILE, 'utf-8');
      chain = JSON.parse(data);
      
      // Rebuild index
      chainIndex.clear();
      chain.forEach((block, idx) => {
        chainIndex.set(block.hash, idx);
      });
      
      logger.info(`Loaded blockchain with ${chain.length} blocks`);
    } else {
      // Initialize with genesis block
      chain = [createGenesisBlock()];
      chainIndex.set(chain[0].hash, 0);
      await saveChain();
      logger.info('Created new blockchain with genesis block');
    }
  } catch (error) {
    logger.error('Failed to load blockchain from disk', error);
    // Start fresh if corrupted
    chain = [createGenesisBlock()];
    chainIndex.set(chain[0].hash, 0);
    await saveChain();
  }
}

/**
 * Validate the entire chain
 */
function validateChain(): boolean {
  for (let i = 1; i < chain.length; i++) {
    const currentBlock = chain[i];
    const previousBlock = chain[i - 1];

    // Check hash
    const recalculatedHash = calculateHash({
      index: currentBlock.index,
      timestamp: currentBlock.timestamp,
      data: currentBlock.data,
      prevHash: currentBlock.prevHash,
      nonce: currentBlock.nonce,
    });

    if (currentBlock.hash !== recalculatedHash) {
      logger.error(`Invalid hash at block ${i}`);
      return false;
    }

    // Check previous hash link
    if (currentBlock.prevHash !== previousBlock.hash) {
      logger.error(`Invalid previous hash at block ${i}`);
      return false;
    }
  }

  return true;
}

/**
 * Initialize blockchain
 */
export async function initBlockchain(): Promise<void> {
  await loadChain();
  
  // Validate chain integrity
  if (!validateChain()) {
    logger.error('Blockchain validation failed! Chain may be corrupted.');
    // In production, you might want to restore from backup or halt
  }
  
  // Sync with database (backup records)
  await syncWithDatabase();
  
  logger.info('Blockchain initialized successfully');
}

/**
 * Sync blockchain records with database (backup)
 */
async function syncWithDatabase(): Promise<void> {
  try {
    // Get last synced index from database
    const lastRecord = await prisma.blockchainRecord.findFirst({
      orderBy: { index: 'desc' },
    });

    const lastSyncedIndex = lastRecord?.index ?? -1;

    // Sync new blocks
    for (let i = lastSyncedIndex + 1; i < chain.length; i++) {
      const block = chain[i];
      await prisma.blockchainRecord.create({
        data: {
          index: block.index,
          type: block.data.type as any,
          data: block.data as any,
          hash: block.hash,
          prevHash: block.prevHash,
          timestamp: new Date(block.timestamp),
          nonce: block.nonce,
        },
      }).catch(() => {
        // Ignore duplicate key errors
      });
    }

    logger.debug(`Synced ${chain.length - lastSyncedIndex - 1} blocks to database`);
  } catch (error) {
    logger.error('Failed to sync blockchain with database', error);
  }
}

/**
 * Add a new record to the blockchain
 */
export async function addRecord(
  type: BlockchainRecordType,
  data: Omit<BlockData, 'type'>
): Promise<Block> {
  const lastBlock = chain[chain.length - 1];

  const blockData: BlockData = {
    type,
    ...data,
  };

  const newBlock: Omit<Block, 'hash'> = {
    index: lastBlock.index + 1,
    timestamp: new Date(),
    data: blockData,
    prevHash: lastBlock.hash,
    nonce: 0,
  };

  // Simple proof of work (low difficulty for speed)
  let hash = calculateHash(newBlock);
  while (!hash.startsWith('0')) {
    newBlock.nonce++;
    hash = calculateHash(newBlock);
  }

  const finalBlock: Block = {
    ...newBlock,
    hash,
  };

  // Add to chain
  chain.push(finalBlock);
  chainIndex.set(finalBlock.hash, finalBlock.index);

  // Save to disk
  await saveChain();

  // Sync to database
  await prisma.blockchainRecord.create({
    data: {
      index: finalBlock.index,
      type: type as any,
      data: blockData as any,
      hash: finalBlock.hash,
      prevHash: finalBlock.prevHash,
      timestamp: new Date(finalBlock.timestamp),
      nonce: finalBlock.nonce,
    },
  }).catch(() => {});

  logger.debug(`Added block ${finalBlock.index} with hash ${finalBlock.hash}`);

  return finalBlock;
}

/**
 * Get block by hash
 */
export function getBlockByHash(hash: string): Block | undefined {
  const index = chainIndex.get(hash);
  if (index !== undefined) {
    return chain[index];
  }
  return undefined;
}

/**
 * Get block by index
 */
export function getBlockByIndex(index: number): Block | undefined {
  return chain[index];
}

/**
 * Get all records for a user
 */
export function getRecordsForUser(userId: string): Block[] {
  return chain.filter(block => 
    block.data.userId === userId ||
    block.data.volunteerId === userId
  );
}

/**
 * Get all records for a ticket
 */
export function getRecordsForTicket(ticketId: string): Block[] {
  return chain.filter(block => block.data.ticketId === ticketId);
}

/**
 * Calculate total time for a user from blockchain
 */
export function calculateUserTime(userId: string): number {
  return chain
    .filter(block => 
      (block.data.type === BlockchainRecordType.RESPONSE_SUBMITTED ||
       block.data.type === BlockchainRecordType.TIME_LOGGED) &&
      block.data.userId === userId
    )
    .reduce((total, block) => total + (block.data.timeSpent || 0), 0);
}

/**
 * Verify data against blockchain
 */
export function verifyUserStats(
  userId: string,
  claimedHours: number,
  claimedTickets: number
): { valid: boolean; actualHours: number; actualTickets: number } {
  const actualSeconds = calculateUserTime(userId);
  const actualHours = Math.floor(actualSeconds / 3600);
  
  const actualTickets = chain.filter(block => 
    block.data.type === BlockchainRecordType.TICKET_RESOLVED &&
    block.data.volunteerId === userId
  ).length;

  return {
    valid: actualHours >= claimedHours && actualTickets >= claimedTickets,
    actualHours,
    actualTickets,
  };
}

/**
 * Get chain length
 */
export function getChainLength(): number {
  return chain.length;
}

/**
 * Get latest block
 */
export function getLatestBlock(): Block {
  return chain[chain.length - 1];
}
