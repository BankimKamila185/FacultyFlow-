import { firebaseAdmin } from '../integrations/firebase';
import { firestore } from 'firebase-admin';
import { config } from '../config';
import { getFirestore } from 'firebase-admin/firestore';
import { LocalDataService } from './LocalDataService';

export class FirestoreService {
    private static _dbInstance: ReturnType<typeof getFirestore> | null = null;
    private static cache: Map<string, { data: any; expiry: number }> = new Map();
    private static CACHE_TTL = 60 * 1000; // 1 minute default TTL
    private static STABLE_COLLECTIONS = new Set(['workflows', 'departments', 'users', 'tasks']);
    private static STABLE_TTL = 10 * 60 * 1000; // 10 minutes for rarely-changing collections

    private static get useLocal(): boolean {
        return process.env.USE_LOCAL_DATA === 'true';
    }

    private static get db() {
        if (!this._dbInstance) {
            try {
                this._dbInstance = config.FIREBASE_DATABASE_ID 
                    ? getFirestore(firebaseAdmin.app(), config.FIREBASE_DATABASE_ID) 
                    : firebaseAdmin.firestore();
            } catch (err) {
                console.error('[FirestoreService] Initialization failed:', err);
                throw err;
            }
        }
        return this._dbInstance;
    }

    private static handleFallback(error: any): boolean {
        if (error?.message?.includes('RESOURCE_EXHAUSTED') || error?.code === 8 || this.useLocal) {
            console.warn(`[FirestoreService] Falling back to LocalDataService. Mode: ${this.useLocal ? 'Manual' : 'Auto (Quota Out)'}`);
            return true;
        }
        return false;
    }

    private static getCached<T>(key: string): T | null {
        const item = this.cache.get(key);
        if (item && item.expiry > Date.now()) {
            return item.data as T;
        }
        this.cache.delete(key);
        return null;
    }

    private static setCache(key: string, data: any, ttl = this.CACHE_TTL) {
        this.cache.set(key, { data, expiry: Date.now() + ttl });
    }

    static async getCollection<T = any>(collectionName: string, useCache = true): Promise<T[]> {
        if (useCache) {
            const cached = this.getCached<T[]>(`coll_${collectionName}`);
            if (cached) return cached;
        }

        try {
            if (this.useLocal) throw new Error('USE_LOCAL_DATA active');
            const snapshot = await this.db.collection(collectionName).get();
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
            const ttl = this.STABLE_COLLECTIONS.has(collectionName) ? this.STABLE_TTL : this.CACHE_TTL;
            if (useCache) this.setCache(`coll_${collectionName}`, data, ttl);
            return data;
        } catch (error) {
            if (this.handleFallback(error)) {
                return LocalDataService.getCollection(collectionName) as any;
            }
            throw error;
        }
    }

    static async getDoc<T = any>(collectionName: string, docId: string, useCache = true): Promise<T | null> {
        if (useCache) {
            const cached = this.getCached<T>(`doc_${collectionName}_${docId}`);
            if (cached) return cached;
        }
        
        try {
            if (this.useLocal) throw new Error('USE_LOCAL_DATA active');
            const doc = await this.db.collection(collectionName).doc(docId).get();
            if (!doc.exists) return null;
            const data = { id: doc.id, ...doc.data() } as T;
            if (useCache) this.setCache(`doc_${collectionName}_${docId}`, data);
            return data;
        } catch (error) {
            if (this.handleFallback(error)) {
                return LocalDataService.getDoc(collectionName, docId) as any;
            }
            throw error;
        }
    }

    static async findFirst<T = any>(collectionName: string, field: string, operator: firestore.WhereFilterOp, value: any): Promise<T | null> {
        try {
            if (this.useLocal) throw new Error('USE_LOCAL_DATA active');
            const snapshot = await this.db.collection(collectionName).where(field, operator, value).limit(1).get();
            if (snapshot.empty) return null;
            const doc = snapshot.docs[0];
            return { id: doc.id, ...doc.data() } as T;
        } catch (error) {
            if (this.handleFallback(error)) {
                return LocalDataService.findFirst(collectionName, field, operator as string, value) as any;
            }
            throw error;
        }
    }

    static async createDoc<T = any>(collectionName: string, data: any, docId?: string): Promise<T> {
        this.cache.delete(`coll_${collectionName}`);
        try {
            if (this.useLocal) throw new Error('USE_LOCAL_DATA active');
            if (docId) {
                await this.db.collection(collectionName).doc(docId).set({
                    ...data,
                    createdAt: firestore.FieldValue.serverTimestamp(),
                    updatedAt: firestore.FieldValue.serverTimestamp(),
                });
                return { id: docId, ...data } as T;
            } else {
                const docRef = await this.db.collection(collectionName).add({
                    ...data,
                    createdAt: firestore.FieldValue.serverTimestamp(),
                    updatedAt: firestore.FieldValue.serverTimestamp(),
                });
                const doc = await docRef.get();
                return { id: doc.id, ...doc.data() } as T;
            }
        } catch (error) {
            if (this.handleFallback(error)) {
                // For local mode, we don't persist writes yet in this emergency fix, 
                // but we return the object to keep the app flow alive.
                return { id: docId || `temp_${Date.now()}`, ...data } as any;
            }
            throw error;
        }
    }

    static async updateDoc<T = any>(collectionName: string, docId: string, data: any): Promise<T> {
        this.cache.delete(`doc_${collectionName}_${docId}`);
        this.cache.delete(`coll_${collectionName}`);
        try {
            if (this.useLocal) throw new Error('USE_LOCAL_DATA active');
            await this.db.collection(collectionName).doc(docId).update({
                ...data,
                updatedAt: firestore.FieldValue.serverTimestamp(),
            });
            const doc = await this.db.collection(collectionName).doc(docId).get();
            return { id: doc.id, ...doc.data() } as T;
        } catch (error) {
            if (this.handleFallback(error)) {
                return { id: docId, ...data } as any;
            }
            throw error;
        }
    }

    static async deleteDoc(collectionName: string, docId: string): Promise<void> {
        this.cache.delete(`doc_${collectionName}_${docId}`);
        this.cache.delete(`coll_${collectionName}`);
        try {
            if (this.useLocal) throw new Error('USE_LOCAL_DATA active');
            await this.db.collection(collectionName).doc(docId).delete();
        } catch (error) {
            if (this.handleFallback(error)) return;
            throw error;
        }
    }

    static async query<T = any>(collectionName: string, constraints: { field: string, operator: firestore.WhereFilterOp, value: any }[]): Promise<T[]> {
        try {
            if (this.useLocal) throw new Error('USE_LOCAL_DATA active');
            let query: firestore.Query = this.db.collection(collectionName);
            for (const c of constraints) {
                query = query.where(c.field, c.operator, c.value);
            }
            const snapshot = await query.get();
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
        } catch (error) {
            if (this.handleFallback(error)) {
                return LocalDataService.query(collectionName, constraints) as any;
            }
            throw error;
        }
    }

    static async count(collectionName: string, constraints: { field: string, operator: firestore.WhereFilterOp, value: any }[] = []): Promise<number> {
        try {
            if (this.useLocal) throw new Error('USE_LOCAL_DATA active');
            let query: firestore.Query = this.db.collection(collectionName);
            for (const c of constraints) {
                query = query.where(c.field, c.operator, c.value);
            }
            const snapshot = await query.count().get();
            return snapshot.data().count;
        } catch (error) {
            if (this.handleFallback(error)) {
                const results = await LocalDataService.query(collectionName, constraints);
                return results.length;
            }
            console.warn(`[FirestoreService] Count failed for ${collectionName}, returning 0.`, error);
            return 0;
        }
    }
}
