import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  where,
  type Firestore,
} from "firebase/firestore";
import type { Trade, BacktestSession } from "./types";

// ─── Firebase Config ──────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// ─── Singleton init ───────────────────────────────────────────────────────────
let app: FirebaseApp | null = null;
let db: Firestore | null = null;

function getDb(): Firestore {
  if (!db) {
    if (getApps().length === 0) {
      app = initializeApp(firebaseConfig);
    } else {
      app = getApps()[0];
    }
    db = getFirestore(app);
  }
  return db;
}

export function isFirebaseConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  );
}

// ─── Collections ──────────────────────────────────────────────────────────────
const TRADES_COL    = "trades";
const SESSIONS_COL  = "sessions";

// ─── Trades CRUD ──────────────────────────────────────────────────────────────

export async function saveTrade(trade: Trade): Promise<void> {
  const firestore = getDb();
  const ref = doc(firestore, TRADES_COL, trade.id);
  await setDoc(ref, trade);
}

export async function updateTrade(id: string, data: Partial<Trade>): Promise<void> {
  const firestore = getDb();
  const ref = doc(firestore, TRADES_COL, id);
  await updateDoc(ref, data as Record<string, unknown>);
}

export async function deleteTrade(id: string): Promise<void> {
  const firestore = getDb();
  const ref = doc(firestore, TRADES_COL, id);
  await deleteDoc(ref);
}

export async function getTrade(id: string): Promise<Trade | null> {
  const firestore = getDb();
  const ref = doc(firestore, TRADES_COL, id);
  const snap = await getDoc(ref);
  return snap.exists() ? (snap.data() as Trade) : null;
}

export async function getTradesBySession(sessionId: string): Promise<Trade[]> {
  const firestore = getDb();
  const q = query(
    collection(firestore, TRADES_COL),
    where("sessionId", "==", sessionId),
    orderBy("entryTime", "asc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as Trade);
}

export async function getAllTrades(): Promise<Trade[]> {
  const firestore = getDb();
  const q = query(
    collection(firestore, TRADES_COL),
    orderBy("entryTime", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as Trade);
}

// ─── Sessions CRUD ────────────────────────────────────────────────────────────

export async function saveSession(session: BacktestSession): Promise<void> {
  const firestore = getDb();
  const ref = doc(firestore, SESSIONS_COL, session.id);
  await setDoc(ref, session);
}

export async function updateSession(
  id: string,
  data: Partial<BacktestSession>
): Promise<void> {
  const firestore = getDb();
  const ref = doc(firestore, SESSIONS_COL, id);
  await updateDoc(ref, data as Record<string, unknown>);
}

export async function getAllSessions(): Promise<BacktestSession[]> {
  const firestore = getDb();
  const q = query(
    collection(firestore, SESSIONS_COL),
    orderBy("updatedAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as BacktestSession);
}

export async function deleteSession(id: string): Promise<void> {
  const firestore = getDb();
  const ref = doc(firestore, SESSIONS_COL, id);
  await deleteDoc(ref);
}
