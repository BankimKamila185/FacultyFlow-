import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

const firebaseConfig = {
    apiKey: "AIzaSyB08-H8LJWKE7deSHmRCFSb6-XyxptFdZc",
    authDomain: "facultyflow-6c38f.firebaseapp.com",
    databaseURL: "https://facultyflow-6c38f-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "facultyflow-6c38f",
    storageBucket: "facultyflow-6c38f.firebasestorage.app",
    messagingSenderId: "489085687002",
    appId: "1:489085687002:web:4880f0650f413f5cdb81e3",
    measurementId: "G-XTK1RC92WT"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Analytics
export const analytics = getAnalytics(app);

// Initialize Firestore with named database
export const db = getFirestore(app, 'facultyflow');

// Initialize Firebase Auth
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Add essential Google Workspace scopes
// (Commented out temporarily to avoid Unverified App warning during dev)
// googleProvider.addScope('https://www.googleapis.com/auth/calendar');
// googleProvider.addScope('https://www.googleapis.com/auth/drive');
// googleProvider.addScope('https://www.googleapis.com/auth/gmail.send');
googleProvider.setCustomParameters({
    prompt: 'consent',
    access_type: 'offline'
});

// Initialize Firebase Cloud Messaging
export const messaging = getMessaging(app);

export { signInWithPopup, signOut };
