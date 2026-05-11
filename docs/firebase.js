import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBElz8mNRr6DZijhg7FKe20pE4SoNJRvE4",
  authDomain: "mini-spotify-player-86d3c.firebaseapp.com",
  projectId: "mini-spotify-player-86d3c",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export async function saveSpotifyToken(key, tokenPayload) {
  await setDoc(doc(db, "spotifyTokens", key), {
    ...tokenPayload,
    createdAt: serverTimestamp(),
  });
}

export async function getSpotifyToken(key) {
  const snap = await getDoc(doc(db, "spotifyTokens", key));
  if (!snap.exists()) return null;
  return snap.data();
}
