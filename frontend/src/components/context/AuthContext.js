import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import {
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    GoogleAuthProvider,
    signInWithPopup,
    deleteUser // <-- Added this for error handling
} from 'firebase/auth';
import { auth } from '../../firebase'; 
import api from '../../utils/api'; 

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isSigningUp, setIsSigningUp] = useState(false); 

    // This function handles the initial auth check and listens for changes
    const checkAuthStatus = useCallback(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            console.log(`[AUTH_STATE_SUPER_DEBUG] onAuthStateChanged START. isSigningUp: ${isSigningUp}, firebaseUser: ${firebaseUser ? firebaseUser.email : 'null'}`);

            if (isSigningUp) {
                console.log('[AUTH_STATE_SUPER_DEBUG] Skipping onAuthStateChanged due to active signup. Signup function will set user.');
                return;
            }

            let currentUserData = null;
            if (firebaseUser) {
                try {
                    const idToken = await firebaseUser.getIdToken();
                    const response = await api.post('/auth/firebase-login', { idToken });
                    if (response.data.user) {
                        localStorage.setItem('token', response.data.token);
                        currentUserData = response.data.user;
                        // --- CHANGED LOG: Stringify to see full object content ---
                        console.log('[AUTH_STATE_SUPER_DEBUG] User data from backend:', JSON.stringify(currentUserData, null, 2));
                    }
                } catch (error) {
                    console.error("[AUTH_STATE_SUPER_DEBUG] Error verifying Firebase token with backend:", error.response?.data || error.message);
                    await signOut(auth); 
                }
            }
            
            if (!currentUserData) {
                localStorage.removeItem('token');
            }

            setUser(currentUserData);
            setLoading(false);
            console.log('[AUTH_STATE_SUPER_DEBUG] onAuthStateChanged END.');
        });
        return unsubscribe;
    }, [isSigningUp]);

    useEffect(() => {
        const unsubscribe = checkAuthStatus();
        return () => {
            console.log('[AUTH_STATE_SUPER_DEBUG] Cleaning up onAuthStateChanged listener.');
            unsubscribe();
        };
    }, [checkAuthStatus]);

    const login = async (email, password) => {
        setLoading(true);
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password); 
            const idToken = await userCredential.user.getIdToken();
            const response = await api.post('/auth/firebase-login', { idToken });
            const { token, user: mongooseUser } = response.data;
            localStorage.setItem('token', token);
            setUser(mongooseUser);
            // --- CHANGED LOG: Stringify to see full object content ---
            console.log('[AuthContext] User data from backend after login:', JSON.stringify(mongooseUser, null, 2));
            return mongooseUser;
        } catch (error) {
            console.error('Firebase Email/Password Login failed:', error.message);
            setUser(null);
            localStorage.removeItem('token');
            throw error;
        } finally {
            setLoading(false);
        }
    };

    // ✅ This is the corrected signup function
    const signup = async (email, password, companyName, contactPersonName) => {
        setLoading(true);
        setIsSigningUp(true);
        try {
            // STEP 1: Create the user in Firebase FIRST to get the UID.
            console.log('[AuthContext] Step 1: Creating user in Firebase Authentication...');
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const firebaseUser = userCredential.user;
            const firebaseUid = firebaseUser.uid; // <-- The crucial piece of data

            // STEP 2: Now call the backend with the UID.
            console.log('[AuthContext] Step 2: Calling backend with new Firebase UID...');
            const response = await api.post('/auth/register-with-firebase', {
                firebaseUid, // <-- Now we can send it
                email,
                companyName,
                contactPersonName
            });

            // STEP 3: Handle the successful response from our backend.
            const { token, user: mongooseUser } = response.data;
            localStorage.setItem('token', token);
            setUser(mongooseUser);
            console.log('[AuthContext] Signup successful. User state set.');
            // --- CHANGED LOG: Stringify to see full object content ---
            console.log('[AuthContext] User data from backend after signup:', JSON.stringify(mongooseUser, null, 2));
            
            return mongooseUser;

        } catch (error) {
            console.error("Signup process failed:", error.response ? error.response.data : error.message);
            
            // This is crucial: If the backend fails, delete the user we just created in Firebase.
            const currentUser = auth.currentUser;
            if (currentUser && currentUser.email === email) {
                console.log("[AuthContext] Rolling back Firebase user due to backend failure...");
                await deleteUser(currentUser);
            }
            
            setUser(null);
            localStorage.removeItem('token');
            throw error; // Re-throw error so the UI component can show an error message.
        } finally {
            setIsSigningUp(false);
            setLoading(false);
        }
    };

    const googleLogin = async () => {
        setLoading(true);
        try {
            const provider = new GoogleAuthProvider();
            const userCredential = await signInWithPopup(auth, provider);
            const idToken = await userCredential.user.getIdToken();
            const response = await api.post('/auth/firebase-login', { idToken });
            const { token, user: mongooseUser } = response.data;
            localStorage.setItem('token', token);
            setUser(mongooseUser);
            // --- CHANGED LOG: Stringify to see full object content ---
            console.log('[AuthContext] User data from backend after Google login:', JSON.stringify(mongooseUser, null, 2));
            return mongooseUser;
        } catch (error) {
            console.error('Google login error (AuthContext):', error);
            setUser(null);
            localStorage.removeItem('token');
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const logout = useCallback(async () => {
        try {
            await signOut(auth);
            localStorage.removeItem('token');
            setUser(null);
        } catch (error) {
            console.error('Error during Firebase logout:', error);
            localStorage.removeItem('token'); 
            setUser(null);
        } finally {
            setLoading(false);
        }
    }, []);

    const value = {
        user,
        loading,
        login,
        signup,
        logout,
        googleLogin,
    };

    return (
        <AuthContext.Provider value={value}>
            {/* Only render children when loading is false. */}
            {/* This ensures the initial "Loading staff profile..." in StaffDashboard */}
            {/* has a chance to evaluate the full user object, including `user.staff`. */}
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
