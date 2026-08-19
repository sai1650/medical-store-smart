const path = require('path');
const crypto = require('crypto');
const {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { getS3Client, getS3Config } = require('../config/s3');

const objectRoot = 'smart-medical-store/';

function validateKey(key) {
  if (typeof key !== 'string' || !key.startsWith(objectRoot) || key.includes('..') || key.includes('\\') || key.includes('\0')) {
    const error = new Error('Invalid S3 key');
    error.code = 'INVALID_S3_KEY';
    throw error;
  }
  return key;
}

function validateOwnerKey(key, ownerId) {
  validateKey(key);
  const safeOwnerId = String(ownerId).replace(/[^a-zA-Z0-9_-]/g, '');
  if (!safeOwnerId || !key.includes(`/${safeOwnerId}/`)) {
    const error = new Error('File access denied');
    error.code = 'S3_ACCESS_DENIED';
    throw error;
  }
  return key;
}

function extensionForFile(file) {
  const extension = path.extname(file.originalname || '').toLowerCase();
  return extension || (file.mimetype === 'application/pdf' ? '.pdf' : '.bin');
}

function createObjectKey(prefix, ownerId, file) {
  const safeOwnerId = String(ownerId).replace(/[^a-zA-Z0-9_-]/g, '');
  return `${objectRoot}${prefix}${safeOwnerId}/${Date.now()}-${crypto.randomUUID()}${extensionForFile(file)}`;
}

async function uploadFileToS3({ file, prefix, ownerId }) {
  const config = getS3Config();
  const s3Client = getS3Client();
  const key = createObjectKey(prefix, ownerId, file);
  await s3Client.send(new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype,
    ContentLength: file.size,
    ServerSideEncryption: 'AES256'
  }));
  return key;
}

async function getSignedFileUrl(key, ownerId) {
  const config = getS3Config();
  const s3Client = getS3Client();
  ownerId ? validateOwnerKey(key, ownerId) : validateKey(key);
  return getSignedUrl(s3Client, new GetObjectCommand({ Bucket: config.bucket, Key: key }), {
    expiresIn: config.expiration
  });
}

async function deleteFileFromS3(key, ownerId) {
  const config = getS3Config();
  const s3Client = getS3Client();
  ownerId ? validateOwnerKey(key, ownerId) : validateKey(key);
  await s3Client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }));
}

module.exports = { uploadFileToS3, getSignedFileUrl, deleteFileFromS3 };