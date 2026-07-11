import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, signInAnonymously, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

type FirebaseClient = {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
};

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let client: FirebaseClient | null | undefined;

export function isFirebaseConfigured() {
  return Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);
}

export function getFirebaseClient(): FirebaseClient | null {
  if (client !== undefined) return client;
  if (!isFirebaseConfigured()) {
    client = null;
    return client;
  }

  const app = getApps().length ? getApp() : initializeApp(config);
  client = { app, auth: getAuth(app), db: getFirestore(app) };
  return client;
}

export async function ensureFirebaseUser() {
  const firebase = getFirebaseClient();
  if (!firebase) return null;
  if (firebase.auth.currentUser) return firebase.auth.currentUser;
  return (await signInAnonymously(firebase.auth)).user;
}
