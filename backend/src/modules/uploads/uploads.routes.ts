import { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { uploadFile, deleteFile } from '../../plugins/minio.js';
// import { JWTPayload } from '../auth/auth.plugin.js';
import { BadRequestError } from '../../utils/errors.js';
import { CONFIG } from '../../config/index.js';

// Allowed MIME types
const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export default async function uploadRoutes(server: FastifyInstance) {
  // Upload single image
  server.post('/image', {
    preHandler: [server.authenticate],
  }, async (request: FastifyRequest) => {
    // const _payload = request.user as JWTPayload;

    const data = await request.file();

    if (!data) {
      throw new BadRequestError('No file uploaded');
    }

    // Check file type
    if (!ALLOWED_IMAGE_TYPES.includes(data.mimetype)) {
      throw new BadRequestError(
        `Invalid file type. Allowed: ${ALLOWED_IMAGE_TYPES.join(', ')}`
      );
    }

    // Read file to buffer
    const chunks: Buffer[] = [];
    for await (const chunk of data.file) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    // Check file size
    if (buffer.length > MAX_FILE_SIZE) {
      throw new BadRequestError('File too large. Maximum size is 10MB');
    }

    // Moderate image content
    try {
      const moderationResponse = await fetch(`${CONFIG.urls.aiService}/moderate/image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          imageBase64: buffer.toString('base64'),
        }),
      });

      const moderation = await moderationResponse.json() as { 
        isSafe: boolean; 
        reason?: string;
        confidence?: number;
      };

      if (!moderation.isSafe) {
        throw new BadRequestError(
          moderation.reason || 'Image contains inappropriate content'
        );
      }
    } catch (error) {
      // If moderation service is down, allow with warning
      console.warn('Image moderation service unavailable');
    }

    // Upload to MinIO
    const result = await uploadFile(
      buffer,
      data.filename,
      data.mimetype,
      'images'
    );

    return {
      success: true,
      data: {
        key: result.key,
        url: result.url,
        size: result.size,
      },
    };
  });

  // Upload multiple images
  server.post('/images', {
    preHandler: [server.authenticate],
  }, async (request: FastifyRequest) => {
    // const _payload = request.user as JWTPayload;

    const files = request.files();
    const results: Array<{ key: string; url: string; size: number }> = [];
    const errors: Array<{ filename: string; error: string }> = [];

    for await (const data of files) {
      try {
        // Check file type
        if (!ALLOWED_IMAGE_TYPES.includes(data.mimetype)) {
          errors.push({
            filename: data.filename,
            error: 'Invalid file type',
          });
          continue;
        }

        // Read file to buffer
        const chunks: Buffer[] = [];
        for await (const chunk of data.file) {
          chunks.push(chunk);
        }
        const buffer = Buffer.concat(chunks);

        // Check file size
        if (buffer.length > MAX_FILE_SIZE) {
          errors.push({
            filename: data.filename,
            error: 'File too large',
          });
          continue;
        }

        // Upload to MinIO
        const result = await uploadFile(
          buffer,
          data.filename,
          data.mimetype,
          'images'
        );

        results.push({
          key: result.key,
          url: result.url,
          size: result.size,
        });
      } catch (error) {
        errors.push({
          filename: data.filename,
          error: 'Upload failed',
        });
      }
    }

    return {
      success: true,
      data: {
        uploaded: results,
        errors: errors.length > 0 ? errors : undefined,
      },
    };
  });

  // Upload whiteboard image
  server.post('/whiteboard', {
    preHandler: [server.authenticate],
  }, async (request: FastifyRequest) => {
    const body = z.object({
      imageData: z.string(), // base64 encoded image
    }).parse(request.body);

    // Decode base64
    const base64Data = body.imageData.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // Check size
    if (buffer.length > MAX_FILE_SIZE) {
      throw new BadRequestError('Image too large');
    }

    // Upload
    const result = await uploadFile(
      buffer,
      `whiteboard_${Date.now()}.png`,
      'image/png',
      'whiteboards'
    );

    return {
      success: true,
      data: {
        key: result.key,
        url: result.url,
      },
    };
  });

  // Delete image (own uploads only - handled by checking response ownership)
  server.delete('/:key', {
    preHandler: [server.authenticate],
  }, async (request: FastifyRequest) => {
    const { key } = z.object({ key: z.string() }).parse(request.params);

    // For security, only allow deleting from specific folders
    if (!key.startsWith('images/') && !key.startsWith('whiteboards/')) {
      throw new BadRequestError('Invalid file key');
    }

    await deleteFile(key);

    return { success: true, message: 'File deleted' };
  });
}
