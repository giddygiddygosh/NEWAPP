// src/components/staffPortal/JobDetailsModal.js

import React, { useState, useCallback } from 'react';
import Modal from '../common/Modal'; // Assuming you have a generic Modal component
// FIX: Added ListChecks and Image to the lucide-react import
import { Check, X, Upload, Trash2, Loader as LoaderIcon, ListChecks, Image } from 'lucide-react';
import api from '../../utils/api';
import { format } from 'date-fns';

const JobDetailsModal = ({ isOpen, onClose, job, onJobUpdated, onActionError }) => {
    const [actionLoading, setActionLoading] = useState(null); // For task/photo actions
    const [photoFile, setPhotoFile] = useState(null);
    const [photoLabel, setPhotoLabel] = useState('');
    const [photoType, setPhotoType] = useState('other'); // 'before', 'after', 'other'

    // Reset form fields when modal opens/closes
    React.useEffect(() => {
        if (!isOpen) {
            setPhotoFile(null);
            setPhotoLabel('');
            setPhotoType('other');
            setActionLoading(null);
        }
    }, [isOpen]);

    const handleTaskToggle = useCallback(async (taskId, currentStatus) => {
        setActionLoading(`task-${taskId}`);
        onActionError(null);
        try {
            const res = await api.put(`/jobs/${job._id}/tasks/${taskId}`, { isCompleted: !currentStatus });
            onJobUpdated(res.data.job); // Update job in parent state
        } catch (err) {
            console.error("Error updating task:", err);
            onActionError(err.response?.data?.message || 'Failed to update task.');
        } finally {
            setActionLoading(null);
        }
    }, [job._id, onJobUpdated, onActionError]);

    const handlePhotoFileChange = (e) => {
        setPhotoFile(e.target.files[0]);
    };

    const handlePhotoUpload = useCallback(async () => {
        if (!photoFile || !photoLabel) {
            onActionError('Please select a photo and provide a label.');
            return;
        }

        setActionLoading('uploadPhoto');
        onActionError(null);

        try {
            // In a real application, you would upload the file to a cloud storage
            // like Firebase Storage, AWS S3, or Cloudinary, and get a URL back.
            // For this example, we'll simulate an upload and use a placeholder URL.
            // You'll need to implement actual file upload logic to your backend/storage.

            // Placeholder URL for demonstration
            const uploadedUrl = `https://placehold.co/600x400/000000/FFFFFF/png?text=${photoLabel.replace(/\s/g, '+')}`;

            const res = await api.post(`/jobs/${job._id}/photos`, {
                url: uploadedUrl,
                label: photoLabel,
                type: photoType,
            });
            onJobUpdated(res.data.job); // Update job in parent state
            setPhotoFile(null);
            setPhotoLabel('');
            setPhotoType('other');
            alert('Photo uploaded successfully!'); // Use custom modal/toast
        } catch (err) {
            console.error("Error uploading photo:", err);
            onActionError(err.response?.data?.message || 'Failed to upload photo.');
        } finally {
            setActionLoading(null);
        }
    }, [job._id, photoFile, photoLabel, photoType, onJobUpdated, onActionError]);

    if (!job) return null; // Don't render if no job is provided

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Details for ${job.serviceType}`} maxWidth="2xl">
            <div className="p-6 overflow-y-auto max-h-[70vh]">
                <h3 className="text-xl font-bold text-gray-800 mb-4">{job.serviceType}</h3>
                <p className="text-gray-600 mb-2">Customer: {job.customer?.contactPersonName}</p>
                <p className="text-gray-600 mb-2">Address: {job.address.street}, {job.address.city}</p>
                <p className="text-gray-600 mb-2">Date: {format(new Date(job.date), 'dd/MM/yyyy')} at {job.time}</p>
                <p className="text-gray-600 mb-4">Status: {job.status}</p>

                {/* Clock In/Out Times */}
                {job.clockInTime && (
                    <p className="text-sm text-gray-600 mt-2">
                        Clocked In: {format(new Date(job.clockInTime), 'hh:mm a (dd/MM)')}
                    </p>
                )}
                {job.clockOutTime && (
                    <p className="text-sm text-gray-600">
                        Clocked Out: {format(new Date(job.clockOutTime), 'hh:mm a (dd/MM)')}
                    </p>
                )}

                {/* Task List */}
                <div className="mt-6 border-t pt-4">
                    <h4 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
                        <ListChecks size={20} className="mr-2" /> Task List
                    </h4>
                    {job.tasks && job.tasks.length > 0 ? (
                        <div className="space-y-3">
                            {job.tasks.map(task => (
                                <div key={task.taskId} className="flex items-center bg-gray-50 p-3 rounded-lg border border-gray-100">
                                    <input
                                        type="checkbox"
                                        checked={task.isCompleted}
                                        onChange={() => handleTaskToggle(task.taskId, task.isCompleted)}
                                        className="form-checkbox h-5 w-5 text-blue-600 rounded-md cursor-pointer"
                                        disabled={actionLoading === `task-${task.taskId}`}
                                    />
                                    <span className={`ml-3 text-gray-700 ${task.isCompleted ? 'line-through text-gray-500' : ''}`}>
                                        {task.description}
                                    </span>
                                    {actionLoading === `task-${task.taskId}` && <LoaderIcon size={16} className="animate-spin ml-2 text-blue-500" />}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-gray-500">No specific tasks listed for this job.</p>
                    )}
                </div>

                {/* Photo Upload Section */}
                <div className="mt-6 border-t pt-4">
                    <h4 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
                        <Image size={20} className="mr-2" /> Job Photos
                    </h4>
                    <div className="mb-4">
                        <input
                            type="file"
                            accept="image/*"
                            onChange={handlePhotoFileChange}
                            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                        />
                        <input
                            type="text"
                            placeholder="Photo Label (e.g., Before, After, Damaged Part)"
                            value={photoLabel}
                            onChange={(e) => setPhotoLabel(e.target.value)}
                            className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <select
                            value={photoType}
                            onChange={(e) => setPhotoType(e.target.value)}
                            className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="other">Other</option>
                            <option value="before">Before</option>
                            <option value="after">After</option>
                        </select>
                        <button
                            onClick={handlePhotoUpload}
                            disabled={actionLoading === 'uploadPhoto' || !photoFile || !photoLabel}
                            className="mt-3 flex items-center px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {actionLoading === 'uploadPhoto' ? <LoaderIcon size={18} className="animate-spin mr-2" /> : <Upload size={18} className="mr-2" />}
                            Upload Photo
                        </button>
                    </div>

                    {job.photos && job.photos.length > 0 ? (
                        <div className="grid grid-cols-2 gap-4 mt-4">
                            {job.photos.map((photo, index) => (
                                <div key={index} className="border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                                    <img src={photo.url} alt={photo.label} className="w-full h-32 object-cover" />
                                    <div className="p-2 text-sm">
                                        <p className="font-semibold">{photo.label}</p>
                                        <p className="text-gray-500">{photo.type} - {format(new Date(photo.uploadedAt), 'dd/MM/yy hh:mm a')}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-gray-500">No photos uploaded for this job yet.</p>
                    )}
                </div>
            </div>
            <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3 rounded-b-xl border-t border-gray-100 shrink-0">
                <button
                    type="button"
                    onClick={onClose}
                    className="px-5 py-2 rounded-lg text-gray-700 bg-gray-200 hover:bg-gray-300 transition-colors"
                >
                    Close
                </button>
            </div>
        </Modal>
    );
};

export default JobDetailsModal;
