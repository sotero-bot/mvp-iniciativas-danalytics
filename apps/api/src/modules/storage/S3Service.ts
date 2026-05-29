import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import * as fs from 'fs';

export class S3Service {
  private client: S3Client | null;
  private bucket: string;

  constructor() {
    const region = process.env.AWS_REGION;
    const bucket = process.env.AWS_S3_BUCKET;
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

    if (!region || !bucket || !accessKeyId || !secretAccessKey) {
      this.client = null;
      this.bucket = '';
      return;
    }

    this.client = new S3Client({
      region,
      credentials: { accessKeyId, secretAccessKey },
    });
    this.bucket = bucket;
  }

  get isConfigured(): boolean {
    return this.client !== null;
  }

  async uploadFile(key: string, filePath: string, contentType: string): Promise<void> {
    if (!this.client) throw new Error('S3 no configurado');
    const body = fs.readFileSync(filePath);
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }));
  }

  async getPresignedPutUrl(key: string, contentType: string, expiresIn = 300): Promise<string> {
    if (!this.client) throw new Error('S3 no configurado');
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });
    return getSignedUrl(this.client, command, { expiresIn });
  }

  /**
   * Si `downloadFilename` viene seteado, S3 sirve el objeto con
   * `Content-Disposition: attachment; filename="..."`, lo que fuerza descarga
   * directa en el navegador y le da el nombre amigable en vez de la S3 key.
   */
  async getPresignedGetUrl(key: string, expiresIn = 3600, downloadFilename?: string): Promise<string> {
    if (!this.client) throw new Error('S3 no configurado');
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ...(downloadFilename
        ? { ResponseContentDisposition: `attachment; filename="${downloadFilename.replace(/"/g, '')}"` }
        : {}),
    });
    return getSignedUrl(this.client, command, { expiresIn });
  }

  async deleteObject(key: string): Promise<void> {
    if (!this.client) return;
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  /**
   * Genera una key S3 con la forma `<prefix>/<base-slug>-<uuid><ext>`.
   * El nombre original se preserva (slugificado a [a-z0-9-_]) para que el objeto
   * sea legible al navegar el bucket. El UUID al final garantiza unicidad
   * incluso si varios usuarios suben archivos con el mismo nombre simultáneamente.
   */
  generateKey(prefix: string, filename: string): string {
    const dotIdx = filename.lastIndexOf('.');
    const rawBase = dotIdx > 0 ? filename.slice(0, dotIdx) : filename;
    const ext = dotIdx > 0 ? filename.slice(dotIdx) : '';
    const baseSlug = S3Service.slugifyPathSegment(rawBase) || 'archivo';
    return `${prefix}/${baseSlug}-${randomUUID()}${ext}`;
  }

  /**
   * Normaliza un segmento de path para S3 según la convención del proyecto:
   *   - minúsculas
   *   - sin tildes/diacríticos
   *   - espacios y caracteres no [a-z0-9] → '_'
   *   - sin '_' duplicados ni al inicio/fin
   * Aplicar por segmento (no a un path completo con '/').
   */
  static slugifyPathSegment(s: string): string {
    return (s || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  }
}
