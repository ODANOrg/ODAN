import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { searchTickets, searchSimilarTickets } from '../../plugins/elasticsearch.js';

// Schemas
const searchQuerySchema = z.object({
  q: z.string().min(1),
  category: z.string().optional(),
  status: z.string().optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
});

const similarQuerySchema = z.object({
  text: z.string().min(5),
  category: z.string().optional(),
  limit: z.string().optional(),
});

export default async function searchRoutes(server: FastifyInstance) {
  // Search tickets
  server.get('/tickets', async (request: FastifyRequest) => {
    const query = searchQuerySchema.parse(request.query);

    const page = parseInt(query.page || '1', 10);
    const limit = Math.min(parseInt(query.limit || '20', 10), 100);

    const results = await searchTickets(query.q, {
      category: query.category,
      status: query.status,
      page,
      limit,
    });

    return {
      success: true,
      data: results.hits,
      pagination: {
        page,
        limit,
        total: results.total,
        totalPages: Math.ceil(results.total / limit),
      },
    };
  });

  // Find similar tickets
  server.post('/similar', async (request: FastifyRequest) => {
    const body = similarQuerySchema.parse(request.body);
    const limit = Math.min(parseInt(body.limit || '5', 10), 20);

    const results = await searchSimilarTickets(body.text, {
      category: body.category,
      limit,
      minScore: 0.3,
    });

    return {
      success: true,
      data: results,
    };
  });

  // Autocomplete for search
  server.get('/autocomplete', async (request: FastifyRequest) => {
    const query = z.object({
      q: z.string().min(2),
    }).parse(request.query);

    const results = await searchTickets(query.q, {
      limit: 10,
    });

    // Return just titles for autocomplete
    const suggestions = results.hits.map(hit => ({
      id: hit.id,
      title: hit.title,
      category: hit.category,
    }));

    return {
      success: true,
      data: suggestions,
    };
  });
}
