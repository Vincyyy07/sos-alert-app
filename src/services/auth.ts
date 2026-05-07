import { 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  User
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { dbService } from './db';

const googleProvider = new GoogleAuthProvider();

async function ensureUserProfile(user: User) {
  const profile = await dbService.getDocument('users', user.uid);
  if (!profile) {
    await dbService.createDocument('users', {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      phoneNumber: user.phoneNumber,
    }, user.uid);
  }
}

export const authService = {
  async signInWithGoogle() {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      await ensureUserProfile(result.user);
      return result.user;
    } catch (error) {
      console.error('Google Auth Error:', error);
      throw error;
    }
  },

  async signUpWithEmail(email: string, password: string, displayName: string) {
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(result.user, { displayName });
      await ensureUserProfile(result.user);
      return result.user;
    } catch (error) {
      console.error('Sign Up Error:', error);
      throw error;
    }
  },

  async signInWithEmail(email: string, password: string) {
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      return result.user;
    } catch (error) {
      console.error('Sign In Error:', error);
      throw error;
    }
  },

  async logout() {
    await signOut(auth);
  },

  onAuthChange(callback: (user: User | null) => void) {
    return onAuthStateChanged(auth, callback);
  }
};
