const defaultOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5002';
const fallbackBase = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:5002' : defaultOrigin);

export const API_BASE = fallbackBase.replace(/\/$/, '');

function buildApiBases() {
  const bases = [API_BASE];
  const localBase = 'http://localhost:5002';
  const productionBase = 'https://smart-medical-store-backend.onrender.com';

  if (!bases.includes(localBase)) bases.push(localBase);
  if (!bases.includes(productionBase)) bases.push(productionBase);

  return bases;
}

async function parseResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json();
  }

  return response.text();
}

export async function request(path, options = {}) {
  let lastError = null;

  for (const base of buildApiBases()) {
    try {
      const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
      const response = await fetch(`${base}${path}`, {
        headers: isFormData
          ? { ...(options.headers || {}) }
          : { 'Content-Type': 'application/json', ...(options.headers || {}) },
        ...options
      });

      const data = await parseResponse(response).catch(() => null);

      if (!response.ok) {
        const message = typeof data === 'string'
          ? data
          : data?.message || data?.error || response.statusText || `Request failed with ${response.status}`;
        throw new Error(message);
      }

      return data;
    } catch (error) {
      lastError = error;
      if (error instanceof Error && error.message !== 'Failed to fetch') {
        throw error;
      }
    }
  }

  throw lastError || new Error('Failed to fetch');
}