import { API_URL } from '../config';

export const getAvatarUrl = (seed, type = 'avataaars') => {
  // Use a variety of services to avoid single-service rate limits
  if (!seed) return `https://ui-avatars.com/api/?name=User&background=random`;
  
  // Fallback to UI Avatars if Dicebear is failing (using a random number to distribute load)
  // For now, we'll use a safer service as primary or provide a fallback mechanism
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(seed)}&background=random&color=fff`;
};

export const fetchWithAuth = async (url, options = {}) => {
  const token = localStorage.getItem('auth_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(url, { 
    ...options, 
    headers, 
    credentials: 'include' // This ensures cookies are sent for all platforms
  });
  
  if (response.status === 401) {
    console.warn('Unauthorized request.');
  }
  
  return response;
};
