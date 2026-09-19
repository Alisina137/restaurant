import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import sharp from "sharp";
import { HttpError } from "./http";
export function storageConfigured() {
  return Boolean(
    process.env.S3_BUCKET &&
    process.env.S3_ACCESS_KEY_ID &&
    process.env.S3_SECRET_ACCESS_KEY,
  );
}
function storage() {
  if (!storageConfigured())
    throw new HttpError(
      503,
      "Photo uploads are not available yet. You can still save the restaurant details.",
    );
  return new S3Client({
    region: process.env.S3_REGION || "auto",
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    },
  });
}
export async function sanitizeImage(bytes: Buffer) {
  try {
    const img = sharp(bytes, { limitInputPixels: 25_000_000, animated: false });
    const metadata = await img.metadata();
    if (!["jpeg", "png", "webp"].includes(metadata.format || ""))
      throw new Error("Invalid format");
    return await img
      .rotate()
      .resize(1600, 1200, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    throw new HttpError(
      400,
      "Choose a valid JPEG, PNG or WebP image under 5 MB.",
    );
  }
}
export async function putImage(key: string, body: Buffer) {
  await storage().send(
    new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: "image/webp",
    }),
  );
}
export async function deleteImage(key: string) {
  await storage().send(
    new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }),
  );
}
export async function getImage(key: string) {
  const result = await storage().send(
    new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }),
  );
  return result.Body?.transformToByteArray();
}
