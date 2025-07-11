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
import LeadsView from './components/customers/LeadsView';
import Sidebar from './components/navigation/Sidebar'; // Keep Sidebar import
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
        case 'staff': return '/staff-dashboard'; // Staff doesn't use the main admin dashboard
        case 'manager': return '/dashboard'; // Manager goes to main dashboard (with sidebar)
        case 'admin': return '/dashboard'; // Admin goes to main dashboard (with sidebar)
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
    const { user, loading } = useAuth(); // Removed logout as it's passed directly to Sidebar/Logout buttons
    const location = useLocation();
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    // Determine if the sidebar should be shown at all
    // It should only show for roles that *have* a sidebar (admin, manager)
    const shouldRenderSidebar = user && !loading && ['admin', 'manager'].includes(user.role) &&
                                !['/login', '/signup', '/forgot-password', '/quote-request'].includes(location.pathname) &&
                                !location.pathname.startsWith('/forms/'); // Public forms don't need sidebar

    // This effect now ONLY manages the open/close state if a sidebar is being rendered
    useLayoutEffect(() => {
        const updateSidebarState = () => setIsSidebarOpen(window.innerWidth >= 768);
        if (shouldRenderSidebar) {
            updateSidebarState();
            window.addEventListener('resize', updateSidebarState);
        } else {
            // Ensure it's always closed/not occupying space if not rendered
            setIsSidebarOpen(false);
        }
        return () => window.removeEventListener('resize', updateSidebarState);
    }, [shouldRenderSidebar]); // Depend on shouldRenderSidebar

    const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

    // Calculate margin based on whether a sidebar is rendered AND its open/collapsed state
    let mainContentMarginClass = 'ml-0'; // Default to no margin
    if (shouldRenderSidebar) {
        mainContentMarginClass = isSidebarOpen ? 'ml-64' : 'ml-20'; // Full or collapsed sidebar margin
    }
    // For roles that don't get a sidebar, mainContentMarginClass remains 'ml-0'


    return (
        <div className="flex h-screen bg-gray-50">
            {shouldRenderSidebar && (
                // Pass toggleSidebar and user/logout to the Sidebar component
                <Sidebar isOpen={isSidebarOpen} toggleSidebar={toggleSidebar} user={user} />
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
                        <Route path="/staff-dashboard" element={<PrivateRoute roles={['staff']}><StaffDashboard /></PrivateRoute>} /> {/* Only staff role gets this specific dashboard */}
                        <Route path="/staff-schedule" element={<PrivateRoute roles={['staff']}><StaffSchedulePage /></PrivateRoute>} /> {/* Only staff role gets this */}
                        <Route path="/my-payslips" element={<PrivateRoute roles={['staff']}><MyPayslipsPage /></PrivateRoute>} /> {/* Only staff role gets this */}

                        {/* Admin/Manager Routes (WITH Sidebar) */}
                        <Route path="/dashboard" element={<PrivateRoute roles={['admin', 'manager']}><Dashboard /></PrivateRoute>} />
                        <Route path="/customers" element={<PrivateRoute roles={['admin', 'manager']}><CustomerPage /></PrivateRoute>} />
                        <Route path="/leads" element={<PrivateRoute roles={['admin', 'manager', 'staff']}><LeadsView /></PrivateRoute>} /> {/* Leads can be seen by staff too */}
                        <Route path="/staff" element={<PrivateRoute roles={['admin', 'manager']}><StaffPage /></PrivateRoute>} />
                        <Route path="/form-builder" element={<PrivateRoute roles={['admin']}><DndProvider backend={HTML5Backend}><FormBuilderPage /></DndProvider></PrivateRoute>} />
                        <Route path="/settings" element={<PrivateRoute roles={['admin']}><SettingsPage /></PrivateRoute>} />
                        <Route path="/scheduler" element={<PrivateRoute roles={['admin', 'manager', 'staff']}><DndProvider backend={HTML5Backend}><SchedulerView /></DndProvider></PrivateRoute>} />
                        <Route path="/stock" element={<PrivateRoute roles={['admin', 'manager', 'staff']}><StockView /></PrivateRoute>} />
                        <Route path="/route-planner" element={<PrivateRoute roles={['admin', 'manager']}><RoutePlannerView /></PrivateRoute>} />
                        <Route path="/staff-absence" element={<PrivateRoute roles={['admin', 'manager']}><StaffAbsencePage /></PrivateRoute>} />
                        <Route path="/email-templates" element={<PrivateRoute roles={['admin']}><EmailTemplatesView /></PrivateRoute>} />
                        <Route path="/invoices" element={<PrivateRoute roles={['admin', 'manager']}><InvoicePage /></PrivateRoute>} />
                        <Route path="/invoices/:invoiceId" element={<PrivateRoute roles={['admin', 'manager', 'staff']}><InvoiceDetails /></PrivateRoute>} /> {/* Staff can view specific invoices too */}
                        <Route path="/payroll" element={<PrivateRoute roles={['admin', 'manager']}><PayrollPage /></PrivateRoute>} />
                        <Route path="/commission-report" element={<PrivateRoute roles={['admin', 'manager']}><CommissionReportPage /></PrivateRoute>} />
                        <Route path="/spot-checker" element={<PrivateRoute roles={['admin', 'manager', 'staff']}><SpotCheckerPage /></PrivateRoute>} /> {/* Accessible by staff too */}


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
                        <DndProvider backend={HTML5Backend}> {/* DndProvider wraps the entire app where dragging might occur */}
                            <AppContent />
                        </DndProvider>
                    </MapsApiProvider>
                </CurrencyProvider>
            </AuthProvider>
        </Router>
    );
}

export default App;