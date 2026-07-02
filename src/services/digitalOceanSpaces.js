const path = require("path");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

const endpoint = process.env.DO_SPACES_ENDPOINT;
const region = process.env.DO_SPACES_REGION || "us-east-1";
const bucket = process.env.DO_SPACES_BUCKET;
const accessKeyId = process.env.DO_SPACES_KEY;
const secretAccessKey = process.env.DO_SPACES_SECRET;

if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
  throw new Error(
    "DigitalOcean Spaces environment variables are required: DO_SPACES_ENDPOINT, DO_SPACES_BUCKET, DO_SPACES_KEY, DO_SPACES_SECRET",
  );
}

const s3 = new S3Client({
  region,
  endpoint,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});

const getPublicUrl = (key) => {
  const normalized = endpoint.replace(/^https?:\/\//, "");
  return `https://${bucket}.${normalized}/${key}`;
};

exports.uploadCmsImage = async (file) => {
  if (!file) return null;

  const extension = path.extname(file.originalname) || ".jpg";
  const key = `cms/${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`;

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: file.buffer,
    ACL: "public-read",
    ContentType: file.mimetype,
  });

  await s3.send(command);

  return getPublicUrl(key);
};

exports.uploadCategoryImage = async (file) => {
  if (!file) return null;

  const extension = path.extname(file.originalname) || ".jpg";
  const key = `categories/${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`;

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: file.buffer,
    ACL: "public-read",
    ContentType: file.mimetype,
  });

  await s3.send(command);

  return getPublicUrl(key);
};
