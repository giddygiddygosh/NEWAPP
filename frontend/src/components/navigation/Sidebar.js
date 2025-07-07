// src/components/navigation/Sidebar.jsx

import React, { useState, useCallback } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

import {
    HomeIcon, UserGroupIcon, BriefcaseIcon, DocumentTextIcon,
    CurrencyDollarIcon, CubeIcon, CogIcon,
    ChartBarIcon, UsersIcon, MapIcon, CalendarIcon, CreditCardIcon, ArchiveBoxIcon,
    ChevronDownIcon, ChevronUpIcon, ChevronRightIcon,
    Bars3Icon, XMarkIcon, ArrowRightOnRectangleIcon,
    EnvelopeIcon, ClipboardDocumentListIcon, BuildingLibraryIcon,
    BuildingOffice2Icon, MegaphoneIcon, ShoppingBagIcon,
    Package // Import Package icon for Stock
} from '@heroicons/react/24/outline'; // Assuming Heroicons are your primary icons

// Assuming these icons are used and imported from lucide-react in Sidebar
import { Mail as MailIconLucide, Search as SearchIconLucide, Route as RouteIconLucide, UserX as UserXIconLucide } from 'lucide-react'; // NEW: Import UserX icon for Staff Absence


const Sidebar = ({ isOpen, toggleSidebar, user, logout, className }) => {
    const location = useLocation();
    const [openSubMenu, setOpenSubMenu] = useState(null);

    const isPathActiveInGroup = useCallback((children) => {
        return children.some(child => location.pathname.startsWith(child.path));
    }, [location.pathname]);


    if (user && (user.role === 'customer' || user.role === 'staff' || user.role === 'manager')) {
        return null;
    }

    const toggleSubMenu = (name) => {
        setOpenSubMenu(openSubMenu === name ? null : name);
    };

    const navItems = [
        { name: 'Dashboard', path: '/dashboard', icon: HomeIcon, roles: ['admin'], isGroup: false },

        {
            name: 'CRM',
            icon: UserGroupIcon,
            roles: ['admin', 'manager'],
            isGroup: true,
            children: [
                { name: 'Customers', path: '/customers', icon: UsersIcon, roles: ['admin', 'manager'] },
                { name: 'Leads', path: '/leads', icon: MegaphoneIcon, roles: ['admin', 'manager', 'staff'] },
            ]
        },

        {
            name: 'Management',
            icon: BriefcaseIcon,
            roles: ['admin', 'staff', 'manager'],
            isGroup: true,
            children: [
                { name: 'Staff', path: '/staff', icon: UsersIcon, roles: ['admin', 'manager'] },
                // NEW: Staff Absence Link
                { name: 'Staff Absence', path: '/staff-absence', icon: UserXIconLucide, roles: ['admin', 'manager'] }, // Admin/Manager can manage
                { name: 'Jobs', path: '/jobs', icon: BriefcaseIcon, roles: ['admin', 'staff', 'manager'] },
                { name: 'Invoices', path: '/invoices', icon: DocumentTextIcon, roles: ['admin', 'manager', 'staff'] },
                { name: 'Quotes', path: '/quotes', icon: ClipboardDocumentListIcon, roles: ['admin', 'manager', 'staff'] },
                { name: 'Stock', path: '/stock', icon: CubeIcon, roles: ['admin', 'manager', 'staff'] },
                { name: 'Scheduler', path: '/scheduler', icon: CalendarIcon, roles: ['admin', 'staff', 'manager'] },
                { name: 'Spot Checker', path: '/spot-checker', icon: SearchIconLucide, roles: ['admin', 'staff', 'manager'] },
                { name: 'Task Checklists', path: '/task-checklists', icon: ClipboardDocumentListIcon, roles: ['admin', 'staff', 'manager'] },
                { name: 'Payroll', path: '/payroll', icon: CreditCardIcon, roles: ['admin'] },
            ]
        },

        {
            name: 'Tools & Automation',
            icon: CogIcon,
            roles: ['admin'],
            isGroup: true,
            children: [
                { name: 'Route Planner', path: '/route-planner', icon: RouteIconLucide, roles: ['admin', 'manager'] },
                { name: 'Email Templates', path: '/email-templates', icon: MailIconLucide, roles: ['admin'] },
                { name: 'Form Builder', path: '/form-builder', icon: BuildingLibraryIcon, roles: ['admin'] },
                { name: 'Settings', path: '/settings', icon: CogIcon, roles: ['admin'] },
            ]
        },

        {
            name: 'Reports',
            icon: ChartBarIcon,
            roles: ['admin', 'manager'],
            isGroup: true,
            children: [
                { name: 'Commission Report', path: '/commission-report', icon: ChartBarIcon, roles: ['admin', 'manager'] },
            ]
        },
    ];

    return (
        <>
            {/* Mobile sidebar overlay */}
            <div
                className={`fixed inset-0 bg-gray-600 bg-opacity-75 z-40 md:hidden ${isOpen ? 'block' : 'hidden'}`}
                onClick={toggleSidebar}
            ></div>

            {/* Desktop sidebar */}
            <div
                className={`
                    ${className}
                    fixed inset-y-0 left-0 z-50 bg-gray-800 text-white flex flex-col
                    transition-all duration-300 ease-in-out
                    ${isOpen ? 'w-64' : 'w-20'} md:flex md:relative md:shrink-0
                    overflow-hidden
                `}
            >
                {/* Sidebar Header/Logo Area */}
                <div className="flex items-center justify-between h-16 px-4 border-b border-gray-700 flex-shrink-0">
                    {isOpen ? (
                        <span className="text-xl font-semibold flex-shrink-0">ServiceOS</span>
                    ) : (
                        <div className="flex items-center justify-center w-full py-2">
                            <BuildingOffice2Icon className="h-8 w-8 text-blue-400" />
                        </div>
                    )}
                    <button onClick={toggleSidebar} className="md:hidden text-gray-400 hover:text-white focus:outline-none">
                        <XMarkIcon className="h-6 w-6" />
                    </button>
                </div>

                {/* Main Navigation Area */}
                <nav className="flex-1 px-2 py-4 overflow-y-auto custom-scrollbar">
                    <ul className="list-none space-y-1">
                        {navItems.map((item) => {
                            const hasAccess = user && item.roles.includes(user.role);
                            if (!hasAccess) return null;

                            const isActive = item.path ? location.pathname === item.path :
                                             item.isGroup && isPathActiveInGroup(item.children);

                            if (item.isGroup) {
                                const isSubMenuOpen = openSubMenu === item.name || isPathActiveInGroup(item.children);

                                return (
                                    <li key={item.name}>
                                        <button
                                            onClick={() => toggleSubMenu(item.name)}
                                            className={`
                                                flex items-center py-2 rounded-lg transition-colors duration-200 w-full
                                                ${isActive ? 'bg-indigo-700 text-white shadow-md' : 'hover:bg-gray-700 text-gray-300 hover:text-white'}
                                                ${isOpen ? 'px-4 justify-between' : 'justify-center'}
                                            `}
                                            data-tip={!isOpen ? item.name : ''}
                                        >
                                            <span className="flex items-center">
                                                {item.icon && <item.icon className={`h-6 w-6 ${isOpen ? 'mr-3' : 'mx-auto'}`} />}
                                                <span className={`text-base font-medium ${isOpen ? 'whitespace-nowrap overflow-hidden text-ellipsis' : 'hidden'}`}>{item.name}</span>
                                            </span>
                                            {isOpen && (isSubMenuOpen ? <ChevronUpIcon className="h-5 w-5 ml-2 flex-shrink-0" /> : <ChevronDownIcon className="h-5 w-5 ml-2 flex-shrink-0" />)}
                                            {!isOpen && !isSubMenuOpen && <ChevronRightIcon className="h-5 w-5 absolute right-2 top-1/2 -translate-y-1/2" />}
                                            {!isOpen && isSubMenuOpen && <ChevronDownIcon className="h-5 w-5 absolute right-2 top-1/2 -translate-y-1/2 transform rotate-90" />}
                                        </button>

                                        {isSubMenuOpen && (
                                            <ul className={`
                                                list-none space-y-1
                                                ${isOpen ? 'ml-4 mt-2 relative' : 'absolute left-full top-0 mt-0 bg-gray-700 rounded-lg shadow-lg w-48 py-2 z-50'}
                                                transition-all duration-300 ease-in-out
                                            `}>
                                                {item.children.map(child => {
                                                    const childHasAccess = user && child.roles.includes(user.role);
                                                    if (!childHasAccess) return null;

                                                    return (
                                                        <li key={child.name}>
                                                            <NavLink
                                                                to={child.path}
                                                                className={({ isActive: isChildActive }) =>
                                                                    `flex items-center py-2 rounded-lg transition-colors duration-200
                                                                    ${isChildActive ? 'bg-indigo-600 text-white shadow-sm' : 'hover:bg-gray-600 text-gray-400 hover:text-white'}
                                                                    ${isOpen ? 'px-3' : 'px-4'}`
                                                                }
                                                            >
                                                                {child.icon && <child.icon className={`h-5 w-5 ${isOpen ? 'mr-2' : 'mr-0'}`} />}
                                                                <span className="text-sm whitespace-nowrap overflow-hidden text-ellipsis">{child.name}</span>
                                                            </NavLink>
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        )}
                                    </li>
                                );
                            } else {
                                return (
                                    <li key={item.name}>
                                        <NavLink
                                            to={item.path}
                                            className={({ isActive }) =>
                                                `flex items-center py-2 rounded-lg transition-colors duration-200
                                                ${isActive ? 'bg-indigo-700 text-white shadow-md' : 'hover:bg-gray-700 text-gray-300 hover:text-white'}
                                                ${isOpen ? 'px-4' : 'justify-center md:tooltip md:tooltip-right'}`
                                            }
                                            data-tip={!isOpen ? item.name : ''}
                                        >
                                            {item.icon && <item.icon className={`h-6 w-6 ${isOpen ? 'mr-3' : 'mx-auto'}`} />}
                                            <span className={`text-base font-medium ${isOpen ? 'whitespace-nowrap overflow-hidden text-ellipsis' : 'hidden'}`}>{item.name}</span>
                                        </NavLink>
                                    </li>
                                );
                            }
                        })}
                    </ul>
                </nav>

                {/* Footer/Logout Section */}
                <div className={`mt-auto pt-4 border-t border-gray-700 ${isOpen ? 'px-2' : 'px-0'} text-center flex-shrink-0`}>
                    {isOpen && (
                        <>
                            <p className="text-sm text-gray-400 mb-2">Logged in as:</p>
                            <p className="text-md font-semibold text-white mb-2 truncate">{user.contactPersonName || user.email}</p>
                            <p className="text-xs text-gray-500 mb-4 uppercase">{user.role}</p>
                            {user.company?.name && (
                                <p className="text-xs text-gray-500 mb-4">({user.company.name})</p>
                            )}
                        </>
                    )}
                    <button
                        onClick={logout}
                        className={`
                            w-full flex items-center justify-center py-2 rounded-lg bg-red-600 text-white
                            hover:bg-red-700 transition-colors duration-200 shadow-md
                            ${isOpen ? 'px-4' : 'px-0 md:tooltip md:tooltip-right'}`
                        }
                        data-tip={!isOpen ? 'Logout' : ''}
                    >
                        <ArrowRightOnRectangleIcon className={`h-6 w-6 ${isOpen ? 'mr-3' : 'mx-auto'}`} />
                        {isOpen && <span className="text-base font-medium">Logout</span>}
                    </button>
                </div>
            </div>
        </>
    );
};

export default Sidebar;