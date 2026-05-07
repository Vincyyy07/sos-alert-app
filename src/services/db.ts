import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  Timestamp,
  addDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const dbService = {
  async getDocument<T>(path: string, id: string): Promise<T | null> {
    try {
      const docRef = doc(db, path, id);
      const docSnap = await getDoc(docRef);
      return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } as T : null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `${path}/${id}`);
      return null;
    }
  },

  async createDocument(path: string, data: any, id?: string) {
    try {
      const colRef = collection(db, path);
      if (id) {
        const docRef = doc(colRef, id);
        await setDoc(docRef, { ...data, createdAt: serverTimestamp() });
        return id;
      } else {
        const docRef = await addDoc(colRef, { ...data, createdAt: serverTimestamp() });
        return docRef.id;
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  async updateDocument(path: string, id: string, data: any) {
    try {
      const docRef = doc(db, path, id);
      await updateDoc(docRef, { ...data, updatedAt: serverTimestamp() });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${path}/${id}`);
    }
  },

  async deleteDocument(path: string, id: string) {
    try {
      const docRef = doc(db, path, id);
      await deleteDoc(docRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `${path}/${id}`);
    }
  },

  subscribeToCollection<T>(
    path: string, 
    queryConstraints: any[], 
    onUpdate: (data: T[]) => void
  ) {
    const colRef = collection(db, path);
    const q = query(colRef, ...queryConstraints);
    
    return onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
      onUpdate(items);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
  },

  subscribeToDocument<T>(
    path: string,
    id: string,
    onUpdate: (data: T | null) => void
  ) {
    const docRef = doc(db, path, id);
    return onSnapshot(docRef, (snap) => {
      onUpdate(snap.exists() ? ({ id: snap.id, ...snap.data() } as T) : null);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `${path}/${id}`);
    });
  },
};
