// src/components/navigation/Sidebar.jsx

import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
    // --- Heroicons from @heroicons/react/24/outline ---
    HomeIcon,              // For Dashboard, Staff Dashboard
    UsersIcon,             // For Customers, Staff
    FolderIcon,            // For Leads (or other general folders)
    CalendarIcon,          // For Scheduler
    DocumentDuplicateIcon, // For Stock (or documents)
    ChartPieIcon,          // For Form Builder (or charts)
    Cog6ToothIcon,         // For Settings
    XMarkIcon,             // For closing sidebar on mobile
    EnvelopeIcon,          // For Email Templates

    // Specific Heroicons I saw in your earlier App.js or might be useful defaults
    ClipboardDocumentListIcon, // For a list/reports feel (e.g., Leads, Email Templates)
    BriefcaseIcon,             // For Staff Absence, or general business items (Heroicons version exists)
    MapPinIcon,                // For Route Planner
    CurrencyDollarIcon,        // Heroicons dollar sign - for Invoices/Payroll if preferred over Lucide
    ShoppingCartIcon,          // Could be for Products/Sales
    UserGroupIcon,             // Another option for Staff
    CpuChipIcon,               // Example for a tools icon
    // Ensure only actual Heroicons are imported from here
} from '@heroicons/react/24/outline';

import {
    // --- Lucide-React Icons (use only when Heroicons don't fit or are unavailable) ---
    // DollarSign,       // Using CurrencyDollarIcon from Heroicons above now, but keeping this if you prefer Lucide's aesthetic for money
    LayoutDashboard,  // Can be a better main dashboard icon than HomeIcon for admin
    CheckCircle,      // For Spot Checker (Lucide version - Heroicons has CheckCircleIcon)
    Megaphone,        // For Leads
    Truck,            // For Route Planner
    Mail as MailLucide, // Alias if you need MailIcon from Heroicons too
    ReceiptText,      // For Invoices
    LineChart,        // For Commission Report
    Package,          // For Stock
    UserCog,          // For Staff
    FolderKanban,     // For Form Builder
} from 'lucide-react';


// Helper to determine active link styling
function classNames(...classes) {
    return classes.filter(Boolean).join(' ')
}

const Sidebar = ({ isOpen, toggleSidebar, user, logout }) => {
    const location = useLocation();
    const userRole = user?.role;

    // Define ALL navigation items with their respective roles
    // Using Heroicons by default, selectively using Lucide where noted
    const navigation = [
        // Dashboards
        { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['admin', 'manager'] }, // Using Lucide LayoutDashboard
        { name: 'Staff Dashboard', href: '/staff-dashboard', icon: HomeIcon, roles: ['staff'] },
        { name: 'Customer Portal', href: '/customer-portal', icon: UsersIcon, roles: ['customer'] }, // Using Heroicons UsersIcon

        // CRM & People Management
        { name: 'Customers', href: '/customers', icon: UsersIcon, roles: ['admin', 'manager'] },
        { name: 'Leads', href: '/leads', icon: Megaphone, roles: ['admin', 'manager', 'staff'] }, // Using Lucide Megaphone
        { name: 'Staff', href: '/staff', icon: UsersIcon, roles: ['admin', 'manager'] }, // Using Heroicons UsersIcon
        { name: 'Staff Absence', href: '/staff-absence', icon: BriefcaseIcon, roles: ['admin', 'manager'] }, // Using Heroicons BriefcaseIcon

        // Operations & Scheduling
        { name: 'Scheduler', href: '/scheduler', icon: CalendarIcon, roles: ['admin', 'manager', 'staff'] },
        { name: 'Route Planner', href: '/route-planner', icon: MapPinIcon, roles: ['admin', 'manager'] }, // Using Heroicons MapPinIcon for routes
        { name: 'Spot Checker', href: '/spot-checker', icon: CheckCircle, roles: ['admin', 'manager', 'staff'] }, // Using Lucide CheckCircle

        // Inventory & Invoicing
        { name: 'Stock', href: '/stock', icon: DocumentDuplicateIcon, roles: ['admin', 'manager', 'staff'] }, // Using Heroicons DocumentDuplicateIcon
        { name: 'Invoices', href: '/invoices', icon: CurrencyDollarIcon, roles: ['admin', 'manager', 'staff'] }, // Using Heroicons CurrencyDollarIcon

        // Financials (Payroll & Reports)
        { name: 'Payroll', href: '/payroll', icon: CurrencyDollarIcon, roles: ['admin', 'manager'] }, // Using Heroicons CurrencyDollarIcon
        { name: 'My Payslips', href: '/my-payslips', icon: CurrencyDollarIcon, roles: ['staff'] }, // Using Heroicons CurrencyDollarIcon
        { name: 'Commission Report', href: '/commission-report', icon: ChartPieIcon, roles: ['admin', 'manager'] }, // Using Heroicons ChartPieIcon

        // Tools & Automation
        { name: 'Email Templates', href: '/email-templates', icon: EnvelopeIcon, roles: ['admin'] }, // Using Heroicons EnvelopeIcon
        { name: 'Form Builder', href: '/form-builder', icon: ChartPieIcon, roles: ['admin'] }, // Using Heroicons ChartPieIcon
        { name: 'Settings', href: '/settings', icon: Cog6ToothIcon, roles: ['admin'] },

    ].filter(item => item.roles.includes(userRole));


    // Determine if the current path is active for the sidebar highlighting
    const isCurrent = (href) => {
        if (href === '/dashboard' || href === '/staff-dashboard' || href === '/customer-portal' || href === '/my-payslips') {
            return location.pathname.startsWith(href);
        }
        return location.pathname === href;
    };

    return (
        <div
            className={`fixed inset-y-0 left-0 bg-gray-800 text-white
                       transition-all duration-300 ease-in-out z-20
                       ${isOpen ? 'w-64' : 'w-20 transform -translate-x-full md:translate-x-0 md:w-20'}`}
        >
            <div className="flex items-center justify-between h-16 px-4 border-b border-gray-700">
                <span className="text-xl font-bold">ServiceOS</span>
                <button
                    onClick={toggleSidebar}
                    className="md:hidden p-2 rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
                >
                    <XMarkIcon className="h-6 w-6" />
                </button>
            </div>
            <nav className="flex flex-col flex-1 px-2 py-4 space-y-1">
                {navigation.map((item) => (
                    <Link
                        key={item.name}
                        to={item.href}
                        className={classNames(
                            isCurrent(item.href)
                                ? 'bg-gray-900 text-white'
                                : 'text-gray-300 hover:bg-gray-700 hover:text-white',
                            'group flex items-center px-2 py-2 text-sm font-medium rounded-md'
                        )}
                    >
                        {/* Render icon based on item.icon, which can be from either library */}
                        <item.icon
                            className={classNames(
                                isCurrent(item.href) ? 'text-gray-300' : 'text-gray-400 group-hover:text-gray-300',
                                'mr-3 flex-shrink-0 h-6 w-6'
                            )}
                            aria-hidden="true"
                        />
                        <span className={`${isOpen ? 'block' : 'hidden md:block'}`}>{item.name}</span>
                    </Link>
                ))}
            </nav>

            <div className="absolute bottom-0 left-0 w-full p-4 border-t border-gray-700 text-gray-400">
                <div className={`${isOpen ? 'block' : 'hidden md:block'}`}>
                    <p className="text-xs">Logged in as: <br /><span className="font-semibold text-white">{user?.contactPersonName || user?.email}</span></p>
                    <p className="text-xs">Role: {userRole}</p>
                    <button
                        onClick={logout}
                        className="mt-2 text-sm text-red-400 hover:text-red-300 flex items-center"
                    >
                        <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
                        Logout
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Sidebar;