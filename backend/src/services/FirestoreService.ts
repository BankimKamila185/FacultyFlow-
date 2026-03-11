import { firebaseAdmin } from '../integrations/firebase';
import { firestore } from 'firebase-admin';

export class FirestoreService {
    private static db = firebaseAdmin.firestore();

    static async getCollection<T = any>(collectionName: string): Promise<T[]> {
        const snapshot = await this.db.collection(collectionName).get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
    }

    static async getDoc<T = any>(collectionName: string, docId: string): Promise<T | null> {
        const doc = await this.db.collection(collectionName).doc(docId).get();
        if (!doc.exists) return null;
        return { id: doc.id, ...doc.data() } as T;
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
        let query: firestore.Query = this.db.collection(collectionName);
        for (const c of constraints) {
            query = query.where(c.field, c.operator, c.value);
        }
        const snapshot = await query.count().get();
        return snapshot.data().count;
    }
}
