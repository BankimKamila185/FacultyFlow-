import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, googleProvider, signInWithPopup, signOut as firebaseSignOut } from '../config/firebase';
import { GoogleAuthProvider } from 'firebase/auth';
import { onAuthStateChanged } from 'firebase/auth';

import { API_URL } from '../config';
const AuthContext = createContext(null);

export function useAuth() {
    return useContext(AuthContext);
}

export function AuthProvider({ children }) {
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [backendToken, setBackendToken] = useState(localStorage.getItem('token'));

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            setCurrentUser(user);
            setLoading(false);
        });

        return unsubscribe;
    }, []);

    const loginWithGoogle = async () => {
        try {
            const result = await signInWithPopup(auth, googleProvider);
            const idToken = await result.user.getIdToken();

            // Extract the Google Access Token
            const credential = GoogleAuthProvider.credentialFromResult(result);
            const googleAccessToken = credential?.accessToken;
            const googleRefreshToken = result._tokenResponse?.refreshToken;

            // Send the tokens to the backend
            const res = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ idToken, googleAccessToken, googleRefreshToken }),
            });

            const data = await res.json();
            if (data.success) {
                setBackendToken(data.data.token);
                localStorage.setItem('token', data.data.token);
            } else {
                throw new Error(data.error);
            }
        } catch (error) {
            console.error("Error during Google Login:", error);
            throw error;
        }
    };

    const logout = async () => {
        await firebaseSignOut(auth);
        setBackendToken(null);
        localStorage.removeItem('token');
    };

    const value = {
        currentUser,
        backendToken,
        loginWithGoogle,
        logout,
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
}
