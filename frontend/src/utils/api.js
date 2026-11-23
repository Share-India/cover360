// In deployment set NEXT_PUBLIC_API_URL (e.g. https://api.example.com/api) at build time.
// Otherwise use the same host the app was opened on with the backend port, so it also works
// from a phone on the same Wi-Fi (127.0.0.1 would point at the phone itself).
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || (typeof window !== 'undefined'
  ? `http://${window.location.hostname}:5000/api`
  : 'http://127.0.0.1:5000/api');

/**
 * Helper to construct headers, adding Authorization only if a JWT token is present.
 */
function getHeaders() {
  const token = localStorage.getItem('jwt_token');
  const headers = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export async function analyzePolicy(file, kycFile = null) {
  const formData = new FormData();
  formData.append('file', file);
  if (kycFile) formData.append('kyc_file', kycFile);

  const response = await fetch(`${API_BASE_URL}/analyze-policy`, {
    method: 'POST',
    body: formData,
    headers: getHeaders()
  });

  if (!response.ok) {
    // Show the server's own explanation when it gives one (e.g. "AI service is busy")
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Failed to analyze policy (Status ${response.status})`);
  }
  return await response.json();
}

export async function fetchHistory() {
  const response = await fetch(`${API_BASE_URL}/history`, {
    method: 'GET',
    headers: getHeaders()
  });

  if (!response.ok) throw new Error("Failed to fetch history");
  return await response.json();
}

export async function updatePolicy(id, data) {
  const headers = getHeaders();
  headers['Content-Type'] = 'application/json';
  
  const response = await fetch(`${API_BASE_URL}/policies/${id}`, {
    method: 'PUT',
    headers: headers,
    body: JSON.stringify(data)
  });

  if (!response.ok) throw new Error("Failed to update policy");
  return await response.json();
}

export function getStoredUser() {
  try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch (e) { return null; }
}

export async function fetchRecommendations(userId = null) {
  if (userId == null) userId = getStoredUser()?.id;
  const response = await fetch(`${API_BASE_URL}/recommendations/${userId}`, {
    method: 'GET',
    headers: getHeaders()
  });

  if (!response.ok) throw new Error("Failed to fetch recommendations");
  return await response.json();
}

export async function generateReport(id) {
  const headers = getHeaders();
  headers['Content-Type'] = 'application/json';
  
  const response = await fetch(`${API_BASE_URL}/policies/${id}/generate-report`, {
    method: 'POST',
    headers: headers,
  });

  if (!response.ok) throw new Error("Failed to generate report");
  return await response.json();
}

export async function chatInsure(chatHistory) {
  const headers = getHeaders();
  headers['Content-Type'] = 'application/json';
  
  const payload = { history: chatHistory };
  
  const response = await fetch(`${API_BASE_URL}/chat`, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(payload)
  });

  if (!response.ok) throw new Error("Failed to chat");
  return await response.json();
}

export async function loginUser(identifier, password) {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Login failed');
  }

  if (data.token) {
    localStorage.setItem('jwt_token', data.token);
    // Setting user for the layout.js to use
    localStorage.setItem('user', JSON.stringify(data.user || { name: 'User', email: identifier }));
  }
  return data;
}

export async function sendSignupOtp(mobile, email) {
  const response = await fetch(`${API_BASE_URL}/auth/send-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mobile, email })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(data.error || 'Could not send the OTP');
    err.retryAfter = data.retryAfter;
    throw err;
  }
  return data;
}

export async function signupUser({ fullName, email, mobile, otp, password, confirmPassword }) {
  const response = await fetch(`${API_BASE_URL}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fullName, email, mobile, otp, password, confirmPassword })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Signup failed');
  }

  return data;
}

export async function adminLoginUser(identifier, password) {
  const response = await fetch(`${API_BASE_URL}/auth/admin-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Admin login failed');
  }

  localStorage.setItem('jwt_token', data.token);
  localStorage.setItem('user', JSON.stringify(data.user));
  return data;
}

export async function fetchAdminUsers() {
  const response = await fetch(`${API_BASE_URL}/admin/users`, { method: 'GET', headers: getHeaders() });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Failed to load users');
  return data;
}

export async function createAdminUser(payload) {
  const headers = getHeaders();
  headers['Content-Type'] = 'application/json';
  const response = await fetch(`${API_BASE_URL}/admin/users`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Failed to create user');
  return data;
}
