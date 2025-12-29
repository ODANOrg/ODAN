import { FastifyInstance, FastifyRequest } from 'fastify';
import { prisma } from '../../plugins/prisma.js';
import { getChainLength, getLatestBlock } from '../blockchain/blockchain.service.js';
import { cache } from '../../plugins/redis.js';

export default async function statsRoutes(server: FastifyInstance) {
  // Platform statistics (public, cached)
  server.get('/platform', async (request: FastifyRequest) => {
    const cacheKey = 'stats:platform';
    
    // Try cache first
    const cached = await cache.get<object>(cacheKey);
    if (cached) {
      return { success: true, data: cached };
    }

    // Calculate stats
    const [
      totalUsers,
      totalVolunteers,
      totalTickets,
      resolvedTickets,
      totalResponses,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: { in: ['VOLUNTEER', 'MODERATOR', 'ADMIN'] } } }),
      prisma.ticket.count(),
      prisma.ticket.count({ where: { status: 'RESOLVED' } }),
      prisma.response.count(),
    ]);

    // Calculate total volunteer hours
    const timeResult = await prisma.user.aggregate({
      _sum: { totalTimeSpent: true },
    });
    const totalSeconds = timeResult._sum.totalTimeSpent || 0;
    const totalHours = Math.floor(totalSeconds / 3600);

    // Calculate people helped
    const peopleResult = await prisma.user.aggregate({
      _sum: { peopleHelped: true },
    });
    const totalPeopleHelped = peopleResult._sum.peopleHelped || 0;

    const stats = {
      totalUsers,
      totalVolunteers,
      totalTickets,
      resolvedTickets,
      openTickets: totalTickets - resolvedTickets,
      totalResponses,
      totalHoursVolunteered: totalHours,
      totalPeopleHelped,
      resolutionRate: totalTickets > 0 
        ? Math.round((resolvedTickets / totalTickets) * 100) 
        : 0,
      blockchain: {
        totalBlocks: getChainLength(),
        latestBlockHash: getLatestBlock().hash,
      },
    };

    // Cache for 5 minutes
    await cache.set(cacheKey, stats, 300);

    return { success: true, data: stats };
  });

  // Top volunteers leaderboard (public, cached)
  server.get('/leaderboard', async (request: FastifyRequest) => {
    const cacheKey = 'stats:leaderboard';
    
    const cached = await cache.get<object[]>(cacheKey);
    if (cached) {
      return { success: true, data: cached };
    }

    const topVolunteers = await prisma.user.findMany({
      where: {
        role: { in: ['VOLUNTEER', 'MODERATOR', 'ADMIN'] },
        ticketsResolved: { gt: 0 },
      },
      orderBy: [
        { ticketsResolved: 'desc' },
        { totalTimeSpent: 'desc' },
      ],
      take: 20,
      select: {
        id: true,
        name: true,
        avatar: true,
        ticketsResolved: true,
        peopleHelped: true,
        totalTimeSpent: true,
      },
    });

    const leaderboard = topVolunteers.map((user: any, index: number) => ({
      rank: index + 1,
      id: user.id,
      name: user.name,
      avatar: user.avatar,
      ticketsResolved: user.ticketsResolved,
      peopleHelped: user.peopleHelped,
      hoursVolunteered: Math.floor(user.totalTimeSpent / 3600),
    }));

    // Cache for 10 minutes
    await cache.set(cacheKey, leaderboard, 600);

    return { success: true, data: leaderboard };
  });

  // Category statistics (public, cached)
  server.get('/categories', async (request: FastifyRequest) => {
    const cacheKey = 'stats:categories';
    
    const cached = await cache.get<object[]>(cacheKey);
    if (cached) {
      return { success: true, data: cached };
    }

    const categoryStats = await prisma.ticket.groupBy({
      by: ['category'],
      _count: true,
      where: { status: { not: 'CANCELLED' } },
      orderBy: { _count: { category: 'desc' } },
    });

    const resolvedByCategory = await prisma.ticket.groupBy({
      by: ['category'],
      _count: true,
      where: { status: 'RESOLVED' },
    });

    const resolvedMap = new Map(
      resolvedByCategory.map((c: any) => [c.category, c._count])
    );

    const stats = categoryStats.map((cat: any) => ({
      category: cat.category,
      total: cat._count,
      resolved: resolvedMap.get(cat.category) || 0,
      resolutionRate: Math.round(
        ((resolvedMap.get(cat.category) || 0) / cat._count) * 100
      ),
    }));

    // Cache for 15 minutes
    await cache.set(cacheKey, stats, 900);

    return { success: true, data: stats };
  });

  // Recent activity (public, cached)
  server.get('/recent', async (request: FastifyRequest) => {
    const cacheKey = 'stats:recent';
    
    const cached = await cache.get<object[]>(cacheKey);
    if (cached) {
      return { success: true, data: cached };
    }

    const recentTickets = await prisma.ticket.findMany({
      where: { status: 'RESOLVED' },
      orderBy: { resolvedAt: 'desc' },
      take: 10,
      select: {
        id: true,
        title: true,
        category: true,
        resolvedAt: true,
        volunteer: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
    });

    // Cache for 2 minutes
    await cache.set(cacheKey, recentTickets, 120);

    return { success: true, data: recentTickets };
  });

  // Time series stats (for charts)
  server.get('/timeline', async (request: FastifyRequest) => {
    const cacheKey = 'stats:timeline';
    
    const cached = await cache.get<object>(cacheKey);
    if (cached) {
      return { success: true, data: cached };
    }

    // Get last 30 days of data
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const tickets = await prisma.ticket.findMany({
      where: {
        createdAt: { gte: thirtyDaysAgo },
      },
      select: {
        createdAt: true,
        status: true,
        resolvedAt: true,
      },
    });

    // Group by day
    const dailyStats: Record<string, { created: number; resolved: number }> = {};
    
    for (let i = 0; i < 30; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const key = date.toISOString().split('T')[0];
      dailyStats[key] = { created: 0, resolved: 0 };
    }

    tickets.forEach((ticket: any) => {
      const createdKey = ticket.createdAt.toISOString().split('T')[0];
      if (dailyStats[createdKey]) {
        dailyStats[createdKey].created++;
      }
      
      if (ticket.resolvedAt) {
        const resolvedKey = ticket.resolvedAt.toISOString().split('T')[0];
        if (dailyStats[resolvedKey]) {
          dailyStats[resolvedKey].resolved++;
        }
      }
    });

    const timeline = Object.entries(dailyStats)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, stats]) => ({
        date,
        created: stats.created,
        resolved: stats.resolved,
      }));

    // Cache for 30 minutes
    await cache.set(cacheKey, { timeline }, 1800);

    return { success: true, data: { timeline } };
  });
}
