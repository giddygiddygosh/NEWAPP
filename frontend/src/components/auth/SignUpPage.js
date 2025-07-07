import React, { useState } from 'react';
import { useAuth } from '../../components/context/AuthContext'; // Adjust path as needed
import { useNavigate, Link } from 'react-router-dom'; // Import useNavigate AND Link
import ModernInput from '../common/ModernInput'; // Assuming you have this component

const SignUpPage = () => {
    const [companyName, setCompanyName] = useState('');
    const [contactPersonName, setContactPersonName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);

    const { signup } = useAuth();
    const navigate = useNavigate(); // Initialize useNavigate hook

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            // Call the signup function from AuthContext
            const userData = await signup(email, password, companyName, contactPersonName);
            console.log('[SignupPage] Signup successful. New user data:', userData);
            
            // --- NEW: Direct Redirection after successful signup ---
            if (userData) {
                // Determine the correct dashboard based on the user role received from signup response
                let dashboardPath = '/dashboard'; // Default for admin
                if (userData.role === 'customer') {
                    dashboardPath = '/customer-portal';
                } else if (userData.role === 'staff' || userData.role === 'manager') {
                    dashboardPath = '/staff-dashboard';
                }
                console.log(`[SignupPage] Redirecting to: ${dashboardPath}`);
                navigate(dashboardPath, { replace: true }); // Redirect to dashboard
            } else {
                // This case should ideally not be hit if signup was successful
                setError('Signup successful, but user data not returned. Please try logging in.');
            }
            // --- END NEW ---

        } catch (err) {
            console.error('Signup failed:', err);
            setError(err.message || 'Signup failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 p-4">
            <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md">
                <h2 className="text-3xl font-bold text-gray-900 text-center mb-6">Sign Up for ServiceOS</h2>
                {error && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
                        {error}
                    </div>
                )}
                <form onSubmit={handleSubmit} className="space-y-4">
                    <ModernInput
                        label="Company Name"
                        type="text"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="Your Company Name"
                        required
                        disabled={loading}
                    />
                    <ModernInput
                        label="Contact Person Name"
                        type="text"
                        value={contactPersonName}
                        onChange={(e) => setContactPersonName(e.target.value)}
                        placeholder="Your Name"
                        required
                        disabled={loading}
                    />
                    <ModernInput
                        label="Email (Will Be Admin Account)"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        required
                        disabled={loading}
                    />
                    <ModernInput
                        label="Password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="********"
                        required
                        disabled={loading}
                    />
                    <button
                        type="submit"
                        className="w-full bg-green-600 text-white py-3 rounded-md font-semibold hover:bg-green-700 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={loading}
                    >
                        {loading ? 'Signing Up...' : 'Sign Up'}
                    </button>
                </form>
                <div className="mt-6 text-center">
                    <p className="text-gray-600">Already have an account? <Link to="/login" className="text-blue-600 hover:underline">Login</Link></p>
                </div>
            </div>
        </div>
    );
};

export default SignUpPage;

