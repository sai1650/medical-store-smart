import { request } from '../api';

function currentUserId() {
  try {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    return user?._id || user?.id || '';
  } catch {
    return '';
  }
}

async function upload(path, file) {
  if (!(file instanceof File)) throw new Error('A file is required');
  const formData = new FormData();
  formData.append('file', file);
  return request(path, {
    method: 'POST',
    headers: { 'x-user-id': currentUserId() },
    body: formData
  });
}

export const uploadMedicineImage = (file) => upload('/api/upload/medicine-image', file);
export const uploadProfileImage = (file) => upload('/api/upload/profile-image', file);
export const uploadPrescription = (file) => upload('/api/upload/prescription', file);
export const uploadMedicalDocument = (file) => upload('/api/upload/medical-document', file);

export function deleteFile(key) {
  return request(`/api/upload/${key.split('/').map(encodeURIComponent).join('/')}`, {
    method: 'DELETE',
    headers: { 'x-user-id': currentUserId() }
  });
}

export function getFileUrl(key) {
  return request(`/api/upload/url/${key.split('/').map(encodeURIComponent).join('/')}`, {
    headers: { 'x-user-id': currentUserId() }
  });
}