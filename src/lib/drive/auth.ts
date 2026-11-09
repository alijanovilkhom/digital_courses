// Google Drive access through OAuth: a refresh token (made once by `npm run drive-auth`) is exchanged
// for short-lived access tokens. Nothing here needs the browser.

const TOKEN_URL = "https://oauth2.googleapis.com/token";

export function driveConfigured(): boolean {
  const e = process.env;
  return !!(e.GOOGLE_CLIENT_ID && e.GOOGLE_CLIENT_SECRET && e.GOOGLE_REFRESH_TOKEN && e.GOOGLE_DRIVE_FOLDER_ID);
}

let cached: { token: string; expiresAt: number } | null = null;

export async function accessToken(): Promise<string> {
  if (cached && Date.now() < cached.expiresAt - 60_000) return cached.token;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN ?? "",
    }),
  });
  const body = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error?: string };
  if (!res.ok || !body.access_token) {
    const hint =
      body.error === "invalid_grant"
        ? " The refresh token expired or was revoked: run `npm run drive-auth` again. (If the OAuth app is in Testing status, Google expires tokens after 7 days: switch it to In production.)"
        : "";
    throw new Error(`Google token request failed: ${body.error ?? res.status}.${hint}`);
  }
  cached = { token: body.access_token, expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000 };
  return cached.token;
}
