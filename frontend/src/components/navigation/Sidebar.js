import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

// --- Heroicons from @heroicons/react/24/outline ---
import {
    HomeIcon,
    UsersIcon,
    FolderIcon,
    CalendarIcon,
    DocumentDuplicateIcon,
    ChartPieIcon,
    Cog6ToothIcon,
    XMarkIcon,
    EnvelopeIcon,
    ClipboardDocumentListIcon,
    BriefcaseIcon,
    MapPinIcon,
    CurrencyDollarIcon,
    ShoppingCartIcon,
    UserGroupIcon,
    CpuChipIcon,
} from '@heroicons/react/24/outline';

// --- Lucide-React Icons ---
import {
    LayoutDashboard,
    CheckCircle,
    Megaphone,
    Truck,
    Mail as MailLucide,
    ReceiptText,
    LineChart,
    Package,
    UserCog,
    FolderKanban,
} from 'lucide-react';


const Sidebar = ({ isOpen, toggleSidebar, user, logout }) => {
    const location = useLocation();
    const userRole = user?.role;
    const { t } = useTranslation();

    const classNames = (...classes) => {
        return classes.filter(Boolean).join(' ')
    }

    const isCurrent = (href) => {
        if (href === '/dashboard' || href === '/staff-dashboard' || href === '/customer-portal' || href === '/my-payslips' || href === '/jobs') {
            return location.pathname.startsWith(href);
        }
        return location.pathname === href;
    };


    // Define ALL navigation items with their respective roles
    // Corrected to consistently use t('sidebar.KEY_NAME') for all sidebar items
    const navigation = [
        // Dashboards
        { name: t('sidebar.dashboard'), href: '/dashboard', icon: LayoutDashboard, roles: ['admin', 'manager'] },
        { name: t('sidebar.staffDashboard'), href: '/staff-dashboard', icon: HomeIcon, roles: ['staff'] },
        { name: t('sidebar.customerPortal'), href: '/customer-portal', icon: UsersIcon, roles: ['customer'] },

        // CRM & People Management
        { name: t('sidebar.customers'), href: '/customers', icon: UsersIcon, roles: ['admin', 'manager'] },
        { name: t('sidebar.leads'), href: '/leads', icon: Megaphone, roles: ['admin', 'manager', 'staff'] },
        { name: t('sidebar.staff'), href: '/staff', icon: UsersIcon, roles: ['admin', 'manager'] },
        { name: t('sidebar.staffAbsence'), href: '/staff-absence', icon: BriefcaseIcon, roles: ['admin', 'manager'] },

        // Operations & Scheduling
        { name: t('sidebar.scheduler'), href: '/scheduler', icon: CalendarIcon, roles: ['admin', 'manager', 'staff'] },
        { name: t('sidebar.routePlanner'), href: '/route-planner', icon: MapPinIcon, roles: ['admin', 'manager'] },
        { name: t('sidebar.spotChecker'), href: '/spot-checker', icon: CheckCircle, roles: ['admin', 'manager', 'staff'] },
        { name: t('sidebar.jobs'), href: '/jobs', icon: BriefcaseIcon, roles: ['admin', 'manager', 'staff'] },

        // Inventory & Invoicing
        { name: t('sidebar.stock'), href: '/stock', icon: DocumentDuplicateIcon, roles: ['admin', 'manager', 'staff'] },
        { name: t('sidebar.invoices'), href: '/invoices', icon: CurrencyDollarIcon, roles: ['admin', 'manager', 'staff'] },

        // Financials (Payroll & Reports)
        { name: t('sidebar.payroll'), href: '/payroll', icon: CurrencyDollarIcon, roles: ['admin', 'manager'] },
        { name: t('sidebar.myPayslips'), href: '/my-payslips', icon: CurrencyDollarIcon, roles: ['staff'] },
        { name: t('sidebar.commissionReport'), href: '/commission-report', icon: ChartPieIcon, roles: ['admin', 'manager'] },

        // Tools & Automation
        { name: t('sidebar.emailTemplates'), href: '/email-templates', icon: EnvelopeIcon, roles: ['admin'] },
        { name: t('sidebar.formBuilder'), href: '/form-builder', icon: ChartPieIcon, roles: ['admin'] },
        { name: t('sidebar.settings'), href: '/settings', icon: Cog6ToothIcon, roles: ['admin'] },

    ].filter(item => item.roles.includes(userRole));


    return (
        <div
            className={`fixed inset-y-0 left-0 bg-gray-800 text-white
                        transition-all duration-300 ease-in-out z-20
                        ${isOpen ? 'w-64' : 'w-20 transform -translate-x-full md:translate-x-0 md:w-20'}`}
        >
            <div className="flex items-center justify-between h-16 px-4 border-b border-gray-700">
                <span className="text-xl font-bold">{t('appTitle')}</span>
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
                    <p className="text-xs">{t('sidebar.loggedInAs')}: <br /><span className="font-semibold text-white">{user?.contactPersonName || user?.email}</span></p>
                    <p className="text-xs">{t('sidebar.role')}: {t(`roles.${userRole}`)}</p>
                    <button
                        onClick={logout}
                        className="mt-2 text-sm text-red-400 hover:text-red-300 flex items-center"
                    >
                        <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
                        {t('sidebar.logout')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Sidebar;