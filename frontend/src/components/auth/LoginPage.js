// src/components/auth/LoginPage.js

import React, { useState } from 'react'; // CORRECTED LINE: changed '=>' to 'from'
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FcGoogle } from 'react-icons/fc';

const LoginPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { login, googleLogin } = useAuth();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const loggedInUser = await login(email, password);
            if (loggedInUser) {
                navigate('/dashboard');
            } else {
                setError('Login failed: No user data returned.');
            }
        } catch (err) {
            console.error('Login error:', err);
            let errorMessage = 'Login failed. Please check your credentials.';
            if (err.code) {
                switch (err.code) {
                    case 'auth/user-not-found':
                    case 'auth/wrong-password':
                        errorMessage = 'Invalid email or password.';
                        break;
                    case 'auth/invalid-email':
                        errorMessage = 'The email address is not valid.';
                        break;
                    case 'auth/user-disabled':
                        errorMessage = 'This account has been disabled.';
                        break;
                    case 'auth/network-request-failed':
                        errorMessage = 'Network error. Please check your internet connection.';
                        break;
                    default:
                        errorMessage = `Firebase Error: ${err.message}`;
                        break;
                }
            } else if (err.response && err.response.data && err.response.data.message) {
                errorMessage = err.response.data.message;
            }
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        setLoading(true);
        setError(null);
        try {
            const loggedInUser = await googleLogin();
            if (loggedInUser) {
                navigate('/dashboard');
            } else {
                setError('Google login failed: No user data returned.');
            }
        } catch (err) {
            console.error('Google login error:', err);
            let errorMessage = 'Google login failed. Please try again.';
            if (err.code) {
                switch (err.code) {
                    case 'auth/popup-closed-by-user':
                        errorMessage = 'Login cancelled by user.';
                        break;
                    case 'auth/cancelled-popup-request':
                        errorMessage = 'Multiple login requests. Please try again.';
                        break;
                    case 'auth/auth-domain-config-required':
                        errorMessage = 'Firebase Auth domain not configured correctly.';
                        break;
                    case 'auth/operation-not-allowed':
                        errorMessage = 'Google Sign-In is not enabled in Firebase project settings.';
                        break;
                    default:
                        errorMessage = `Firebase Error: ${err.message}`;
                        break;
                }
            } else if (err.response && err.response.data && err.response.data.message) {
                errorMessage = err.response.data.message;
            }
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600 p-4">
            <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-md transform transition-all duration-300 hover:scale-105">
                <h2 className="text-3xl font-extrabold text-center text-gray-900 mb-8">Welcome to ServiceOS</h2>

                {error && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm" role="alert">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                            Email address
                        </label>
                        <input
                            type="email"
                            id="email"
                            className="appearance-none relative block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition duration-150 ease-in-out"
                            placeholder="you@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>
                    <div>
                        <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                            Password
                        </label>
                        <input
                            type="password"
                            id="password"
                            className="appearance-none relative block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition duration-150 ease-in-out"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>

                    {/* Forgot Password Link - ADDED HERE */}
                    <div className="text-sm text-right">
                        <Link to="/forgot-password" className="font-medium text-blue-600 hover:text-blue-500 transition duration-150 ease-in-out">
                            Forgot password?
                        </Link>
                    </div>

                    <button
                        type="submit"
                        className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-semibold rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-150 ease-in-out disabled:opacity-60 disabled:cursor-not-allowed"
                        disabled={loading}
                    >
                        {loading ? 'Logging in...' : 'Sign in'}
                    </button>
                </form>

                <div className="relative my-8">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-300"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                        <span className="px-3 bg-white text-gray-500">Or continue with</span>
                    </div>
                </div>

                {/* Google Login Button */}
                <button
                    onClick={handleGoogleLogin}
                    className="group relative w-full flex justify-center items-center py-3 px-4 border border-gray-300 text-sm font-semibold rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition duration-150 ease-in-out disabled:opacity-60 disabled:cursor-not-allowed"
                    disabled={loading}
                >
                    <FcGoogle className="h-5 w-5 mr-3" />
                    {loading ? 'Signing in with Google...' : 'Sign in with Google'}
                </button>

                <p className="mt-8 text-center text-sm text-gray-600">
                    Don't have an account? {' '}
                    <Link to="/signup" className="font-medium text-blue-600 hover:text-blue-500 transition duration-150 ease-in-out">
                        Sign Up
                    </Link>
                </p>
            </div>
        </div>
    );
};

export default LoginPage;

    
