import sharp from 'sharp';
import { BadRequestError } from '../http/errors';
export interface ImagePolicy {
    maxDimension: number;
    quality: number;
}
/** Shared decoding policy; feature services retain authorization and retention rules. */
export async function normalizeImage(bytes: Buffer, policy: ImagePolicy) {
    if (!Buffer.isBuffer(bytes) || !bytes.length || bytes.length > 5 * 1024 * 1024) {
        throw new BadRequestError('Image must be at most 5 MB');
    }
    try {
        const source = sharp(bytes, { limitInputPixels: 40000000, animated: false });
        const metadata = await source.metadata();
        if (!['jpeg', 'png', 'webp'].includes(metadata.format ?? '') || (metadata.pages ?? 1) > 1) {
            throw new Error('Unsupported image');
        }
        return await source.rotate().resize({
            width: policy.maxDimension,
            height: policy.maxDimension,
            fit: 'inside',
            withoutEnlargement: true,
        }).webp({ quality: policy.quality }).toBuffer({ resolveWithObject: true });
    }
    catch {
        throw new BadRequestError('A valid static JPEG, PNG or WebP image is required');
    }
}
