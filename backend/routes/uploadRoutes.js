const express = require('express');
const { uploadDocument, uploadImage } = require('../middleware/upload');
const {
  deleteUploadedFile,
  getUrl,
  uploadMedicalDocument,
  uploadMedicineImage,
  uploadPrescription,
  uploadProfileImage
} = require('../controllers/uploadController');

const router = express.Router();

router.post('/medicine-image', uploadImage, uploadMedicineImage);
router.post('/profile-image', uploadImage, uploadProfileImage);
router.post('/prescription', uploadDocument, uploadPrescription);
router.post('/medical-document', uploadDocument, uploadMedicalDocument);
router.get('/url/:key(*)', getUrl);
router.delete('/:key(*)', deleteUploadedFile);

module.exports = router;