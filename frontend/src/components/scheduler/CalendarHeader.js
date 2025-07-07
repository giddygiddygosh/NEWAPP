// src/components/scheduler/CalendarHeader.js

import React, { useMemo } from 'react';
import ModernSelect from '../common/ModernSelect';
import { ChevronLeft, ChevronRight, Plus, Users, Briefcase, Calendar, View, Columns } from 'lucide-react';
import { getWeekDays } from '../../utils/helpers';

const CalendarHeader = ({ currentDate, viewMode, onViewChange, dayViewLayout, onLayoutChange, onNavigate, onNewJob, customers, staff, onCustomerFilterChange, onStaffFilterChange, isLoadingCustomers, isLoadingStaff }) => {
    const title = useMemo(() => {
        if (viewMode === 'month') return currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });
        if (viewMode === 'day') return currentDate.toLocaleString('default', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        const weekDays = getWeekDays(currentDate);
        return `${weekDays[0].toLocaleString('default', { month: 'short', day: 'numeric' })} - ${weekDays[6].toLocaleString('default', { month: 'short', day: 'numeric' })}, ${weekDays[6].getFullYear()}`;
    }, [currentDate, viewMode]);

    return (
        <>
            <header className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 p-1 bg-gray-100 rounded-lg shadow-sm">
                        <button
                            onClick={() => onNavigate('prev')}
                            className="p-2 rounded-md text-gray-700 hover:bg-gray-200 transition-colors"
                        >
                            <ChevronLeft size={20}/>
                        </button>
                        <button
                            onClick={() => onNavigate('next')}
                            className="p-2 rounded-md text-gray-700 hover:bg-gray-200 transition-colors"
                        >
                            <ChevronRight size={20}/>
                        </button>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800">{title}</h2>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center p-1 bg-gray-100 rounded-lg shadow-sm">
                        {['month', 'week', 'day'].map(view => (
                            <button
                                key={view}
                                onClick={() => onViewChange(view)}
                                className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors duration-200
                                            ${viewMode === view ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-200'}`}
                            >
                                {view.charAt(0).toUpperCase() + view.slice(1)}
                            </button>
                        ))}
                    </div>
                    {viewMode === 'day' && (
                        <div className="flex items-center p-1 bg-gray-100 rounded-lg shadow-sm">
                            <button
                                onClick={() => onLayoutChange('vertical')}
                                className={`p-2 rounded-lg ${dayViewLayout === 'vertical' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-200'}`}
                            >
                                <View size={18}/>
                            </button>
                            <button
                                onClick={() => onLayoutChange('horizontal')}
                                className={`p-2 rounded-lg ${dayViewLayout === 'horizontal' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-200'}`}
                            >
                                <Columns size={18}/>
                            </button>
                        </div>
                    )}
                    <button
                        onClick={() => onNewJob(currentDate)} // Pass currentDate to onNewJob
                        className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white font-semibold rounded-lg shadow-md
                                   hover:bg-green-700 transition-colors duration-200 transform hover:scale-105"
                    >
                        <Plus size={20} /> <span className="hidden sm:inline">New Job</span>
                    </button>
                </div>
            </header>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Filter by Customer</label>
                    <ModernSelect
                        icon={<Users size={16} className="text-gray-400"/>}
                        onChange={e => onCustomerFilterChange(e.target.value)}
                        disabled={isLoadingCustomers}
                        value={isLoadingCustomers ? '' : undefined}
                        options={isLoadingCustomers ? [{ value: '', label: 'Loading Customers...' }] : [
                            { value: 'all', label: 'All Customers' },
                            ...(customers || []).map(c => ({ value: c._id, label: c.contactPersonName || c.email })),
                            ...((customers && customers.length === 0 && !isLoadingCustomers) ? [{ value: '', label: 'No Customers Available', disabled: true }] : [])
                        ]}
                    />
                </div>
                <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Filter by Staff</label>
                    <ModernSelect
                        icon={<Briefcase size={16} className="text-gray-400"/>}
                        onChange={e => onStaffFilterChange(e.target.value)}
                        disabled={isLoadingStaff}
                        value={isLoadingStaff ? '' : undefined}
                        options={isLoadingStaff ? [{ value: '', label: 'Loading Staff...' }] : [
                            { value: 'all', label: 'All Staff' },
                            ...(staff || []).map(s => ({ value: s._id, label: s.contactPersonName })),
                            ...((staff && staff.length === 0 && !isLoadingStaff) ? [{ value: '', label: 'No Staff Available', disabled: true }] : [])
                        ]}
                    />
                </div>
            </div>
        </>
    );
};

export default CalendarHeader;