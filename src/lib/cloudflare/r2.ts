import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

export const isR2Configured = () => {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME
  );
};

export function getR2Client() {
  if (!isR2Configured()) {
    return null;
  }

  return new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
}

export async function uploadToR2(fileBuffer: Buffer, fileName: string, contentType: string): Promise<string> {
  const r2 = getR2Client();
  if (!r2) {
    throw new Error("Cloudflare R2 chưa được cấu hình biến môi trường trong .env.local");
  }

  const bucket = process.env.R2_BUCKET_NAME!;
  const key = `todos/${Date.now()}-${fileName.replace(/\s+/g, "_")}`;

  await r2.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: fileBuffer,
      ContentType: contentType,
    })
  );

  const publicUrlBase = process.env.NEXT_PUBLIC_R2_PUBLIC_URL?.replace(/\/$/, "");
  if (publicUrlBase) {
    return `${publicUrlBase}/${key}`;
  }

  return `https://${bucket}.${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${key}`;
}
