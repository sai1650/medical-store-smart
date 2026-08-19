const { S3Client } = require('@aws-sdk/client-s3');

const requiredEnvironmentVariables = [
  'AWS_REGION',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'AWS_S3_BUCKET_NAME'
];

function getMissingS3EnvironmentVariables() {
  return requiredEnvironmentVariables.filter((name) => !process.env[name]?.trim());
}

function getS3Config() {
  const missing = getMissingS3EnvironmentVariables();
  if (missing.length > 0) {
    const error = new Error('Missing AWS configuration. Please configure AWS credentials in backend/.env.');
    error.code = 'MISSING_AWS_CONFIGURATION';
    error.missing = missing;
    throw error;
  }

  const expiration = Number.parseInt(process.env.S3_URL_EXPIRATION || '3600', 10);
  return {
    region: process.env.AWS_REGION.trim(),
    bucket: process.env.AWS_S3_BUCKET_NAME.trim(),
    expiration: Number.isFinite(expiration) && expiration > 0 ? expiration : 3600
  };
}

function getS3Client() {
  const config = getS3Config();
  return new S3Client({
    region: config.region,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
  });
}

module.exports = { getMissingS3EnvironmentVariables, getS3Client, getS3Config };