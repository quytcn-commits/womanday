const API_BASE_FALLBACK = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

// At runtime, use the same hostname as the page (works for both localhost and LAN IP)
function getApiBase(): string {
  if (typeof window === "undefined") return API_BASE_FALLBACK;
  // Production: NEXT_PUBLIC_API_URL set → use it (same domain, through nginx reverse proxy)
  // Dev: fallback to same hostname with port 3001
  const configured = process.env.NEXT_PUBLIC_API_URL;
  if (configured) return configured;
  const { protocol, hostname } = window.location;
  return `${protocol}//${hostname}:3001`;
}

export function getApiUrl(path: string) {
  return `${getApiBase()}${path}`;
}

export async function apiFetch<T>(
  path: string,
  options?: RequestInit & { auth?: boolean }
): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("womanday_token") : null;

  const headers: Record<string, string> = {
    ...(options?.body ? { "Content-Type": "application/json" } : {}),
    ...(options?.headers as Record<string, string>),
  };

  if (token && options?.auth !== false) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(getApiUrl(path), {
    ...options,
    headers,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Network error" }));
    throw Object.assign(new Error(err.message || "Request failed"), { code: res.status, data: err });
  }

  return res.json();
}

export async function apiUpload<T>(
  path: string,
  formData: FormData
): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("womanday_token") : null;
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(getApiUrl(path), {
    method: "POST",
    headers,
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Upload failed" }));
    throw Object.assign(new Error(err.message || "Upload failed"), { code: res.status });
  }

  return res.json();
}
