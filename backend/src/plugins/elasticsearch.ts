import { Client } from '@elastic/elasticsearch';
import { CONFIG } from '../config/index.js';
import { createContextLogger } from '../utils/logger.js';

const logger = createContextLogger('ElasticSearch');

let esClient: Client | null = null;

export function getElasticsearch(): Client {
  if (!esClient) {
    esClient = new Client({
      node: CONFIG.elasticsearch.url,
    });
  }
  return esClient;
}

export async function checkElasticsearchConnection(): Promise<boolean> {
  try {
    const client = getElasticsearch();
    const health = await client.cluster.health({});
    logger.info(`Cluster health: ${health.status}`);
    return true;
  } catch (error) {
    logger.error('Failed to connect to ElasticSearch', error);
    return false;
  }
}

// Ticket search index name
export const TICKETS_INDEX = 'tickets';

// Index a ticket
export async function indexTicket(ticket: {
  id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  createdAt: Date;
}): Promise<void> {
  try {
    const client = getElasticsearch();
    await client.index({
      index: TICKETS_INDEX,
      id: ticket.id,
      document: {
        id: ticket.id,
        title: ticket.title,
        description: ticket.description,
        category: ticket.category,
        status: ticket.status,
        createdAt: ticket.createdAt,
      },
    });
    logger.debug(`Indexed ticket ${ticket.id}`);
  } catch (error) {
    logger.error(`Failed to index ticket ${ticket.id}`, error);
    throw error;
  }
}

// Update ticket in index
export async function updateTicketIndex(
  ticketId: string,
  updates: Partial<{
    title: string;
    description: string;
    category: string;
    status: string;
  }>
): Promise<void> {
  try {
    const client = getElasticsearch();
    await client.update({
      index: TICKETS_INDEX,
      id: ticketId,
      doc: updates,
    });
    logger.debug(`Updated ticket ${ticketId} in index`);
  } catch (error) {
    logger.error(`Failed to update ticket ${ticketId} in index`, error);
  }
}

// Delete ticket from index
export async function deleteTicketFromIndex(ticketId: string): Promise<void> {
  try {
    const client = getElasticsearch();
    await client.delete({
      index: TICKETS_INDEX,
      id: ticketId,
    });
    logger.debug(`Deleted ticket ${ticketId} from index`);
  } catch (error) {
    logger.error(`Failed to delete ticket ${ticketId} from index`, error);
  }
}

// Search for similar tickets
export async function searchSimilarTickets(
  query: string,
  options: {
    category?: string;
    excludeId?: string;
    limit?: number;
    minScore?: number;
  } = {}
): Promise<Array<{
  id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  score: number;
}>> {
  const { category, excludeId, limit = 5, minScore = 0.5 } = options;

  try {
    const client = getElasticsearch();
    
    const must: Record<string, unknown>[] = [
      {
        multi_match: {
          query,
          fields: ['title^3', 'description'],
          type: 'best_fields',
          fuzziness: 'AUTO',
        },
      },
    ];

    const mustNot: Record<string, unknown>[] = [];

    if (category) {
      must.push({ term: { category } });
    }

    if (excludeId) {
      mustNot.push({ term: { id: excludeId } });
    }

    const response = await client.search({
      index: TICKETS_INDEX,
      body: {
        query: {
          bool: {
            must,
            must_not: mustNot,
          },
        },
        min_score: minScore,
        size: limit,
      },
    });

    return response.hits.hits.map((hit: any) => ({
      id: hit._source?.id,
      title: hit._source?.title,
      description: hit._source?.description,
      category: hit._source?.category,
      status: hit._source?.status,
      score: hit._score || 0,
    }));
  } catch (error) {
    logger.error('Failed to search similar tickets', error);
    return [];
  }
}

// Search tickets with pagination
export async function searchTickets(
  query: string,
  options: {
    category?: string;
    status?: string;
    page?: number;
    limit?: number;
  } = {}
): Promise<{
  hits: Array<{
    id: string;
    title: string;
    description: string;
    category: string;
    status: string;
    score: number;
  }>;
  total: number;
}> {
  const { category, status, page = 1, limit = 20 } = options;

  try {
    const client = getElasticsearch();
    
    const must: Record<string, unknown>[] = [];
    const filter: Record<string, unknown>[] = [];

    if (query) {
      must.push({
        multi_match: {
          query,
          fields: ['title^3', 'description'],
          type: 'best_fields',
          fuzziness: 'AUTO',
        },
      });
    }

    if (category) {
      filter.push({ term: { category } });
    }

    if (status) {
      filter.push({ term: { status } });
    }

    const response = await client.search({
      index: TICKETS_INDEX,
      body: {
        query: {
          bool: {
            must: must.length > 0 ? must : [{ match_all: {} }],
            filter,
          },
        },
        from: (page - 1) * limit,
        size: limit,
        sort: ['_score:desc', 'createdAt:desc'],
      },
    });

    const total = typeof response.hits.total === 'number'
      ? response.hits.total
      : response.hits.total?.value || 0;

    return {
      hits: response.hits.hits.map((hit: any) => ({
        id: hit._source?.id,
        title: hit._source?.title,
        description: hit._source?.description,
        category: hit._source?.category,
        status: hit._source?.status,
        score: hit._score || 0,
      })),
      total,
    };
  } catch (error) {
    logger.error('Failed to search tickets', error);
    return { hits: [], total: 0 };
  }
}

// Check for exact or near-exact duplicate
export async function checkForDuplicate(
  title: string,
  description: string
): Promise<{
  isDuplicate: boolean;
  duplicateId?: string;
  duplicateTitle?: string;
  similarity?: number;
}> {
  try {
    const client = getElasticsearch();
    
    // Search for exact title match first
    const exactMatch = await client.search({
      index: TICKETS_INDEX,
      body: {
        query: {
          bool: {
            must: [
              { match_phrase: { title } },
            ],
          },
        },
        size: 1,
      },
    });

    if (exactMatch.hits.hits.length > 0) {
      const hit = exactMatch.hits.hits[0] as { _source: any };
      return {
        isDuplicate: true,
        duplicateId: hit._source.id,
        duplicateTitle: hit._source.title,
        similarity: 1.0,
      };
    }

    // Search for high similarity
    const similarMatch = await client.search({
      index: TICKETS_INDEX,
      body: {
        query: {
          more_like_this: {
            fields: ['title', 'description'],
            like: `${title} ${description}`,
            min_term_freq: 1,
            min_doc_freq: 1,
            minimum_should_match: '80%',
          },
        },
        min_score: 5,
        size: 1,
      },
    });

    if (similarMatch.hits.hits.length > 0) {
      const hit = similarMatch.hits.hits[0] as { _source: any; _score?: number };
      const score = hit._score || 0;
      const maxScore = similarMatch.hits.max_score || score;
      const similarity = score / maxScore;

      if (similarity > 0.9) {
        return {
          isDuplicate: true,
          duplicateId: hit._source.id,
          duplicateTitle: hit._source.title,
          similarity,
        };
      }
    }

    return { isDuplicate: false };
  } catch (error) {
    logger.error('Failed to check for duplicate', error);
    return { isDuplicate: false };
  }
}
