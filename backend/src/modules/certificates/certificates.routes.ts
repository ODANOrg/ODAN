import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { prisma } from '../../plugins/prisma.js';
import { NotFoundError, BadRequestError } from '../../utils/errors.js';
import { JWTPayload } from '../auth/auth.plugin.js';
import { CONFIG } from '../../config/index.js';
import { generateCertificateCode } from '../../utils/crypto.js';
import { 
  addRecord, 
  BlockchainRecordType,
  verifyUserStats,
  getRecordsForUser,
} from '../blockchain/blockchain.service.js';

// Schemas
const generateCertificateSchema = z.object({
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
});

const certificateCodeSchema = z.object({
  code: z.string(),
});

export default async function certificateRoutes(server: FastifyInstance) {
  // Generate certificate
  server.post('/generate', {
    preHandler: [server.requireVolunteer],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const payload = request.user as JWTPayload;
    const body = generateCertificateSchema.parse(request.body);

    const periodStart = new Date(body.periodStart);
    const periodEnd = new Date(body.periodEnd);

    // Validate period
    if (periodEnd <= periodStart) {
      throw new BadRequestError('End date must be after start date');
    }

    if (periodEnd > new Date()) {
      throw new BadRequestError('End date cannot be in the future');
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      select: {
        id: true,
        name: true,
        totalTimeSpent: true,
        ticketsResolved: true,
        peopleHelped: true,
      },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Calculate stats for the period from responses
    const responses = await prisma.response.findMany({
      where: {
        authorId: payload.id,
        createdAt: {
          gte: periodStart,
          lte: periodEnd,
        },
        ticket: {
          status: 'RESOLVED',
        },
      },
      select: {
        timeSpent: true,
        ticketId: true,
        ticket: {
          select: { creatorId: true },
        },
      },
    });

    const totalSeconds = responses.reduce((acc, r) => acc + r.timeSpent, 0);
    const uniqueTickets = new Set(responses.map(r => r.ticketId)).size;
    const uniquePeople = new Set(responses.map(r => r.ticket.creatorId)).size;

    if (totalSeconds === 0) {
      throw new BadRequestError('No volunteer activity found in this period');
    }

    // Generate certificate code
    const code = generateCertificateCode();

    // Create certificate
    const certificate = await prisma.certificate.create({
      data: {
        code,
        userId: payload.id,
        periodStart,
        periodEnd,
        hoursSpent: Math.floor(totalSeconds / 60), // store in minutes
        ticketsHelped: uniqueTickets,
        peopleHelped: uniquePeople,
      },
    });

    // Add to blockchain
    const block = await addRecord(BlockchainRecordType.CERTIFICATE_ISSUED, {
      certificateId: certificate.id,
      userId: payload.id,
      metadata: {
        code: certificate.code,
        hoursSpent: certificate.hoursSpent,
        ticketsHelped: certificate.ticketsHelped,
        peopleHelped: certificate.peopleHelped,
      },
    });

    // Update certificate with blockchain hash
    await prisma.certificate.update({
      where: { id: certificate.id },
      data: { blockchainHash: block.hash },
    });

    return {
      success: true,
      data: {
        id: certificate.id,
        code: certificate.code,
        periodStart: certificate.periodStart,
        periodEnd: certificate.periodEnd,
        hoursSpent: Math.floor(certificate.hoursSpent / 60),
        minutesSpent: certificate.hoursSpent % 60,
        ticketsHelped: certificate.ticketsHelped,
        peopleHelped: certificate.peopleHelped,
        blockchainHash: block.hash,
        verifyUrl: `${CONFIG.urls.frontend}/verify/${certificate.code}`,
      },
    };
  });

  // Verify certificate (public)
  server.get('/verify/:code', async (request: FastifyRequest, reply: FastifyReply) => {
    const { code } = certificateCodeSchema.parse(request.params);

    const certificate = await prisma.certificate.findUnique({
      where: { code },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
    });

    if (!certificate) {
      throw new NotFoundError('Certificate not found');
    }

    // Verify against blockchain
    const verification = verifyUserStats(
      certificate.userId,
      Math.floor(certificate.hoursSpent / 60),
      certificate.ticketsHelped
    );

    return {
      success: true,
      data: {
        certificate: {
          code: certificate.code,
          userName: certificate.user.name,
          userAvatar: certificate.user.avatar,
          periodStart: certificate.periodStart,
          periodEnd: certificate.periodEnd,
          hoursSpent: Math.floor(certificate.hoursSpent / 60),
          minutesSpent: certificate.hoursSpent % 60,
          ticketsHelped: certificate.ticketsHelped,
          peopleHelped: certificate.peopleHelped,
          issuedAt: certificate.issuedAt,
          blockchainHash: certificate.blockchainHash,
        },
        verification: {
          isValid: verification.valid,
          blockchainVerified: !!certificate.blockchainHash,
          actualHours: verification.actualHours,
          actualTickets: verification.actualTickets,
        },
      },
    };
  });

  // Download certificate as PDF
  server.get('/download/:code', async (request: FastifyRequest, reply: FastifyReply) => {
    const { code } = certificateCodeSchema.parse(request.params);

    const certificate = await prisma.certificate.findUnique({
      where: { code },
      include: {
        user: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!certificate) {
      throw new NotFoundError('Certificate not found');
    }

    // Generate QR Code
    const verifyUrl = `${CONFIG.urls.frontend}/verify/${certificate.code}`;
    const qrCodeDataUrl = await QRCode.toDataURL(verifyUrl, { width: 150 });
    const qrCodeBuffer = Buffer.from(qrCodeDataUrl.split(',')[1], 'base64');

    // Create PDF
    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margin: 50,
    });

    // Collect PDF chunks
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));

    // Header
    doc.fontSize(36)
       .font('Helvetica-Bold')
       .fillColor('#1a365d')
       .text('ODAN', { align: 'center' });
    
    doc.fontSize(14)
       .font('Helvetica')
       .fillColor('#4a5568')
       .text('Open Digital Assistance Network', { align: 'center' });

    doc.moveDown(2);

    // Certificate title
    doc.fontSize(28)
       .font('Helvetica-Bold')
       .fillColor('#2d3748')
       .text('Certificate of Volunteer Participation', { align: 'center' });

    doc.moveDown(2);

    // Recipient
    doc.fontSize(14)
       .font('Helvetica')
       .fillColor('#4a5568')
       .text('This certificate is presented to', { align: 'center' });

    doc.moveDown(0.5);

    doc.fontSize(24)
       .font('Helvetica-Bold')
       .fillColor('#1a365d')
       .text(certificate.user.name, { align: 'center' });

    doc.moveDown(1.5);

    // Details
    doc.fontSize(12)
       .font('Helvetica')
       .fillColor('#4a5568')
       .text('For their outstanding contribution to the community', { align: 'center' });

    doc.moveDown(2);

    // Stats
    const hours = Math.floor(certificate.hoursSpent / 60);
    const minutes = certificate.hoursSpent % 60;
    const timeStr = minutes > 0 ? `${hours} hours and ${minutes} minutes` : `${hours} hours`;

    const statsY = doc.y;
    const pageWidth = doc.page.width - 100;
    const colWidth = pageWidth / 3;

    // Time spent
    doc.fontSize(24)
       .font('Helvetica-Bold')
       .fillColor('#3182ce')
       .text(timeStr, 50, statsY, { width: colWidth, align: 'center' });
    doc.fontSize(10)
       .font('Helvetica')
       .fillColor('#718096')
       .text('Time Volunteered', 50, statsY + 30, { width: colWidth, align: 'center' });

    // Tickets
    doc.fontSize(24)
       .font('Helvetica-Bold')
       .fillColor('#38a169')
       .text(certificate.ticketsHelped.toString(), 50 + colWidth, statsY, { width: colWidth, align: 'center' });
    doc.fontSize(10)
       .font('Helvetica')
       .fillColor('#718096')
       .text('Tickets Resolved', 50 + colWidth, statsY + 30, { width: colWidth, align: 'center' });

    // People helped
    doc.fontSize(24)
       .font('Helvetica-Bold')
       .fillColor('#dd6b20')
       .text(certificate.peopleHelped.toString(), 50 + colWidth * 2, statsY, { width: colWidth, align: 'center' });
    doc.fontSize(10)
       .font('Helvetica')
       .fillColor('#718096')
       .text('People Helped', 50 + colWidth * 2, statsY + 30, { width: colWidth, align: 'center' });

    doc.moveDown(4);

    // Period
    const formatDate = (date: Date) => date.toLocaleDateString('en-US', { 
      year: 'numeric', month: 'long', day: 'numeric' 
    });

    doc.fontSize(10)
       .font('Helvetica')
       .fillColor('#718096')
       .text(`Period: ${formatDate(certificate.periodStart)} - ${formatDate(certificate.periodEnd)}`, { align: 'center' });

    doc.moveDown(0.5);

    doc.text(`Issued: ${formatDate(certificate.issuedAt)}`, { align: 'center' });

    doc.moveDown(0.5);

    doc.fontSize(8)
       .text(`Certificate ID: ${certificate.code}`, { align: 'center' });

    // QR Code
    doc.image(qrCodeBuffer, doc.page.width - 180, doc.page.height - 180, { width: 100 });
    
    doc.fontSize(8)
       .fillColor('#a0aec0')
       .text('Scan to verify', doc.page.width - 180, doc.page.height - 70, { width: 100, align: 'center' });

    // Blockchain hash
    if (certificate.blockchainHash) {
      doc.fontSize(6)
         .fillColor('#cbd5e0')
         .text(`Blockchain: ${certificate.blockchainHash.substring(0, 32)}...`, 50, doc.page.height - 50);
    }

    // Finalize
    doc.end();

    // Wait for all chunks
    await new Promise<void>((resolve) => {
      doc.on('end', resolve);
    });

    const pdfBuffer = Buffer.concat(chunks);

    reply.header('Content-Type', 'application/pdf');
    reply.header('Content-Disposition', `attachment; filename="ODAN-Certificate-${certificate.code}.pdf"`);

    return reply.send(pdfBuffer);
  });

  // Get user's blockchain activity
  server.get('/blockchain-activity', {
    preHandler: [server.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const payload = request.user as JWTPayload;

    const records = getRecordsForUser(payload.id);

    return {
      success: true,
      data: records.map(block => ({
        index: block.index,
        type: block.data.type,
        timestamp: block.timestamp,
        hash: block.hash,
        data: {
          ticketId: block.data.ticketId,
          timeSpent: block.data.timeSpent,
          certificateId: block.data.certificateId,
        },
      })),
    };
  });
}
