/**
 * Demo "login": the acting persona is a cookie, sent to the API as `x-user-id`.
 * The real backend replaces this with proper auth (bearer token).
 */
export const USER_COOKIE = "rs_user";

export function getUserId(): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${USER_COOKIE}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : null;
}

export function setUserId(id: string | null) {
  if (id) document.cookie = `${USER_COOKIE}=${encodeURIComponent(id)}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
  else document.cookie = `${USER_COOKIE}=; path=/; max-age=0`;
}
