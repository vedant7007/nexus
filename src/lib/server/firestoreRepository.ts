/**
 * @module server/firestoreRepository
 *
 * Responsibility: the Firestore implementation of {@link IncidentRepository}.
 *
 * Isolated in its own module so that importing the repository contract does not
 * drag the Admin SDK into a test process. Everything Firestore-shaped stops here.
 */
import { type App, cert, getApps, initializeApp } from 'firebase-admin/app';
import { type Firestore, getFirestore } from 'firebase-admin/firestore';

import { serverConfig } from '../config';
import type { IncidentStatus } from '../engine/types';

import {
  type Incident,
  type IncidentRepository,
  type NewIncident,
  compareIncidents,
} from './repository';

/** Firestore collection holding incidents. */
const COLLECTION = 'incidents';

let cachedApp: App | null = null;

/**
 * Initialises the Admin SDK once per process.
 *
 * On Cloud Run this uses Application Default Credentials — the service account
 * attached to the revision — so no key file exists to leak. A key is only read
 * from the environment for local development against a real project.
 *
 * @returns The initialised app.
 */
function getApp(): App {
  if (cachedApp !== null) return cachedApp;

  const existing = getApps()[0];
  if (existing !== undefined) {
    cachedApp = existing;
    return cachedApp;
  }

  const { FIREBASE_PROJECT_ID } = serverConfig();
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;

  cachedApp =
    raw === undefined
      ? initializeApp(FIREBASE_PROJECT_ID === undefined ? {} : { projectId: FIREBASE_PROJECT_ID })
      : initializeApp({ credential: cert(JSON.parse(raw) as Record<string, string>) });

  return cachedApp;
}

/**
 * Returns the Firestore client.
 *
 * @returns The Firestore instance for this process.
 */
export function getDb(): Firestore {
  return getFirestore(getApp());
}

/** Firestore-backed incident repository. */
export class FirestoreIncidentRepository implements IncidentRepository {
  private readonly db: Firestore;

  /** @param db - Firestore client. Defaults to the process-wide instance. */
  constructor(db: Firestore = getDb()) {
    this.db = db;
  }

  /** @inheritdoc */
  async create(incident: NewIncident): Promise<Incident> {
    const ref = await this.db.collection(COLLECTION).add(incident);
    return { ...incident, id: ref.id };
  }

  /** @inheritdoc */
  async list(limit: number): Promise<Incident[]> {
    // Ordered in memory rather than by a composite index: the working set is a
    // single match's incidents, and requiring an index makes first deploy fail
    // in a way that is baffling to debug. Revisit if this ever spans matches.
    const snap = await this.db.collection(COLLECTION).orderBy('createdAt', 'desc').limit(200).get();

    return snap.docs
      .map((doc) => ({ ...(doc.data() as NewIncident), id: doc.id }))
      .sort(compareIncidents)
      .slice(0, limit);
  }

  /** @inheritdoc */
  async findById(id: string): Promise<Incident | null> {
    const doc = await this.db.collection(COLLECTION).doc(id).get();
    if (!doc.exists) return null;
    return { ...(doc.data() as NewIncident), id: doc.id };
  }

  /** @inheritdoc */
  async updateStatus(id: string, status: IncidentStatus): Promise<Incident | null> {
    const ref = this.db.collection(COLLECTION).doc(id);
    const doc = await ref.get();
    if (!doc.exists) return null;

    await ref.update({ status });
    return { ...(doc.data() as NewIncident), id: doc.id, status };
  }
}
