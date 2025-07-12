import React, { useState, useLayoutEffect, createContext, useContext, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './components/context/AuthContext';
import { CurrencyProvider } from './components/context/CurrencyContext';

// Stripe Imports (needed for PaymentModal)
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';

// Import i18n configuration
import './i18n';

// --- COMPONENT IMPORTS ---
import LoginPage from './components/auth/LoginPage';
import SignUpPage from './components/auth/SignUpPage';
import ForgotPasswordPage from './components/auth/ForgotPasswordPage';
import CustomerPage from './components/customers/CustomerPage';
import Dashboard from './components/dashboard/Dashboard';
import LeadsView from './components/customers/LeadsView';
import Sidebar from './components/navigation/Sidebar';
import SettingsPage from './components/settings/SettingsPage';
import EmailTemplatesView from './components/email-templates/EmailTemplatesView';
import FormBuilderPage from './components/forms/FormBuilderPage';
import PublicFormPage from './components/forms/PublicFormPage';
import CustomerDashboard from './components/customerPortal/CustomerDashboard';
import QuoteRequestPage from './components/customerPortal/QuoteRequestPage';
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
import CommissionReportPage from './components/reports/CommissionReportPage';

// NEW IMPORT for MyPayslipsPage
import MyPayslipsPage from './components/staffPortal/MyPayslipsPage';

// --- Customer Portal Specific Imports ---
import CustomerInvoicesPage from './components/customerPortal/CustomerInvoicesPage';
import CustomerAppointmentsPage from './components/customerPortal/CustomerAppointmentsPage';
import CustomerEmergencyPage from './components/customerPortal/CustomerEmergencyPage';

// --- Job-related Imports ---
import JobsPage from './components/jobs/JobsPage'; // Existing Job List Page
import JobDetailsPage from './components/jobs/JobDetailsPage'; // <--- ADDED THIS IMPORT: Your new Job Details Page

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
        case 'staff': return '/staff-dashboard';
        case 'manager': return '/dashboard';
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
    const { user, loading, logout } = useAuth();
    const location = useLocation();
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    const shouldRenderSidebar = user && !loading && ['admin', 'manager'].includes(user.role) &&
                                 !['/login', '/signup', '/forgot-password', '/quote-request'].includes(location.pathname) &&
                                 !location.pathname.startsWith('/forms/');

    useLayoutEffect(() => {
        const updateSidebarState = () => setIsSidebarOpen(window.innerWidth >= 768);
        if (shouldRenderSidebar) {
            updateSidebarState();
            window.addEventListener('resize', updateSidebarState);
        } else {
            setIsSidebarOpen(false);
        }
        return () => window.removeEventListener('resize', updateSidebarState);
    }, [shouldRenderSidebar]);

    const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

    let mainContentMarginClass = 'ml-0';
    if (shouldRenderSidebar) {
        mainContentMarginClass = isSidebarOpen ? 'ml-64' : 'ml-20';
    }

    return (
        <div className="flex h-screen bg-gray-50">
            {shouldRenderSidebar && (
                <Sidebar isOpen={isSidebarOpen} toggleSidebar={toggleSidebar} user={user} logout={logout} />
            )}
            <main className={`flex-1 overflow-auto transition-all duration-300 ease-in-out ${mainContentMarginClass}`}>
                <MapsApiProvider>
                    <Routes>
                        {/* Public Routes */}
                        <Route path="/login" element={<LoginPage />} />
                        <Route path="/signup" element={<SignUpPage />} />
                        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                        <Route path="/forms/:id" element={<PublicFormPage />} />
                        <Route path="/quote-request" element={<QuoteRequestPage />} />

                        {/* Customer Portal Routes (No Sidebar) */}
                        <Route path="/customer-portal" element={<PrivateRoute roles={['customer']}><CustomerDashboard /></PrivateRoute>} />
                        <Route path="/customer-portal/invoices" element={<PrivateRoute roles={['customer']}><CustomerInvoicesPage /></PrivateRoute>} />
                        <Route path="/customer-portal/appointments" element={<PrivateRoute roles={['customer']}><CustomerAppointmentsPage /></PrivateRoute>} />
                        <Route path="/customer-portal/emergency" element={<PrivateRoute roles={['customer']}><CustomerEmergencyPage /></PrivateRoute>} />

                        {/* Staff Portal Routes (No Sidebar) */}
                        <Route path="/staff-dashboard" element={<PrivateRoute roles={['staff']}><StaffDashboard /></PrivateRoute>} />
                        <Route path="/staff-schedule" element={<PrivateRoute roles={['staff']}><StaffSchedulePage /></PrivateRoute>} />
                        <Route path="/my-payslips" element={<PrivateRoute roles={['staff']}><MyPayslipsPage /></PrivateRoute>} />

                        {/* Admin/Manager Routes (WITH Sidebar) */}
                        <Route path="/dashboard" element={<PrivateRoute roles={['admin', 'manager']}><Dashboard /></PrivateRoute>} />
                        <Route path="/customers" element={<PrivateRoute roles={['admin', 'manager']}><CustomerPage /></PrivateRoute>} />
                        <Route path="/leads" element={<PrivateRoute roles={['admin', 'manager', 'staff']}><LeadsView /></PrivateRoute>} />
                        <Route path="/staff" element={<PrivateRoute roles={['admin', 'manager']}><StaffPage /></PrivateRoute>} />
                        <Route path="/form-builder" element={<PrivateRoute roles={['admin']}><DndProvider backend={HTML5Backend}><FormBuilderPage /></DndProvider></PrivateRoute>} />
                        <Route path="/settings" element={<PrivateRoute roles={['admin']}><SettingsPage /></PrivateRoute>} />
                        <Route path="/scheduler" element={<PrivateRoute roles={['admin', 'manager', 'staff']}><DndProvider backend={HTML5Backend}><SchedulerView /></DndProvider></PrivateRoute>} />
                        <Route path="/stock" element={<PrivateRoute roles={['admin', 'manager', 'staff']}><StockView /></PrivateRoute>} />
                        <Route path="/route-planner" element={<PrivateRoute roles={['admin', 'manager']}><RoutePlannerView /></PrivateRoute>} />
                        <Route path="/staff-absence" element={<PrivateRoute roles={['admin', 'manager']}><StaffAbsencePage /></PrivateRoute>} />
                        <Route path="/email-templates" element={<PrivateRoute roles={['admin']}><EmailTemplatesView /></PrivateRoute>} />
                        <Route path="/invoices" element={<PrivateRoute roles={['admin', 'manager']}><InvoicePage /></PrivateRoute>} />
                        <Route path="/invoices/:invoiceId" element={<PrivateRoute roles={['admin', 'manager', 'staff']}><InvoiceDetails /></PrivateRoute>} />
                        <Route path="/payroll" element={<PrivateRoute roles={['admin', 'manager']}><PayrollPage /></PrivateRoute>} />
                        <Route path="/commission-report" element={<PrivateRoute roles={['admin', 'manager']}><CommissionReportPage /></PrivateRoute>} />
                        <Route path="/spot-checker" element={<PrivateRoute roles={['admin', 'manager', 'staff']}><SpotCheckerPage /></PrivateRoute>} />

                        {/* Jobs Page and Job Details Page */}
                        <Route path="/jobs" element={<PrivateRoute roles={['admin', 'manager', 'staff']}><JobsPage /></PrivateRoute>} />
                        {/* NEW ROUTE FOR JOB DETAILS PAGE */}
                        <Route path="/jobs/:jobId" element={<PrivateRoute roles={['admin', 'manager', 'staff', 'customer']}><JobDetailsPage /></PrivateRoute>} /> {/* <--- ADDED THIS ROUTE */}

                        {/* Default Route */}
                        <Route path="/" element={loading ? <div>Loading...</div> : <Navigate to={user ? getDefaultDashboardPath(user.role) : "/login"} replace />} />
                    </Routes>
                </MapsApiProvider>
            </main>
        </div>
    );
}

function App() {
    // Load your Stripe Publishable Key securely.
    // Ensure REACT_APP_STRIPE_PUBLISHABLE_KEY is defined in your frontend/.env file.
    const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY);

    return (
        <Router>
            <Suspense fallback={<div>Loading translations...</div>}>
                <AuthProvider>
                    <CurrencyProvider>
                        <MapsApiProvider>
                            <DndProvider backend={HTML5Backend}>
                                {/* Wrap your AppContent with Stripe's Elements provider */}
                                <Elements stripe={stripePromise}>
                                    <AppContent />
                                </Elements>
                            </DndProvider>
                        </MapsApiProvider>
                    </CurrencyProvider>
                </AuthProvider>
            </Suspense>
        </Router>
    );
}

export default App;