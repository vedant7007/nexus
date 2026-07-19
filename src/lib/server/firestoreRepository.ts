import { type App, cert, getApps, initializeApp } from 'firebase-admin/app';
import { type Firestore, getFirestore } from 'firebase-admin/firestore';

import { serverConfig } from '../config';
import type { IncidentStatus } from '../engine/types';
import { incidentSchema } from '../schemas/api';

import {
  type Incident,
  type IncidentRepository,
  type NewIncident,
  compareIncidents,
} from './repository';

const COLLECTION = 'incidents';

// A stored document is an incident minus its id (which is the Firestore doc id).
// Validating on read holds the persistence boundary to the same "check at the
// edge" standard as the network boundary — a corrupt record fails loudly.
const storedIncidentSchema = incidentSchema.omit({ id: true });

let cachedApp: App | null = null;

function getApp(): App {
  if (cachedApp !== null) return cachedApp;

  const existing = getApps()[0];
  if (existing !== undefined) {
    cachedApp = existing;
    return cachedApp;
  }

  const { FIREBASE_PROJECT_ID } = serverConfig();
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;

  // On Cloud Run this uses Application Default Credentials, so no key file exists
  // to leak; a key is only read from the environment for local development.
  cachedApp =
    raw === undefined
      ? initializeApp(FIREBASE_PROJECT_ID === undefined ? {} : { projectId: FIREBASE_PROJECT_ID })
      : initializeApp({ credential: cert(JSON.parse(raw) as Record<string, string>) });

  return cachedApp;
}

export function getDb(): Firestore {
  return getFirestore(getApp());
}

function toIncident(id: string, data: unknown): Incident {
  return { ...storedIncidentSchema.parse(data), id };
}

export class FirestoreIncidentRepository implements IncidentRepository {
  private readonly db: Firestore;

  constructor(db: Firestore = getDb()) {
    this.db = db;
  }

  async create(incident: NewIncident): Promise<Incident> {
    const ref = await this.db.collection(COLLECTION).add(incident);
    return { ...incident, id: ref.id };
  }

  async list(limit: number): Promise<Incident[]> {
    // Ordered in memory rather than by a composite index: the working set is one
    // match's incidents, and requiring an index makes the first deploy fail in a
    // baffling way. Revisit if this ever spans matches.
    const snap = await this.db.collection(COLLECTION).orderBy('createdAt', 'desc').limit(200).get();

    return snap.docs
      .map((doc) => toIncident(doc.id, doc.data()))
      .sort(compareIncidents)
      .slice(0, limit);
  }

  async findById(id: string): Promise<Incident | null> {
    const doc = await this.db.collection(COLLECTION).doc(id).get();
    if (!doc.exists) return null;
    return toIncident(doc.id, doc.data());
  }

  async updateStatus(id: string, status: IncidentStatus): Promise<Incident | null> {
    const ref = this.db.collection(COLLECTION).doc(id);
    const doc = await ref.get();
    if (!doc.exists) return null;

    await ref.update({ status });
    return { ...toIncident(doc.id, doc.data()), status };
  }
}
