import { FastifyRequest, FastifyReply } from 'fastify';
import { User, Ticket, Response as TicketResponse } from '@prisma/client';

// ============================================
// Authentication Types
// ============================================

export interface JWTPayload {
  id: string;
  email?: string;
  role: string;
  provider: string;
}

export interface AuthenticatedRequest extends FastifyRequest {
  user: JWTPayload;
}

// ============================================
// OAuth Types
// ============================================

export interface OAuthUserInfo {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
}

export interface TelegramAuthData {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

// ============================================
// API Response Types
// ============================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ============================================
// Ticket Types
// ============================================

export interface CreateTicketDTO {
  title: string;
  description: string;
  category: string;
  images?: string[];
}

export interface UpdateTicketDTO {
  title?: string;
  description?: string;
  category?: string;
  status?: string;
}

export interface TicketWithRelations extends Ticket {
  creator: Pick<User, 'id' | 'name' | 'avatar'>;
  volunteer?: Pick<User, 'id' | 'name' | 'avatar'> | null;
  responses: TicketResponse[];
  _count?: {
    responses: number;
    messages: number;
  };
}

// ============================================
// Response Types
// ============================================

export interface CreateResponseDTO {
  content: string;
  images?: string[];
  whiteboardImg?: string;
  timeSpent: number;
  isPasted?: boolean;
  hasSource?: boolean;
  sourceUrl?: string;
}

// ============================================
// Search Types
// ============================================

export interface SearchTicketsDTO {
  query: string;
  category?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export interface SimilarTicket {
  id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  score: number;
  hasAcceptedResponse: boolean;
}

// ============================================
// Chat Types
// ============================================

export interface ChatMessage {
  id: string;
  content: string;
  type: 'TEXT' | 'IMAGE' | 'SYSTEM';
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  ticketId: string;
  timestamp: Date;
}

export interface TypingEvent {
  ticketId: string;
  userId: string;
  userName: string;
  isTyping: boolean;
}

// ============================================
// Moderation Types
// ============================================

export interface ModerationResult {
  isSafe: boolean;
  confidence: number;
  category?: string;
  reason?: string;
}

export interface AIServiceResponse {
  text?: ModerationResult;
  image?: ModerationResult;
  error?: string;
}

// ============================================
// Certificate Types
// ============================================

export interface CertificateData {
  id: string;
  code: string;
  userName: string;
  periodStart: Date;
  periodEnd: Date;
  hoursSpent: number;
  ticketsHelped: number;
  peopleHelped: number;
  issuedAt: Date;
  blockchainHash?: string;
}

export interface GenerateCertificateDTO {
  periodStart: string;
  periodEnd: string;
}

// ============================================
// Blockchain Types
// ============================================

export interface BlockData {
  type: string;
  userId?: string;
  ticketId?: string;
  responseId?: string;
  certificateId?: string;
  timeSpent?: number;
  metadata?: Record<string, unknown>;
}

export interface Block {
  index: number;
  timestamp: Date;
  data: BlockData;
  hash: string;
  prevHash: string;
  nonce: number;
}

// ============================================
// Statistics Types
// ============================================

export interface UserStats {
  totalTimeSpent: number;
  ticketsCreated: number;
  ticketsResolved: number;
  peopleHelped: number;
  certificatesIssued: number;
}

export interface PlatformStats {
  totalUsers: number;
  totalVolunteers: number;
  totalTickets: number;
  resolvedTickets: number;
  totalHoursVolunteered: number;
}
