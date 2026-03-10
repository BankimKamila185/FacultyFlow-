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
    const [backendToken, setBackendToken] = useState(() => {
        const token = localStorage.getItem('token');
        return (token === 'undefined' || token === 'null') ? null : token;
    });
    const [devUser, setDevUser] = useState(() => {
        try {
            const user = localStorage.getItem('devUser');
            if (user === 'undefined' || user === 'null') return null;
            return user ? JSON.parse(user) : null;
        } catch {
            return null;
        }
    });

    const isLoggingIn = React.useRef(false);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            setCurrentUser(user);
            if (user && !backendToken && !isLoggingIn.current) {
                try {
                    isLoggingIn.current = true;
                    const idToken = await user.getIdToken();
                    const res = await fetch(`${API_URL}/auth/login`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ idToken })
                    });
                    const data = await res.json();
                    if (data.success) {
                        setBackendToken(data.data.token);
                        localStorage.setItem('token', data.data.token);
                    }
                } catch (err) {
                    console.error("Silent backend login failed", err);
                } finally {
                    isLoggingIn.current = false;
                }
            }
            setLoading(false);
        });

        return unsubscribe;
    }, [backendToken]);

    const loginWithGoogle = async () => {
        if (isLoggingIn.current) return;
        try {
            isLoggingIn.current = true;
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
        } finally {
            isLoggingIn.current = false;
        }
    };

    const logout = async () => {
        try {
            await firebaseSignOut(auth);
        } catch (err) {
            console.error("Firebase signOut error", err);
        }
        setBackendToken(null);
        setDevUser(null);
        localStorage.removeItem('token');
        localStorage.removeItem('devUser');
    };

    const value = {
        currentUser,
        devUser,
        backendToken,
        setDevUser,
        setBackendToken,
        loginWithGoogle,
        logout,
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
}
