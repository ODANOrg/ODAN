import * as Minio from 'minio';
import { CONFIG } from '../config/index.js';
import { createContextLogger } from '../utils/logger.js';
import { generateRandomString } from '../utils/crypto.js';

const logger = createContextLogger('MinIO');

let minioClient: Minio.Client | null = null;

export function getMinio(): Minio.Client {
  if (!minioClient) {
    minioClient = new Minio.Client({
      endPoint: CONFIG.minio.endpoint,
      port: CONFIG.minio.port,
      useSSL: CONFIG.minio.useSSL,
      accessKey: CONFIG.minio.accessKey,
      secretKey: CONFIG.minio.secretKey,
    });
  }
  return minioClient;
}

export async function ensureBucket(): Promise<void> {
  const client = getMinio();
  const bucketName = CONFIG.minio.bucket;

  try {
    const exists = await client.bucketExists(bucketName);
    if (!exists) {
      await client.makeBucket(bucketName);
      logger.info(`Created bucket: ${bucketName}`);
      
      // Set bucket policy to allow public read
      const policy = {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: { AWS: ['*'] },
            Action: ['s3:GetObject'],
            Resource: [`arn:aws:s3:::${bucketName}/*`],
          },
        ],
      };
      await client.setBucketPolicy(bucketName, JSON.stringify(policy));
    }
    logger.info(`Bucket ready: ${bucketName}`);
  } catch (error) {
    logger.error('Failed to ensure bucket exists', error);
    throw error;
  }
}

export interface UploadResult {
  key: string;
  url: string;
  size: number;
}

export async function uploadFile(
  file: Buffer,
  originalName: string,
  mimeType: string,
  folder: string = 'uploads'
): Promise<UploadResult> {
  const client = getMinio();
  const bucketName = CONFIG.minio.bucket;
  
  // Generate unique filename
  const ext = originalName.split('.').pop() || '';
  const randomName = `${generateRandomString(16)}.${ext}`;
  const key = `${folder}/${new Date().toISOString().split('T')[0]}/${randomName}`;

  try {
    await client.putObject(bucketName, key, file, file.length, {
      'Content-Type': mimeType,
    });

    const url = getPublicUrl(key);
    
    logger.debug(`Uploaded file: ${key}`);
    
    return {
      key,
      url,
      size: file.length,
    };
  } catch (error) {
    logger.error(`Failed to upload file: ${originalName}`, error);
    throw error;
  }
}

export async function deleteFile(key: string): Promise<void> {
  const client = getMinio();
  const bucketName = CONFIG.minio.bucket;

  try {
    await client.removeObject(bucketName, key);
    logger.debug(`Deleted file: ${key}`);
  } catch (error) {
    logger.error(`Failed to delete file: ${key}`, error);
    throw error;
  }
}

export async function getPresignedUrl(
  key: string,
  expirySeconds: number = 3600
): Promise<string> {
  const client = getMinio();
  const bucketName = CONFIG.minio.bucket;

  return client.presignedGetObject(bucketName, key, expirySeconds);
}

export function getPublicUrl(key: string): string {
  const protocol = CONFIG.minio.useSSL ? 'https' : 'http';
  const port = CONFIG.minio.port === 80 || CONFIG.minio.port === 443 
    ? '' 
    : `:${CONFIG.minio.port}`;
  return `${protocol}://${CONFIG.minio.endpoint}${port}/${CONFIG.minio.bucket}/${key}`;
}

export async function getFileStream(key: string): Promise<NodeJS.ReadableStream> {
  const client = getMinio();
  const bucketName = CONFIG.minio.bucket;

  return client.getObject(bucketName, key);
}
