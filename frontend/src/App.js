// ServiceOS/frontend/src/App.js

import React, { useState, useLayoutEffect, createContext, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './components/context/AuthContext';
import { CurrencyProvider } from './components/context/CurrencyContext';

// --- ALL YOUR OTHER COMPONENT IMPORTS ---
// Assuming these paths are now correct from previous fixes
import LoginPage from './components/auth/LoginPage';
import SignUpPage from './components/auth/SignUpPage';
import ForgotPasswordPage from './components/auth/ForgotPasswordPage';
import CustomerPage from './components/customers/CustomerPage';
import Dashboard from './components/dashboard/Dashboard';
import LeadsView from './components/customers/LeadsView';
import Sidebar from './components/navigation/Sidebar';
import SettingsPage from './components/settings/SettingsPage';
import FormBuilderPage from './components/forms/FormBuilderPage';
import PublicFormPage from './components/forms/PublicFormPage';
import CustomerDashboard from './components/customerPortal/CustomerDashboard';
import StaffPage from './components/staff/StaffPage';
import StaffDashboard from './components/staffPortal/StaffDashboard';
import SchedulerView from './components/scheduler/SchedulerView';
import StockView from './components/stock/StockView';
import SpotCheckerPage from './components/dashboard/SpotCheckerPage'; // SpotCheckerPage is here

// NEW: Import EmailTemplatesView
import EmailTemplatesView from './components/email-templates/EmailTemplatesView'; // <--- ADD THIS LINE (Adjust path if placed elsewhere)

// REMOVED: Firebase Client SDK imports and config (as templates are now Mongoose-backed)
// import { initializeApp } from 'firebase/app';
// import { getFirestore } from 'firebase/firestore';
// import { getStorage } from 'firebase/storage';

import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { useLoadScript } from '@react-google-maps/api';
import './index.css';


// REMOVED: Firebase config and initialization (as templates are now Mongoose-backed)
// const firebaseConfig = { ... };
// const firebaseApp = initializeApp(firebaseConfig);
// const db = getFirestore(firebaseApp);
// const storage = getStorage(firebaseApp);


const googleMapsLibraries = ['places'];

export const MapsApiContext = createContext(null);

const MapsApiProvider = ({ children }) => {
    const { isLoaded, loadError } = useLoadScript({
        googleMapsApiKey: process.env.REACT_APP_MAPS_API_KEY,
        libraries: googleMapsLibraries,
    });

    return (
        <MapsApiContext.Provider value={{ isMapsLoaded: isLoaded, isMapsLoadError: loadError }}>
            {children}
        </MapsApiContext.Provider>
    );
};

export const useMapsApi = () => {
    const context = useContext(MapsApiContext);
    if (context === undefined) {
        throw new Error('useMapsApi must be used within a MapsApiProvider');
    }
    return context;
};

const getDefaultDashboardPath = (userRole) => {
    if (!userRole) return '/login';
    if (userRole === 'customer') return '/customer-portal';
    if (userRole === 'staff' || userRole === 'manager') return '/staff-dashboard';
    if (userRole === 'admin') return '/dashboard';
    return '/login';
};


const PrivateRoute = ({ children, roles }) => {
    const { user, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        return <div className="flex items-center justify-center h-screen text-gray-700">Loading...</div>;
    }

    if (!user) {
        console.log(`[PrivateRoute] No user found. Redirecting to /login from ${location.pathname}`);
        return <Navigate to="/login" replace />;
    }

    if (location.pathname.startsWith('/forms/')) {
        return children;
    }

    if (roles && !roles.includes(user.role)) {
        const dashboardPath = getDefaultDashboardPath(user.role);
        console.warn(`[PrivateRoute] Access Denied: User role '${user.role}' is not authorized for ${location.pathname}. Redirecting to ${dashboardPath}`);
        return <Navigate to={dashboardPath} replace />;
    }

    return children;
};


function AppContent() {
    const { user, logout, loading } = useAuth();
    const location = useLocation();
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    useLayoutEffect(() => {
        const updateSidebarState = () => {
            if (window.innerWidth < 768) {
                setIsSidebarOpen(false);
            } else {
                setIsSidebarOpen(true);
            }
        };

        if (user && !loading && !location.pathname.startsWith('/forms/') && (user.role === 'admin' || user.role === 'manager' || user.role === 'staff')) {
            updateSidebarState();
            window.addEventListener('resize', updateSidebarState);
        } else {
            setIsSidebarOpen(false);
        }

        return () => window.removeEventListener('resize', updateSidebarState);
    }, [user, loading, location.pathname]);


    const toggleSidebar = () => {
        setIsSidebarOpen(!isSidebarOpen);
    };

    const showSidebarLayout = user && (
        location.pathname !== '/login' &&
        location.pathname !== '/signup' &&
        location.pathname !== '/forgot-password' &&
        !location.pathname.startsWith('/forms/') &&
        (user.role === 'admin' || user.role === 'manager' || user.role === 'staff')
    );

    return (
        <div className="flex h-screen bg-gray-50">
            {showSidebarLayout && (
                <Sidebar
                    className="h-full"
                    isOpen={isSidebarOpen}
                    toggleSidebar={toggleSidebar}
                    user={user}
                    logout={logout}
                />
            )}

            <main className={`
                flex-1 overflow-auto
                transition-all duration-300 ease-in-out
                ${showSidebarLayout && isSidebarOpen ? 'ml-64' : (showSidebarLayout && !isSidebarOpen ? 'ml-20' : 'ml-0')}
                px-8 py-8
            `}>
                <MapsApiProvider>
                    <Routes>
                        {/* Public Auth Routes */}
                        <Route path="/login" element={<LoginPage />} />
                        <Route path="/signup" element={<SignUpPage />} />
                        <Route path="/forgot-password" element={<ForgotPasswordPage />} />

                        {/* Customer Portal Route */}
                        <Route path="/customer-portal" element={<PrivateRoute roles={['customer']}><CustomerDashboard /></PrivateRoute>} />

                        {/* Staff Dashboard Route */}
                        <Route path="/staff-dashboard" element={<PrivateRoute roles={['staff', 'manager']}><StaffDashboard /></PrivateRoute>} />

                        {/* CRM & Admin/Manager Main Application Routes */}
                        <Route path="/dashboard" element={<PrivateRoute roles={['admin', 'manager']}><Dashboard /></PrivateRoute>} />
                        <Route path="/customers" element={<PrivateRoute roles={['admin', 'manager']}><CustomerPage /></PrivateRoute>} />
                        <Route path="/leads" element={<PrivateRoute roles={['admin', 'manager', 'staff']}><LeadsView /></PrivateRoute>} />
                        <Route path="/staff" element={<PrivateRoute roles={['admin', 'manager']}><StaffPage /></PrivateRoute>} />
                        <Route path="/form-builder" element={<PrivateRoute roles={['admin']}><DndProvider backend={HTML5Backend}><FormBuilderPage /></DndProvider></PrivateRoute>} />
                        <Route path="/settings" element={<PrivateRoute roles={['admin']}><SettingsPage /></PrivateRoute>} />

                        {/* Scheduler Page Route - WRAP WITH DndProvider */}
                        <Route path="/scheduler" element={
                            <PrivateRoute roles={['admin', 'staff', 'manager']}>
                                <DndProvider backend={HTML5Backend}>
                                    <SchedulerView />
                                </DndProvider>
                            </PrivateRoute>
                        } />

                        {/* Stock Management Page Route */}
                        <Route path="/stock" element={<PrivateRoute roles={['admin', 'manager', 'staff']}><StockView /></PrivateRoute>} />

                        {/* Spot Checker Page Route */}
                        <Route path="/spot-checker" element={<PrivateRoute roles={['admin', 'manager', 'staff']}><SpotCheckerPage /></PrivateRoute>} />

                        {/* NEW: Email Templates Page Route */}
                        <Route path="/email-templates" element={
                            <PrivateRoute roles={['admin']}>
                                {/* No Firebase props needed now */}
                                <EmailTemplatesView />
                            </PrivateRoute>
                        } />

                        {/* Public Form Route (no PrivateRoute as it's public) */}
                        <Route path="/forms/:id" element={<PublicFormPage />} />

                        {/* Other Placeholder Pages (Adjust roles as needed) */}
                        <Route path="/jobs" element={<PrivateRoute roles={['admin', 'staff', 'manager']}><div className="p-8 bg-white rounded-xl shadow-lg w-full h-full">Job Management Page (Placeholder)</div></PrivateRoute>} />
                        <Route path="/invoices" element={<PrivateRoute roles={['admin', 'staff', 'manager']}><div className="p-8 bg-white rounded-xl shadow-lg w-full h-full">Invoices Page (Admin/Staff)</div></PrivateRoute>} />
                        <Route path="/quotes" element={<PrivateRoute roles={['admin', 'staff', 'manager']}><div className="p-8 bg-white rounded-xl shadow-lg w-full h-full">Quotes Page (Admin/Staff)</div></PrivateRoute>} />


                        {/* Default Route: Handles initial load and redirects based on auth status and role */}
                        <Route
                            path="/"
                            element={
                                loading ? (
                                    <div className="flex items-center justify-center h-screen text-gray-700">Loading app...</div>
                                ) : (
                                    user ? (
                                        <Navigate to={getDefaultDashboardPath(user.role)} replace />
                                    ) : (
                                        <Navigate to="/login" replace />
                                    )
                                )
                            }
                        />
                    </Routes>
                </MapsApiProvider>
            </main>
        </div>
    );
}

function App() {
    return (
        <Router>
            <AuthProvider>
                <CurrencyProvider>
                    <AppContent />
                </CurrencyProvider>
            </AuthProvider>
        </Router>
    );
}

export default App;