const multer = require('multer');

const imageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const documentTypes = new Set(['application/pdf']);

function createUploadMiddleware({ allowedTypes, maxFileSize }) {
  const uploader = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxFileSize, files: 1 },
    fileFilter: (req, file, callback) => {
      if (!allowedTypes.has(file.mimetype)) {
        const error = new Error('Invalid file type');
        error.code = 'INVALID_FILE_TYPE';
        return callback(error);
      }
      callback(null, true);
    }
  }).single('file');

  return (req, res, next) => {
    uploader(req, res, (error) => {
      if (!error) return next();
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ success: false, message: 'File too large' });
      }
      if (error.code === 'INVALID_FILE_TYPE') {
        return res.status(400).json({ success: false, message: error.message });
      }
      if (error instanceof multer.MulterError) {
        return res.status(400).json({ success: false, message: 'Invalid upload request' });
      }
      return res.status(400).json({ success: false, message: 'Unable to process file upload' });
    });
  };
}

module.exports = {
  uploadImage: createUploadMiddleware({ allowedTypes: imageTypes, maxFileSize: 5 * 1024 * 1024 }),
  uploadDocument: createUploadMiddleware({ allowedTypes: documentTypes, maxFileSize: 10 * 1024 * 1024 })
};