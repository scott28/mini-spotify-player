import { getSpotifyToken } from "./firebase.js";

let spotifyPlayer = null;
let accessToken = null;

const statusEl = document.getElementById("status");
function log(message) { statusEl.textContent += `${message}\n`; }

function initPlayer() {
  spotifyPlayer = new Spotify.Player({
    name: "Mini Spotify Player",
    getOAuthToken: cb => cb(accessToken),
    volume: 0.5,
  });

  spotifyPlayer.addListener("ready", ({ device_id }) => {
    log(`Player ready. Device ID: ${device_id}`);
    log("Open Spotify and select 'Mini Spotify Player' as device.");
  });
  spotifyPlayer.addListener("not_ready", ({ device_id }) => log(`Device offline: ${device_id}`));
  spotifyPlayer.addListener("initialization_error", ({ message }) => log(message));
  spotifyPlayer.addListener("authentication_error", ({ message }) => log(message));
  spotifyPlayer.addListener("account_error", ({ message }) => log(message));
  spotifyPlayer.addListener("playback_error", ({ message }) => log(message));

  spotifyPlayer.connect();
}

document.getElementById("load").onclick = async () => {
  const key = document.getElementById("tokenKey").value.trim();
  if (!key) {
    log("Enter a token key.");
    return;
  }

  const record = await getSpotifyToken(key);
  if (!record?.accessToken) {
    log("Token key not found.");
    return;
  }

  accessToken = record.accessToken;
  log("Token loaded from Firestore.");

  if (window.Spotify) {
    initPlayer();
  } else {
    log("Spotify SDK not loaded yet.");
  }
};

document.getElementById("togglePlay").onclick = async () => {
  if (!spotifyPlayer) {
    log("Load token first.");
    return;
  }
  await spotifyPlayer.togglePlay();
};

window.onSpotifyWebPlaybackSDKReady = () => {
  log("Spotify SDK ready.");
};
