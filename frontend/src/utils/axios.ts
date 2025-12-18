import axios from "axios";

const baseURL = import.meta.env.VITE_API_URL ?? "/api/v1";

const api = axios.create({
  baseURL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 30000, // 30 second timeout
});

// Attach Authorization header when token exists
api.interceptors.request.use((config) => {
  try {
    const token = localStorage.getItem("nextsight_token") || 
                  localStorage.getItem("access_token") || 
                  localStorage.getItem("token");
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch {
    // ignore (e.g. SSR or restricted storage)
  }
  return config;
});

export default api;
