// One-time Google sign-in. Opens the consent page, receives the answer on a local port,
// and writes GOOGLE_REFRESH_TOKEN into .env.local. Needs GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.
import { execFile } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const SCOPE = "https://www.googleapis.com/auth/drive.readonly";
const ENV_FILE = path.join(process.cwd(), ".env.local");

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
if (!clientId || !clientSecret) {
  console.error("Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.local first (see .env.example).");
  process.exit(1);
}

const verifier = crypto.randomBytes(32).toString("base64url");
const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
const state = crypto.randomBytes(16).toString("hex");

function saveToken(token: string) {
  const current = fs.existsSync(ENV_FILE) ? fs.readFileSync(ENV_FILE, "utf8") : "";
  const line = `GOOGLE_REFRESH_TOKEN=${token}`;
  const next = /^GOOGLE_REFRESH_TOKEN=.*$/m.test(current)
    ? current.replace(/^GOOGLE_REFRESH_TOKEN=.*$/m, line)
    : `${current}${current && !current.endsWith("\n") ? "\n" : ""}${line}\n`;
  fs.writeFileSync(ENV_FILE, next);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  if (url.pathname !== "/callback") {
    res.writeHead(404).end();
    return;
  }
  const reply = (status: number, text: string) => {
    res.writeHead(status, { "content-type": "text/plain; charset=utf-8" }).end(text);
  };
  const fail = (text: string) => {
    reply(400, text);
    console.error(text);
    server.close();
    process.exitCode = 1;
  };

  if (url.searchParams.get("state") !== state) return fail("The answer does not belong to this login (state mismatch). Start again.");
  const error = url.searchParams.get("error");
  if (error) return fail(`Google refused: ${error}`);
  const code = url.searchParams.get("code");
  if (!code) return fail("Google sent no code.");

  const redirectUri = `http://127.0.0.1:${(server.address() as { port: number }).port}/callback`;
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      code_verifier: verifier,
    }),
  });
  const body = (await tokenRes.json().catch(() => ({}))) as { refresh_token?: string; error?: string; error_description?: string };
  if (!tokenRes.ok || !body.refresh_token) {
    return fail(`Google did not return a refresh token: ${body.error ?? tokenRes.status} ${body.error_description ?? ""}`.trim());
  }

  saveToken(body.refresh_token);
  reply(200, "Готово. Токен записан в .env.local, эту вкладку можно закрыть.");
  console.log("Done: GOOGLE_REFRESH_TOKEN was written to .env.local.");
  server.close();
});

server.listen(0, "127.0.0.1", () => {
  const port = (server.address() as { port: number }).port;
  const authUrl =
    "https://accounts.google.com/o/oauth2/v2/auth?" +
    new URLSearchParams({
      client_id: clientId,
      redirect_uri: `http://127.0.0.1:${port}/callback`,
      response_type: "code",
      scope: SCOPE,
      access_type: "offline",
      prompt: "consent", // makes Google return a refresh token every time
      state,
      code_challenge: challenge,
      code_challenge_method: "S256",
    });
  console.log("Open this page and allow read-only access to Google Drive:\n\n" + authUrl + "\n");
  execFile(process.platform === "darwin" ? "open" : "xdg-open", [authUrl], () => {});
});

setTimeout(() => {
  console.error("Timed out after 5 minutes. Run `npm run drive-auth` again.");
  process.exit(1);
}, 5 * 60_000).unref();
