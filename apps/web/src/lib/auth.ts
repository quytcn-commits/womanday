"use client";

export interface UserInfo {
  id: string;
  name: string;
  position: string;
  dept: string;
  role: string;
  hasSpun: boolean;
  selfieUrl: string | null;
  cardTemplateId: number | null;
  cardImageUrl: string | null;
  resultImageUrl: string | null;
  greeting: string | null;
}

const TOKEN_KEY = "womanday_token";
const USER_KEY = "womanday_user";

export function saveAuth(token: string, user: UserInfo) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser(): UserInfo | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function updateUser(partial: Partial<UserInfo>) {
  const user = getUser();
  if (!user) return;
  saveAuth(getToken()!, { ...user, ...partial });
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function isLoggedIn(): boolean {
  return !!getToken() && !!getUser();
}

export function isAdmin(): boolean {
  return getUser()?.role === "admin";
}
