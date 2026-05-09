const clientId = "48eeca582e0f41d3b3071f318595bf83";

const redirectUri = "https://scott28.github.io/mini-spotify-player/";
const proxyBaseUrl = "https://d4bc-64-44-118-107.ngrok-free.app";

const scopes = [
  "streaming",
  "user-read-email",
  "user-read-private",
  "user-modify-playback-state",
  "user-read-playback-state"
];

const statusEl = document.getElementById("status");

function log(message) {
  statusEl.textContent += message + "\n";
}

function generateRandomString(length) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const values = crypto.getRandomValues(new Uint8Array(length));

  return Array.from(values)
    .map(x => chars[x % chars.length])
    .join("");
}

async function sha256(plain) {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return await crypto.subtle.digest("SHA-256", data);
}

function base64urlencode(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

document.getElementById("login").onclick = async () => {
  const verifier = generateRandomString(64);
  localStorage.setItem("spotify_code_verifier", verifier);

  const challenge = base64urlencode(await sha256(verifier));

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: scopes.join(" "),
    code_challenge_method: "S256",
    code_challenge: challenge
  });

  window.location.href =
    `${proxyBaseUrl}/spotify-auth/authorize?${params.toString()}`;
};

async function getAccessToken() {
  const existingToken = localStorage.getItem("spotify_access_token");
  if (existingToken) return existingToken;

  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");

  if (!code) return null;

  const verifier = localStorage.getItem("spotify_code_verifier");

  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    code_verifier: verifier
  });

  const response = await fetch(`${proxyBaseUrl}/spotify-auth/api/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });

  const data = await response.json();

  if (!response.ok) {
    log("Token error:");
    log(JSON.stringify(data, null, 2));
    return null;
  }

  localStorage.setItem("spotify_access_token", data.access_token);

  window.history.replaceState({}, document.title, redirectUri);

  return data.access_token;
}

document.getElementById("profile").onclick = async () => {
  const token = await getAccessToken();

  if (!token) {
    log("Not logged in.");
    return;
  }

  const response = await fetch(`${proxyBaseUrl}/spotify-api/v1/me`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  const data = await response.json();

  log(JSON.stringify(data, null, 2));
};

window.onSpotifyWebPlaybackSDKReady = async () => {
  const token = await getAccessToken();

  if (!token) {
    log("Click Login with Spotify.");
    return;
  }

  const player = new Spotify.Player({
    name: "Scott Mini Player",
    getOAuthToken: cb => cb(token),
    volume: 0.5
  });

  player.addListener("ready", ({ device_id }) => {
    log("Spotify player ready.");
    log("Device ID: " + device_id);
    log("Open Spotify and select 'Scott Mini Player' from devices.");
  });

  player.addListener("not_ready", ({ device_id }) => {
    log("Device went offline: " + device_id);
  });

  player.addListener("initialization_error", ({ message }) => log(message));
  player.addListener("authentication_error", ({ message }) => log(message));
  player.addListener("account_error", ({ message }) => log(message));
  player.addListener("playback_error", ({ message }) => log(message));

  document.getElementById("togglePlay").onclick = () => {
    player.togglePlay();
  };

  await player.connect();
};
