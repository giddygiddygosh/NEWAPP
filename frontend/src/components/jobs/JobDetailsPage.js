import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom'; // To get the job ID from the URL
import api from '../../utils/api'; // Your API utility
import Loader from '../common/Loader'; // Your Loader component
import PaymentModal from '../common/PaymentModal'; // The Stripe Payment Modal
import { useCurrency } from '../context/CurrencyContext'; // For currency formatting
// Note: We're not including i18n (useTranslation) for now as per your request.
// All strings are hardcoded in English.

const JobDetailsPage = () => {
    const { jobId } = useParams(); // Retrieves jobId from the URL (e.g., /jobs/123)
    const { formatCurrency, currency } = useCurrency(); // Access currency formatting and code

    const [job, setJob] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    // State for the Payment Modal
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [paymentDetails, setPaymentDetails] = useState(null); // Stores details needed by PaymentModal

    // Function to fetch job details from the backend
    const fetchJobDetails = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await api.get(`/jobs/${jobId}`);
            setJob(res.data); // Set the fetched job data
        } catch (err) {
            console.error('Error fetching job details:', err);
            setError(err.response?.data?.message || 'Failed to load job details. Please try again.');
        } finally {
            setIsLoading(false);
        }
    }, [jobId]); // Dependency on jobId to refetch if URL changes

    // Effect hook to fetch job details when component mounts or jobId changes
    useEffect(() => {
        fetchJobDetails();
    }, [fetchJobDetails]); // Dependency on fetchJobDetails

    // Handler for the "Pay Deposit" button click
    const handlePayDepositClick = () => {
        if (!job) { // Should not happen if button is shown
            return;
        }

        const amountToPay = job.depositRequired - job.depositPaid;

        // Basic client-side check to ensure a valid amount is to be paid
        if (amountToPay <= 0 || job.depositStatus === 'Paid') {
            alert('Deposit is already fully paid or not required.'); // Replace with a more elegant notification
            return;
        }

        // Set the details to be passed to the PaymentModal
        setPaymentDetails({
            amount: amountToPay,
            currencyCode: currency.code, // Use the currency code from your CurrencyContext
            description: `Deposit payment for ${job.serviceType} job for ${job.customer?.contactPersonName || 'N/A customer'}.`,
            metadata: { // Custom metadata for Stripe, useful for tracking in your dashboard
                jobId: job._id,
                paymentType: 'job_deposit',
                totalJobPrice: job.price.toFixed(2), // Use job.price
                depositRequired: job.depositRequired.toFixed(2),
            }
        });
        setIsPaymentModalOpen(true); // Open the payment modal
    };

    // Callback function for when a payment is successfully completed via PaymentModal
    const handlePaymentSuccess = async (paymentIntent) => {
        console.log("Payment successful, updating job:", paymentIntent);
        setIsPaymentModalOpen(false); // Close the payment modal
        setPaymentDetails(null); // Clear payment details

        // Update the job record in your database with the payment information.
        // This is crucial to mark the deposit as paid.
        try {
            // The PaymentIntent.amount is in cents/pence, convert back to major currency unit.
            const newDepositPaidAmount = (paymentIntent.amount / 100);

            // Construct the data to send to your backend job update endpoint
            // We're adding to existing depositPaid, as it might be a partial payment
            const updatedJobData = {
                depositPaid: job.depositPaid + newDepositPaidAmount,
                depositPaymentIntentId: paymentIntent.id,
                // The depositStatus will be automatically updated by the Job schema's pre-save hook
                // based on depositRequired and new depositPaid amount.
            };

            // Send the update request to your backend
            // The response from updateJob should include the updated job document
            const res = await api.put(`/jobs/${job._id}`, updatedJobData);
            setJob(res.data.job); // Update the local job state with the refreshed job data from backend
            alert('Job deposit updated successfully!'); // Replace with a toast notification
        } catch (updateError) {
            console.error('Error updating job after payment:', updateError.response?.data || updateError.message);
            alert(`Failed to update job deposit status after payment. Error: ${updateError.response?.data?.message || updateError.message}`);
            // Implement more robust error handling (e.g., logging to a service, user notification)
        }
    };

    // Handler for closing the PaymentModal
    const handlePaymentModalClose = () => {
        setIsPaymentModalOpen(false);
        setPaymentDetails(null);
    };

    // --- Conditional Rendering for Loading, Error, and Job Not Found States ---
    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-screen">
                <Loader />
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-red-500 text-center p-8">
                <p>{error}</p>
                <button onClick={fetchJobDetails} className="mt-4 px-4 py-2 bg-blue-500 text-white rounded">Retry</button>
            </div>
        );
    }

    if (!job) {
        return (
            <div className="text-gray-600 text-center p-8">
                Job not found.
            </div>
        );
    }

    // Calculate remaining deposit to pay for display and button logic
    const remainingDeposit = job.depositRequired - job.depositPaid;
    const showPayDepositButton = job.depositRequired > 0 && remainingDeposit > 0 && job.depositStatus !== 'Paid';

    // --- Main Job Details Display ---
    return (
        <div className="p-8 bg-white rounded-lg shadow-xl">
            <h1 className="text-3xl font-bold mb-4">Job Details: {job.serviceType}</h1>
            <p>Customer: {job.customer?.contactPersonName}</p>
            <p>Date: {new Date(job.date).toLocaleDateString()}</p>
            <p>Time: {job.time}</p>
            <p>Status: {job.status}</p>
            <p>Total Job Price: {formatCurrency(job.price)}</p>

            <h2 className="text-2xl font-semibold mt-6 mb-3">Deposit Information</h2>
            <p>Deposit Required: {formatCurrency(job.depositRequired)}</p>
            <p>Deposit Paid: {formatCurrency(job.depositPaid)}</p>
            <p>Deposit Status: {job.depositStatus}</p>

            {showPayDepositButton && (
                <button
                    onClick={handlePayDepositClick}
                    className="mt-4 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 shadow-md"
                >
                    Pay Deposit ({formatCurrency(remainingDeposit)})
                </button>
            )}

            {/* The Stripe Payment Modal */}
            {isPaymentModalOpen && paymentDetails && (
                <PaymentModal
                    isOpen={isPaymentModalOpen}
                    onClose={handlePaymentModalClose}
                    amount={paymentDetails.amount}
                    currencyCode={paymentDetails.currencyCode}
                    description={paymentDetails.description}
                    metadata={paymentDetails.metadata}
                    onPaymentSuccess={handlePaymentSuccess}
                />
            )}
        </div>
    );
};

export default JobDetailsPage;