import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

const firebaseConfig = {
    apiKey: "AIzaSyD0Dl7a2z08DdvYF_ws5h4LKCkiNxYFyAI",
    authDomain: "facultyflow-78a2a.firebaseapp.com",
    projectId: "facultyflow-78a2a",
    storageBucket: "facultyflow-78a2a.firebasestorage.app",
    messagingSenderId: "859960924999",
    appId: "1:859960924999:web:bbb989cce4b4e9ec2a4a62",
    measurementId: "G-9W59JHJQHM"
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
