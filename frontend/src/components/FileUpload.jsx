import React, { useEffect, useState } from 'react';
import {
  uploadMedicalDocument,
  uploadMedicineImage,
  uploadPrescription,
  uploadProfileImage
} from '../services/uploadService';

const definitions = {
  medicineImage: { accept: '.jpg,.jpeg,.png,.webp', types: ['image/jpeg', 'image/png', 'image/webp'], maxBytes: 5 * 1024 * 1024, upload: uploadMedicineImage },
  profileImage: { accept: '.jpg,.jpeg,.png,.webp', types: ['image/jpeg', 'image/png', 'image/webp'], maxBytes: 5 * 1024 * 1024, upload: uploadProfileImage },
  prescription: { accept: '.pdf', types: ['application/pdf'], maxBytes: 10 * 1024 * 1024, upload: uploadPrescription },
  medicalDocument: { accept: '.pdf', types: ['application/pdf'], maxBytes: 10 * 1024 * 1024, upload: uploadMedicalDocument }
};

export default function FileUpload({ type = 'medicineImage', onUploaded }) {
  const definition = definitions[type] || definitions.medicineImage;
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [status, setStatus] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);

  function selectFile(event) {
    const selected = event.target.files?.[0];
    setMessage('');
    setStatus('');
    if (!selected) return;
    if (!definition.types.includes(selected.type)) {
      setFile(null);
      setMessage('Unsupported file type.');
      return;
    }
    if (selected.size > definition.maxBytes) {
      setFile(null);
      setMessage(`File must be smaller than ${definition.maxBytes / 1024 / 1024} MB.`);
      return;
    }
    setFile(selected);
    setPreview(selected.type.startsWith('image/') ? URL.createObjectURL(selected) : '');
  }

  async function submit(event) {
    event.preventDefault();
    if (!file) return setMessage('Select a file first.');
    setStatus('Uploading...');
    setMessage('');
    try {
      const result = await definition.upload(file);
      setStatus('Uploaded');
      setMessage('File uploaded successfully.');
      onUploaded?.(result);
    } catch (error) {
      setStatus('');
      setMessage(error.message || 'Upload failed.');
    }
  }

  return (
    <form className="file-upload" onSubmit={submit}>
      <input type="file" accept={definition.accept} onChange={selectFile} />
      {preview ? <img src={preview} alt="Selected preview" className="file-upload__preview" /> : null}
      {file ? <span>{file.name}</span> : null}
      <button type="submit" disabled={!file || status === 'Uploading...'}>
        {status === 'Uploading...' ? 'Uploading...' : 'Upload file'}
      </button>
      {status && status !== 'Uploading...' ? <span role="status">{status}</span> : null}
      {message ? <span role="alert">{message}</span> : null}
    </form>
  );
}