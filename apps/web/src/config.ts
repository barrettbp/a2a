const raw = (import.meta.env.VITE_API_URL as string | undefined) || "http://localhost:3001";
export const API_URL = raw.replace(/\/+$/, "");
