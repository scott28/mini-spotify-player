# Mini Spotify Player Flow

## Pages

- `index.html`: launcher page.
- `login.html`: Spotify login + token exchange + save token in Firestore using a generated UUID key.
- `player.html`: enter UUID key to fetch token from Firestore and start Spotify Web Playback SDK.

## Setup

1. Start backend proxy:
   - `cd proxy && npm start`
2. Serve `docs` statically (example):
   - `cd docs && python3 -m http.server 8080`
3. Configure Firebase in `firebase.js` with your project credentials.
4. In Spotify Developer Dashboard, add redirect URI matching `login.html` URL (for local: `http://localhost:8080/login.html`).

## Notes

- The proxy keeps `SPOTIFY_CLIENT_SECRET` on the backend (used by `/refresh`).
- Firestore collection used: `spotifyTokens`.
- This demo stores access tokens directly for simplicity; production should encrypt tokens and apply expiration cleanup rules.
