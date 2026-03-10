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
    const [backendToken, setBackendToken] = useState(null);
    const [devUser, setDevUser] = useState(null);

    const isLoggingIn = React.useRef(false);

    const fetchSession = async () => {
        try {
            const res = await fetch(`${API_URL}/auth/me`, { 
                credentials: 'include' 
            });
            if (res.ok) {
                const data = await res.json();
                if (data.success) {
                    setBackendToken(true); // Indication that we have a cookie session
                    setDevUser(data.data.user.devModeContext ? JSON.parse(data.data.user.devModeContext) : null);
                }
            }
        } catch (err) {
            console.error("Failed to fetch session", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSession();

        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            setCurrentUser(user);
            if (user && !backendToken && !isLoggingIn.current) {
                try {
                    isLoggingIn.current = true;
                    const idToken = await user.getIdToken();
                    const res = await fetch(`${API_URL}/auth/login`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ idToken }),
                        credentials: 'include'
                    });
                    const data = await res.json();
                    if (data.success) {
                        setBackendToken(true);
                        setDevUser(data.data.user.devModeContext ? JSON.parse(data.data.user.devModeContext) : null);
                    }
                } catch (err) {
                    console.error("Silent backend login failed", err);
                } finally {
                    isLoggingIn.current = false;
                }
            }
        });

        return unsubscribe;
    }, [backendToken]);

    const loginWithGoogle = async () => {
        if (isLoggingIn.current) return;
        try {
            isLoggingIn.current = true;
            const result = await signInWithPopup(auth, googleProvider);
            const idToken = await result.user.getIdToken();

            const credential = GoogleAuthProvider.credentialFromResult(result);
            const googleAccessToken = credential?.accessToken;
            const googleRefreshToken = result._tokenResponse?.refreshToken;

            const res = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idToken, googleAccessToken, googleRefreshToken }),
                credentials: 'include'
            });

            const data = await res.json();
            if (data.success) {
                setBackendToken(true);
                setDevUser(data.data.user.devModeContext ? JSON.parse(data.data.user.devModeContext) : null);
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

    const devLogin = async (email) => {
        try {
            const res = await fetch(`${API_URL}/auth/dev-login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
                credentials: 'include'
            });
            const data = await res.json();
            if (data.success) {
                setBackendToken(true);
                setDevUser(data.data.user.devModeContext ? JSON.parse(data.data.user.devModeContext) : null);
                return data.data.user;
            } else {
                throw new Error(data.error);
            }
        } catch (err) {
            console.error("Dev login failed", err);
            throw err;
        }
    };

    const updateDevUser = async (selectedUser) => {
        setDevUser(selectedUser);
        try {
            await fetch(`${API_URL}/auth/dev-context`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ devUser: selectedUser }),
                credentials: 'include'
            });
        } catch (err) {
            console.error("Failed to sync dev context to DB", err);
        }
    };

    const logout = async () => {
        try {
            await firebaseSignOut(auth);
            await fetch(`${API_URL}/auth/logout`, { method: 'POST', credentials: 'include' });
        } catch (err) {
            console.error("Logout error", err);
        }
        setBackendToken(null);
        setDevUser(null);
    };

    const value = {
        currentUser,
        devUser,
        backendToken,
        setDevUser: updateDevUser,
        loginWithGoogle,
        logout,
        devLogin,
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
}
