// ServiceOS/frontend/src/App.js

import React, { useState, useLayoutEffect, createContext, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './components/context/AuthContext';
import { CurrencyProvider } from './components/context/CurrencyContext';

// --- COMPONENT IMPORTS ---
import LoginPage from './components/auth/LoginPage';
import SignUpPage from './components/auth/SignUpPage';
import ForgotPasswordPage from './components/auth/ForgotPasswordPage';
import CustomerPage from './components/customers/CustomerPage';
import Dashboard from './components/dashboard/Dashboard';
import LeadsView from './components/customers/LeadsView'; // Still import LeadsView for its own route
import Sidebar from './components/navigation/Sidebar';
import SettingsPage from './components/settings/SettingsPage';
import EmailTemplatesView from './components/email-templates/EmailTemplatesView';
import FormBuilderPage from './components/forms/FormBuilderPage';
import PublicFormPage from './components/forms/PublicFormPage'; // For embedded forms by ID
import CustomerDashboard from './components/customerPortal/CustomerDashboard';
import QuoteRequestPage from './components/customerPortal/QuoteRequestPage'; // For the public quote request form
import StaffPage from './components/staff/StaffPage';
import StaffDashboard from './components/staffPortal/StaffDashboard';
import SchedulerView from './components/scheduler/SchedulerView';
import StockView from './components/stock/StockView';
import SpotCheckerPage from './components/dashboard/SpotCheckerPage';
import RoutePlannerView from './components/route-planner/RoutePlannerView';
import StaffAbsencePage from './components/staff/StaffAbsencePage';
import InvoicePage from './components/invoices/InvoicePage';
import InvoiceDetails from './components/invoices/InvoiceDetails';
import StaffSchedulePage from './components/staffPortal/StaffSchedulePage';
import PayrollPage from './components/payroll/PayrollPage';

import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { useLoadScript } from '@react-google-maps/api';
import './index.css';


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
    if (!context) {
        throw new Error('useMapsApi must be used within a MapsApiProvider');
    }
    return context;
};

const getDefaultDashboardPath = (userRole) => {
    if (!userRole) return '/login';
    switch (userRole) {
        case 'customer': return '/customer-portal';
        case 'staff':
        case 'manager': return '/staff-dashboard';
        case 'admin': return '/dashboard';
        default: return '/login';
    }
};

const PrivateRoute = ({ children, roles }) => {
    const { user, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        return <div className="flex items-center justify-center h-screen">Loading...</div>;
    }

    if (!user) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (roles && !roles.includes(user.role)) {
        const dashboardPath = getDefaultDashboardPath(user.role);
        return <Navigate to={dashboardPath} replace />;
    }

    return children;
};

function AppContent() {
    const { user, logout, loading } = useAuth();
    const location = useLocation();
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    useLayoutEffect(() => {
        const updateSidebarState = () => setIsSidebarOpen(window.innerWidth >= 768);
        const noSidebarRoutes = ['/login', '/signup', '/forgot-password', '/quote-request']; 
        const canShowSidebar = user && !loading && !noSidebarRoutes.includes(location.pathname) && !location.pathname.startsWith('/forms/');

        if (canShowSidebar && ['admin', 'manager', 'staff'].includes(user.role)) {
            updateSidebarState();
            window.addEventListener('resize', updateSidebarState);
        } else {
            setIsSidebarOpen(false);
        }

        return () => window.removeEventListener('resize', updateSidebarState);
    }, [user, loading, location.pathname]);

    const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
    const showSidebarLayout = user && !['/login', '/signup', '/forgot-password', '/quote-request'].includes(location.pathname) && !location.pathname.startsWith('/forms/') && ['admin', 'manager', 'staff'].includes(user.role);

    return (
        <div className="flex h-screen bg-gray-50">
            {showSidebarLayout && (
                <Sidebar isOpen={isSidebarOpen} toggleSidebar={toggleSidebar} user={user} logout={logout} />
            )}
            <main className={`flex-1 overflow-auto transition-all duration-300 ease-in-out ${showSidebarLayout && isSidebarOpen ? 'ml-64' : (showSidebarLayout ? 'ml-20' : 'ml-0')}`}>
                <MapsApiProvider>
                    <Routes>
                        {/* Public Routes */}
                        <Route path="/login" element={<LoginPage />} />
                        <Route path="/signup" element={<SignUpPage />} />
                        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                        <Route path="/forms/:id" element={<PublicFormPage />} /> {/* For embedded forms by ID */}
                        <Route path="/quote-request" element={<QuoteRequestPage />} /> {/* For the public quote request form */}

                        {/* Private Routes */}
                        <Route path="/customer-portal" element={<PrivateRoute roles={['customer']}><CustomerDashboard /></PrivateRoute>} />
                        {/* Optional: Add sub-routes for customer portal here (e.g., /customer-portal/invoices) */}
                        {/* <Route path="/customer-portal/invoices" element={<PrivateRoute roles={['customer']}><CustomerInvoicesPage /></PrivateRoute>} /> */}
                        {/* <Route path="/customer-portal/appointments" element={<PrivateRoute roles={['customer']}><CustomerAppointmentsPage /></PrivateRoute>} /> */}
                        {/* <Route path="/customer-portal/emergency" element={<PrivateRoute roles={['customer']}><CustomerEmergencyPage /></PrivateRoute>} /> */}

                        <Route path="/staff-dashboard" element={<PrivateRoute roles={['staff', 'manager']}><StaffDashboard /></PrivateRoute>} />
                        <Route path="/staff-schedule" element={<PrivateRoute roles={['staff', 'manager', 'admin']}><StaffSchedulePage /></PrivateRoute>} />
                        <Route path="/dashboard" element={<PrivateRoute roles={['admin', 'manager']}><Dashboard /></PrivateRoute>} />
                        <Route path="/customers" element={<PrivateRoute roles={['admin', 'manager']}><CustomerPage /></PrivateRoute>} />
                        <Route path="/leads" element={<PrivateRoute roles={['admin', 'manager', 'staff']}><LeadsView /></PrivateRoute>} />
                        <Route path="/staff" element={<PrivateRoute roles={['admin', 'manager']}><StaffPage /></PrivateRoute>} />
                        <Route path="/form-builder" element={<PrivateRoute roles={['admin']}><DndProvider backend={HTML5Backend}><FormBuilderPage /></DndProvider></PrivateRoute>} />
                        <Route path="/settings" element={<PrivateRoute roles={['admin']}><SettingsPage /></PrivateRoute>} />
                        <Route path="/scheduler" element={<PrivateRoute roles={['admin', 'staff', 'manager']}><DndProvider backend={HTML5Backend}><SchedulerView /></DndProvider></PrivateRoute>} />
                        <Route path="/stock" element={<PrivateRoute roles={['admin', 'manager', 'staff']}><StockView /></PrivateRoute>} />
                        <Route path="/spot-checker" element={<PrivateRoute roles={['admin', 'staff', 'manager']}><SpotCheckerPage /></PrivateRoute>} />
                        <Route path="/route-planner" element={<PrivateRoute roles={['admin', 'manager']}><RoutePlannerView /></PrivateRoute>} />
                        <Route path="/staff-absence" element={<PrivateRoute roles={['admin', 'manager']}><StaffAbsencePage /></PrivateRoute>} />
                        <Route path="/email-templates" element={<PrivateRoute roles={['admin']}><EmailTemplatesView /></PrivateRoute>} />

                        {/* --- INVOICE ROUTES --- */}
                        <Route path="/invoices" element={<PrivateRoute roles={['admin', 'staff', 'manager']}><InvoicePage /></PrivateRoute>} />
                        <Route path="/invoices/:invoiceId" element={<PrivateRoute roles={['admin', 'manager', 'staff']}><InvoiceDetails /></PrivateRoute>} />
                        
                        {/* Payroll Page Route */}
                        <Route path="/payroll" element={<PrivateRoute roles={['admin', 'manager']}><PayrollPage /></PrivateRoute>} />
                        
                        <Route path="/jobs" element={<PrivateRoute roles={['admin', 'staff', 'manager']}><div className="p-8">Job Management Page</div></PrivateRoute>} />
                        {/* Reverted /quotes to its original placeholder */}
                        <Route path="/quotes" element={<PrivateRoute roles={['admin', 'staff', 'manager']}><div className="p-8">Quotes Page</div></PrivateRoute>} /> 
                        <Route path="/commission-report" element={<PrivateRoute roles={['admin', 'manager']}><div className="p-8">Commission Report Page</div></PrivateRoute>} />

                        {/* Default Route */}
                        <Route path="/" element={loading ? <div>Loading...</div> : <Navigate to={user ? getDefaultDashboardPath(user.role) : "/login"} replace />} />
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
                    <MapsApiProvider>
                        <AppContent />
                    </MapsApiProvider>
                </CurrencyProvider>
            </AuthProvider>
        </Router>
    );
}

export default App;