import { saveSpotifyToken } from "./firebase.js";

const clientId = "48eeca582e0f41d3b3071f318595bf83";
const proxyBaseUrl = "http://localhost:8090";
const redirectUri = `${window.location.origin}${window.location.pathname}`;

const statusEl = document.getElementById("status");
function log(message) { statusEl.textContent += `${message}\n`; }

function generateRandomString(length) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const values = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(values).map(x => chars[x % chars.length]).join("");
}

async function sha256(plain) {
  const encoder = new TextEncoder();
  return await crypto.subtle.digest("SHA-256", encoder.encode(plain));
}

function base64urlencode(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function generateTokenKey() {
  return crypto.randomUUID();
}

document.getElementById("login").onclick = async () => {
  const verifier = generateRandomString(64);
  localStorage.setItem("spotify_code_verifier", verifier);

  const challenge = base64urlencode(await sha256(verifier));
  const response = await fetch(`${proxyBaseUrl}/auth-url?redirectUri=${encodeURIComponent(redirectUri)}&codeChallenge=${encodeURIComponent(challenge)}`);
  const data = await response.json();

  if (!response.ok) {
    log(`Auth URL error: ${JSON.stringify(data)}`);
    return;
  }

  window.location.href = data.url;
};

document.getElementById("exchange").onclick = async () => {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  const verifier = localStorage.getItem("spotify_code_verifier");

  if (!code || !verifier) {
    log("Missing Spotify code or verifier. Click Login first.");
    return;
  }

  const response = await fetch(`${proxyBaseUrl}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, redirectUri, codeVerifier: verifier, clientId }),
  });

  const data = await response.json();
  if (!response.ok || !data.access_token) {
    log(`Token exchange failed: ${JSON.stringify(data)}`);
    return;
  }

  const key = generateTokenKey();
  await saveSpotifyToken(key, {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresIn: data.expires_in,
    tokenType: data.token_type,
  });

  log(`Saved token to Firestore.`);
  log(`Share this key with Player page: ${key}`);
  window.history.replaceState({}, document.title, redirectUri);
};
