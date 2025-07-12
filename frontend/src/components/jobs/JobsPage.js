import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../../utils/api';
import Loader from '../common/Loader';
import JobModal from './JobModal';
import ModernInput from '../common/ModernInput';
import ModernSelect from '../common/ModernSelect';
import { useTranslation } from 'react-i18next';
import { PlusCircleIcon, MagnifyingGlassIcon, ArrowPathIcon } from '@heroicons/react/20/solid';
import { ChevronLeftIcon, ChevronRightIcon, ArrowUpIcon, ArrowDownIcon } from '@heroicons/react/24/outline';

const JobsPage = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();

    // --- Refactor Step 1: URL as the Single Source of Truth ---
    // We derive all filter, sort, and pagination state directly from the URL query parameters.
    // useMemo ensures this parsing only happens when the URL search string changes.
    const queryParams = useMemo(() => new URLSearchParams(location.search), [location.search]);

    const page = useMemo(() => parseInt(queryParams.get('page') || '1'), [queryParams]);
    const limit = useMemo(() => parseInt(queryParams.get('limit') || '10'), [queryParams]);
    const search = useMemo(() => queryParams.get('search') || '', [queryParams]);
    const status = useMemo(() => queryParams.get('status') || '', [queryParams]);
    const customer = useMemo(() => queryParams.get('customer') || '', [queryParams]);
    const sortBy = useMemo(() => queryParams.get('sortBy') || 'date', [queryParams]);
    const sortOrder = useMemo(() => queryParams.get('sortOrder') || 'desc', [queryParams]);

    // --- Local UI State ---
    const [jobs, setJobs] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [staff, setStaff] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [pagination, setPagination] = useState({ totalCount: 0, totalPages: 1 });
    const [isJobModalOpen, setIsJobModalOpen] = useState(false);
    const [editingJob, setEditingJob] = useState(null);

    const jobStatusOptions = [
        { value: '', label: t('jobPage.filterByStatus') },
        { value: 'Booked', label: 'Booked' },
        { value: 'On Route', label: 'On Route' },
        { value: 'In Progress', label: 'In Progress' },
        { value: 'Pending Completion', label: 'Pending Completion' },
        { value: 'Completed', label: 'Completed' },
        { value: 'Invoiced', label: 'Invoiced' },
        { value: 'Invoice Paid', label: 'Invoice Paid' },
        { value: 'Cancelled', label: 'Cancelled' },
        { value: 'Pending', label: 'Pending' },
        { value: 'On Hold', label: 'On Hold' },
    ];

    // --- Data Fetching ---
    // Fetches static data for filter dropdowns only once
    useEffect(() => {
        const fetchFilterData = async () => {
            try {
                const [customersRes, staffRes] = await Promise.all([
                    api.get('/customers'),
                    api.get('/staff'),
                ]);
                setCustomers(customersRes.data || []);
                setStaff(staffRes.data || []);
            } catch (err) {
                console.error("Failed to fetch customers or staff for filters:", err);
            }
        };
        fetchFilterData();
    }, []);

    // Main effect to fetch jobs. This now depends directly on values parsed from the URL.
    useEffect(() => {
        const fetchJobs = async () => {
            setLoading(true);
            setError(null);
            try {
                const params = {
                    page,
                    limit,
                    sort: `${sortOrder === 'desc' ? '-' : ''}${sortBy}`,
                    search,
                    status,
                    customer,
                };

                const res = await api.get('/jobs', { params });
                
                // --- FIX: Handle the direct array response from the API ---
                // The API is returning an array `[...]` instead of an object `{ jobs: [...] }`.
                // We will treat the entire `res.data` as the jobs array.
                const jobsData = res.data || [];
                setJobs(jobsData);

                // For pagination, since the API doesn't provide a total count, we'll have to
                // make a best guess. For a proper fix, the backend should return `{ jobs: [], totalCount: ... }`.
                // This temporary fix will make the UI work but pagination might not be perfect.
                const totalCount = res.data.totalCount || jobsData.length; // Use totalCount if available, otherwise fallback to array length
                setPagination({
                    totalCount: totalCount,
                    totalPages: Math.ceil(totalCount / limit),
                });

            } catch (err) {
                console.error("Error fetching jobs:", err);
                setError(err.response?.data?.message || t('jobPage.failedToFetchJobs'));
                setJobs([]);
            } finally {
                setLoading(false);
            }
        };

        fetchJobs();
    }, [page, limit, search, status, customer, sortBy, sortOrder, t]);


    // --- Refactor Step 2: Event Handlers now update the URL ---
    const updateQuery = (newParams) => {
        const currentParams = new URLSearchParams(location.search);
        Object.entries(newParams).forEach(([key, value]) => {
            if (value) {
                currentParams.set(key, value);
            } else {
                currentParams.delete(key);
            }
        });
        navigate(`?${currentParams.toString()}`, { replace: true });
    };

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        updateQuery({ [name]: value, page: '1' }); // Reset to page 1 on filter change
    };

    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= pagination.totalPages) {
            updateQuery({ page: newPage });
        }
    };

    const handleLimitChange = (e) => {
        updateQuery({ limit: e.target.value, page: '1' });
    };

    const handleSortChange = (field) => {
        const newSortOrder = sortBy === field && sortOrder === 'asc' ? 'desc' : 'asc';
        updateQuery({ sortBy: field, sortOrder: newSortOrder });
    };
    
    const handleResetFilters = () => {
        navigate(''); // Navigate to the base path to clear all query params
    };

    // --- Modal and Navigation Handlers (Unchanged) ---
    const handleJobSaved = () => {
        // Re-trigger the main useEffect by re-fetching from the current URL state
        navigate(location.pathname + location.search, { replace: true });
        setIsJobModalOpen(false);
        setEditingJob(null);
    };

    const handleViewDetails = (jobId) => navigate(`/jobs/${jobId}`);

    const handleEditJob = (job) => {
        setEditingJob(job);
        setIsJobModalOpen(true);
    };

    const customerFilterOptions = [
        { value: '', label: t('jobPage.filterByCustomer') },
        ...(customers || []).map(cust => ({ value: cust._id, label: cust.contactPersonName }))
    ];

    // --- Refactor Step 3: JSX now reads values directly from parsed constants ---
    return (
        <div className="p-8 bg-gray-50 min-h-screen">
            <header className="flex justify-between items-center mb-6 pb-4 border-b border-gray-200">
                <h1 className="text-3xl font-bold text-gray-800">{t('jobPage.managementTitle')}</h1>
                <button
                    onClick={() => setIsJobModalOpen(true)}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 shadow-md flex items-center gap-2"
                >
                    <PlusCircleIcon className="h-5 w-5" /> {t('jobPage.createJobButton')}
                </button>
            </header>

            {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>}

            <div className="bg-white p-4 rounded-lg shadow-md mb-6 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                <ModernInput
                    label={t('jobPage.searchJobsLabel')}
                    name="search"
                    value={search}
                    onChange={handleFilterChange}
                    placeholder={t('jobPage.searchPlaceholder')}
                    icon={<MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />}
                />
                <ModernSelect
                    label={t('jobPage.customerLabel')}
                    name="customer"
                    value={customer}
                    onChange={handleFilterChange}
                    options={customerFilterOptions}
                />
                <ModernSelect
                    label={t('jobPage.statusLabel')}
                    name="status"
                    value={status}
                    onChange={handleFilterChange}
                    options={jobStatusOptions}
                />
                <button
                    onClick={handleResetFilters}
                    className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 flex items-center justify-center gap-2 mt-auto"
                >
                    <ArrowPathIcon className="h-5 w-5" /> {t('jobPage.resetFiltersButton')}
                </button>
            </div>

            <div className="bg-white rounded-lg shadow-md overflow-x-auto">
                {loading ? (
                    <div className="py-10 text-center"><Loader /></div>
                ) : jobs.length === 0 ? (
                    <p className="py-10 text-center text-gray-600">{t('jobPage.noJobsFound')}</p>
                ) : (
                    <table className="min-w-full divide-y divide-gray-200">
                        {/* Table Head remains the same, using sortBy and sortOrder */}
                        <thead className="bg-gray-50">
                           <tr>
                                <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSortChange('serviceType')}>{t('jobPage.serviceTypeLabel')} {sortBy === 'serviceType' && (sortOrder === 'asc' ? <ArrowUpIcon className="h-4 w-4 inline ml-1" /> : <ArrowDownIcon className="h-4 w-4 inline ml-1" />)}</th>
                                <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSortChange('customer.contactPersonName')}>{t('jobPage.customerLabel')} {sortBy === 'customer.contactPersonName' && (sortOrder === 'asc' ? <ArrowUpIcon className="h-4 w-4 inline ml-1" /> : <ArrowDownIcon className="h-4 w-4 inline ml-1" />)}</th>
                                <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSortChange('date')}>{t('jobPage.dateLabel')} {sortBy === 'date' && (sortOrder === 'asc' ? <ArrowUpIcon className="h-4 w-4 inline ml-1" /> : <ArrowDownIcon className="h-4 w-4 inline ml-1" />)}</th>
                                <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('jobPage.staffLabel')}</th>
                                <th className="py-3 px-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSortChange('price')}>{t('jobPage.priceLabel')} {sortBy === 'price' && (sortOrder === 'asc' ? <ArrowUpIcon className="h-4 w-4 inline ml-1" /> : <ArrowDownIcon className="h-4 w-4 inline ml-1" />)}</th>
                                <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('jobPage.statusLabel')}</th>
                                <th className="py-3 px-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{t('jobPage.actionsLabel')}</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {jobs.map(job => (
                                <tr key={job._id} className="hover:bg-gray-50">
                                    <td className="py-3 px-4 text-sm text-gray-900 font-medium">{job.serviceType}</td>
                                    <td className="py-3 px-4 text-sm text-gray-700">{job.customer?.contactPersonName || 'N/A'}</td>
                                    <td className="py-3 px-4 text-sm text-gray-700">{new Date(job.date).toLocaleDateString()} at {job.time}</td>
                                    <td className="py-3 px-4 text-sm text-gray-700">{job.staff?.map(s => s.contactPersonName).join(', ') || 'Unassigned'}</td>
                                    <td className="py-3 px-4 text-sm text-gray-700 text-right">{job.price}</td>
                                    <td className="py-3 px-4 text-sm">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                            job.status === 'Completed' || job.status === 'Invoice Paid' ? 'bg-green-100 text-green-800' :
                                            job.status === 'Booked' ? 'bg-blue-100 text-blue-800' :
                                            job.status === 'In Progress' || job.status === 'On Route' ? 'bg-yellow-100 text-yellow-800' :
                                            job.status === 'Cancelled' ? 'bg-red-100 text-red-800' :
                                            'bg-gray-100 text-gray-800'
                                        }`}>
                                            {job.status}
                                        </span>
                                    </td>
                                    <td className="py-3 px-4 text-right text-sm">
                                        <button onClick={() => handleViewDetails(job._id)} className="text-blue-600 hover:text-blue-800 mr-2">{t('jobPage.viewButton')}</button>
                                        <button onClick={() => handleEditJob(job)} className="text-indigo-600 hover:text-indigo-800">{t('jobPage.editButton')}</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Pagination Controls */}
            {!loading && jobs.length > 0 && (
                <div className="flex justify-between items-center mt-6 px-4 py-2 bg-white rounded-lg shadow-md">
                    <div>
                        {t('jobPage.showingResults', { start: (page - 1) * limit + 1, end: Math.min(page * limit, pagination.totalCount), total: pagination.totalCount })}
                    </div>
                    <div className="flex items-center space-x-2">
                        <label className="text-sm text-gray-700">{t('jobPage.rowsPerPage')}:</label>
                        <select value={limit} onChange={handleLimitChange} className="form-select border rounded-md text-sm py-1">
                            <option value="5">5</option>
                            <option value="10">10</option>
                            <option value="20">20</option>
                            <option value="50">50</option>
                        </select>
                        <button onClick={() => handlePageChange(page - 1)} disabled={page <= 1} className="p-1 rounded-full text-gray-600 hover:bg-gray-200 disabled:opacity-50">
                            <ChevronLeftIcon className="h-5 w-5" />
                        </button>
                        <span className="text-sm font-medium text-gray-700">{page} / {pagination.totalPages}</span>
                        <button onClick={() => handlePageChange(page + 1)} disabled={page >= pagination.totalPages} className="p-1 rounded-full text-gray-600 hover:bg-gray-200 disabled:opacity-50">
                            <ChevronRightIcon className="h-5 w-5" />
                        </button>
                    </div>
                </div>
            )}

            {/* Job Create/Edit Modal */}
            {isJobModalOpen && (
                <JobModal
                    isOpen={isJobModalOpen}
                    onClose={() => setIsJobModalOpen(false)}
                    onSave={handleJobSaved}
                    jobData={editingJob}
                    customers={customers}
                    staff={staff}
                />
            )}
        </div>
    );
};

export default JobsPage;


