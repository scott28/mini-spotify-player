import { saveSpotifyToken } from "./firebase.js";

const clientId = "48eeca582e0f41d3b3071f318595bf83";
const proxyBaseUrl = "https://c4ea-107-10-242-5.ngrok-free.app";
const redirectUri = `${window.location.origin}${window.location.pathname}`;

const statusEl = document.getElementById("status");
const nextLinkEl = document.getElementById("nextLink");
function log(message) {
  statusEl.textContent += `${message}\n`;
}

function generateRandomString(length) {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const values = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(values)
    .map((x) => chars[x % chars.length])
    .join("");
}

async function sha256(plain) {
  const encoder = new TextEncoder();
  return await crypto.subtle.digest("SHA-256", encoder.encode(plain));
}

function base64urlencode(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function generateTokenKey() {
  const adjectives = [
    "blue",
    "brave",
    "calm",
    "clever",
    "cosmic",
    "daring",
    "eager",
    "fancy",
    "gentle",
    "happy",
    "jolly",
    "lucky",
    "mellow",
    "neon",
    "rapid",
    "sunny",
  ];
  const nouns = [
    "panda",
    "otter",
    "falcon",
    "tiger",
    "koala",
    "whale",
    "badger",
    "sparrow",
    "fox",
    "wolf",
    "lynx",
    "rabbit",
    "dolphin",
    "eagle",
    "heron",
    "yak",
  ];
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const number = String(Math.floor(Math.random() * 100)).padStart(2, "0");
  return `${adjective}-${noun}-${number}`;
}

function showPlayerLink(key) {
  const playerUrl = `/mini-spotify-player/player.html?key=${encodeURIComponent(key)}`;
  localStorage.setItem("mini_spotify_last_username", key);
  nextLinkEl.style.display = "block";
  nextLinkEl.innerHTML = `<strong>Temporary Username:</strong> ${key}<br><a href="${playerUrl}">Open Player with this username</a>`;
}

document.getElementById("login").onclick = async () => {
  const verifier = generateRandomString(64);
  localStorage.setItem("spotify_code_verifier", verifier);

  const challenge = base64urlencode(await sha256(verifier));
  const response = await fetch(
    `${proxyBaseUrl}/auth-url?redirectUri=${encodeURIComponent(redirectUri)}&codeChallenge=${encodeURIComponent(challenge)}`,
  );
  const data = await response.json();

  if (!response.ok) {
    log(`Auth URL error: ${JSON.stringify(data)}`);
    return;
  }

  window.location.href = data.url;
};

async function autoExchangeIfCallback() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  const verifier = localStorage.getItem("spotify_code_verifier");

  if (!code || !verifier) return;

  // Guard to prevent duplicate auto-exchange on refresh/re-execution of callback URL.
  const exchangeGuardKey = `spotify_exchange_done_${code}`;
  if (sessionStorage.getItem(exchangeGuardKey)) {
    window.history.replaceState({}, document.title, redirectUri);
    log("Login already completed for this callback code.");
    return;
  }
  sessionStorage.setItem(exchangeGuardKey, "1");

  log("Completing Spotify login...");
  const response = await fetch(`${proxyBaseUrl}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code,
      redirectUri,
      codeVerifier: verifier,
      clientId,
    }),
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
    obtainedAt: Date.now(),
  });

  localStorage.removeItem("spotify_code_verifier");
  window.history.replaceState({}, document.title, redirectUri);
  log("Saved token to Firestore.");
  showPlayerLink(key);
}

autoExchangeIfCallback();
