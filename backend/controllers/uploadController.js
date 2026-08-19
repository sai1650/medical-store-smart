const { deleteFileFromS3, getSignedFileUrl, uploadFileToS3 } = require('../utils/s3');

function getOwnerId(req) {
  return req.get('x-user-id') || req.body?.userId;
}

function handleS3Error(res, error) {
  if (error.code === 'INVALID_S3_KEY' || error.code === 'S3_ACCESS_DENIED') {
    return res.status(400).json({ success: false, message: error.message });
  }
  console.error('S3 operation failed:', error.name || error.code || 'UnknownError');
  return res.status(503).json({ success: false, message: 'File storage is temporarily unavailable' });
}

function uploadHandler(prefix) {
  return async (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: 'File is required' });
    const ownerId = getOwnerId(req);
    if (!ownerId) return res.status(401).json({ success: false, message: 'User identity is required' });

    try {
      const key = await uploadFileToS3({ file: req.file, prefix, ownerId });
      const url = await getSignedFileUrl(key, ownerId);
      return res.status(201).json({ success: true, key, url });
    } catch (error) {
      return handleS3Error(res, error);
    }
  };
}

async function getUrl(req, res) {
  if (!getOwnerId(req)) return res.status(401).json({ success: false, message: 'User identity is required' });
  try {
    const key = decodeURIComponent(req.params.key);
    const url = await getSignedFileUrl(key, getOwnerId(req));
    return res.json({ success: true, key, url });
  } catch (error) {
    return handleS3Error(res, error);
  }
}

async function deleteUploadedFile(req, res) {
  if (!getOwnerId(req)) return res.status(401).json({ success: false, message: 'User identity is required' });
  try {
    const key = decodeURIComponent(req.params.key);
    await deleteFileFromS3(key, getOwnerId(req));
    return res.json({ success: true, key });
  } catch (error) {
    return handleS3Error(res, error);
  }
}

module.exports = {
  uploadMedicineImage: uploadHandler('medicines/images/'),
  uploadProfileImage: uploadHandler('users/profile/'),
  uploadPrescription: uploadHandler('prescriptions/'),
  uploadMedicalDocument: uploadHandler('medical-documents/'),
  getUrl,
  deleteUploadedFile
};