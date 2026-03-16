import { firebaseAdmin } from '../integrations/firebase';
import { firestore } from 'firebase-admin';
import { config } from '../config';
import { getFirestore } from 'firebase-admin/firestore';

export class FirestoreService {
    private static _dbInstance: ReturnType<typeof getFirestore> | null = null;
    private static cache: Map<string, { data: any; expiry: number }> = new Map();
    private static CACHE_TTL = 60 * 1000; // 1 minute default TTL

    private static get db() {
        if (!this._dbInstance) {
            this._dbInstance = config.FIREBASE_DATABASE_ID 
                ? getFirestore(firebaseAdmin.app(), config.FIREBASE_DATABASE_ID) 
                : firebaseAdmin.firestore();
        }
        return this._dbInstance;
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
        const snapshot = await this.db.collection(collectionName).get();
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
        if (useCache) this.setCache(`coll_${collectionName}`, data);
        return data;
    }

    static async getDoc<T = any>(collectionName: string, docId: string, useCache = true): Promise<T | null> {
        if (useCache) {
            const cached = this.getCached<T>(`doc_${collectionName}_${docId}`);
            if (cached) return cached;
        }
        const doc = await this.db.collection(collectionName).doc(docId).get();
        if (!doc.exists) return null;
        const data = { id: doc.id, ...doc.data() } as T;
        if (useCache) this.setCache(`doc_${collectionName}_${docId}`, data);
        return data;
    }

    static async findFirst<T = any>(collectionName: string, field: string, operator: firestore.WhereFilterOp, value: any): Promise<T | null> {
        const snapshot = await this.db.collection(collectionName).where(field, operator, value).limit(1).get();
        if (snapshot.empty) return null;
        const doc = snapshot.docs[0];
        return { id: doc.id, ...doc.data() } as T;
    }

    static async createDoc<T = any>(collectionName: string, data: any, docId?: string): Promise<T> {
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
    }

    static async updateDoc<T = any>(collectionName: string, docId: string, data: any): Promise<T> {
        await this.db.collection(collectionName).doc(docId).update({
            ...data,
            updatedAt: firestore.FieldValue.serverTimestamp(),
        });
        const doc = await this.db.collection(collectionName).doc(docId).get();
        return { id: doc.id, ...doc.data() } as T;
    }

    static async deleteDoc(collectionName: string, docId: string): Promise<void> {
        await this.db.collection(collectionName).doc(docId).delete();
    }

    static async query<T = any>(collectionName: string, constraints: { field: string, operator: firestore.WhereFilterOp, value: any }[]): Promise<T[]> {
        let query: firestore.Query = this.db.collection(collectionName);
        for (const c of constraints) {
            query = query.where(c.field, c.operator, c.value);
        }
        const snapshot = await query.get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
    }

    static async count(collectionName: string, constraints: { field: string, operator: firestore.WhereFilterOp, value: any }[] = []): Promise<number> {
        try {
            let query: firestore.Query = this.db.collection(collectionName);
            for (const c of constraints) {
                query = query.where(c.field, c.operator, c.value);
            }
            const snapshot = await query.count().get();
            return snapshot.data().count;
        } catch (error) {
            console.warn(`[FirestoreService] Count failed for ${collectionName}, returning 0.`, error);
            return 0;
        }
    }
}
