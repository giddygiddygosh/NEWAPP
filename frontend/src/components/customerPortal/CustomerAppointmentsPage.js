import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import Loader from '../common/Loader';
import { toast } from 'react-toastify';

const CustomerAppointmentsPage = () => {
    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchAppointments = async () => {
            setLoading(true);
            setError(null);
            try {
                // Corrected API endpoint to match backend customer-portal route
                const res = await api.get('/customer-portal/jobs/upcoming'); // This matches your backend route
                setAppointments(res.data);
            } catch (err) {
                console.error("Error fetching customer appointments:", err.response?.data || err.message);
                setError(err.response?.data?.message || "Failed to load appointments.");
                toast.error("Failed to load appointments. Please try again later.");
            } finally {
                setLoading(false);
            }
        };
        fetchAppointments();
    }, []);

    return (
        <div className="customer-appointments-page p-8 bg-white rounded-lg shadow-md min-h-[calc(100vh-80px)]">
            <h2 className="text-3xl font-extrabold text-gray-900 mb-6 pb-4 border-b border-gray-200">Your Appointments</h2>
            {loading ? (
                <div className="flex justify-center items-center h-64">
                    <Loader /> <p className="ml-2 text-gray-600">Loading your appointments...</p>
                </div>
            ) : error ? (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm text-center">
                    {error}
                </div>
            ) : appointments.length === 0 ? (
                <div className="text-center py-10 border rounded-lg bg-gray-50 text-gray-600">
                    You have no upcoming appointments.
                </div>
            ) : (
                <div className="overflow-x-auto relative shadow-md sm:rounded-lg">
                    <table className="w-full text-sm text-left text-gray-500">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                            <tr>
                                <th scope="col" className="px-6 py-3">Job Title</th>
                                <th scope="col" className="px-6 py-3">Date</th>
                                <th scope="col" className="px-6 py-3">Time</th>
                                <th scope="col" className="px-6 py-3">Status</th>
                                <th scope="col" className="px-6 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {appointments.map((job) => (
                                <tr key={job._id} className="bg-white border-b hover:bg-gray-50">
                                    <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">{job.jobTitle || 'N/A'}</td>
                                    <td className="px-6 py-4">{new Date(job.jobDate).toLocaleDateString()}</td>
                                    <td className="px-6 py-4">{job.startTime || 'N/A'}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                            job.status === 'Scheduled' ? 'bg-blue-100 text-blue-800' :
                                            job.status === 'Completed' ? 'bg-green-100 text-green-800' :
                                            'bg-gray-100 text-gray-800'
                                        }`}>
                                            {job.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button className="font-medium text-blue-600 hover:text-blue-900 ml-2">View Details</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default CustomerAppointmentsPage;