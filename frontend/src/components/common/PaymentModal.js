import React, { useState, useEffect } from 'react';
import {
    Elements,
    PaymentElement,
    useStripe,
    useElements,
} from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import Modal from './Modal';
import Loader from './Loader';
import api from '../../utils/api';
import { useCurrency } from '../context/CurrencyContext';

// Load Stripe outside of the component render to avoid recreating the Stripe object on every render.
// Make sure your publishable key is in your .env file, e.g., REACT_APP_STRIPE_PUBLISHABLE_KEY
const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY);


// --- New CheckoutForm Component ---
// This component contains the actual form and is wrapped by the <Elements> provider.
const CheckoutForm = ({ onProcessing, onResult }) => {
    const stripe = useStripe();
    const elements = useElements();

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!stripe || !elements) {
            // Stripe.js has not yet loaded.
            return;
        }

        onProcessing(true); // Tell the parent modal we are processing payment

        const { error, paymentIntent } = await stripe.confirmPayment({
            elements,
            confirmParams: {
                // Make sure to change this to your payment completion page
                return_url: `${window.location.origin}/payment-success`,
            },
            redirect: 'if_required',
        });

        if (error) {
            // This will handle card errors (e.g., CVC incorrect) or other confirmation errors.
            onResult({ error: error.message });
        } else if (paymentIntent && paymentIntent.status === 'succeeded') {
            onResult({ success: "Payment successful!", paymentIntent });
        } else {
            onResult({ error: "Payment processing or failed. Please check your transaction history." });
        }

        onProcessing(false);
    };

    return (
        <form onSubmit={handleSubmit} id="payment-form">
            <PaymentElement id="payment-element" options={{ layout: "tabs" }} />
            {/* The submit button is now rendered in the parent modal */}
        </form>
    );
};


// --- Main PaymentModal Component ---
const PaymentModal = ({ isOpen, onClose, amount, currencyCode, description, metadata, onPaymentSuccess }) => {
    const { formatCurrency } = useCurrency();

    const [isLoading, setIsLoading] = useState(true); // For fetching the client secret
    const [isProcessing, setIsProcessing] = useState(false); // For when payment is being confirmed
    const [message, setMessage] = useState(null);
    const [clientSecret, setClientSecret] = useState(null);

    // Effect 1: Fetch Payment Intent (clientSecret) when the modal opens
    useEffect(() => {
        if (!isOpen || !amount || !currencyCode) {
            return;
        }
        setIsLoading(true);
        setMessage(null);

        api.post('/stripe/create-payment-intent', {
            amount, currency: currencyCode, description, metadata
        })
        .then(res => {
            setClientSecret(res.data.clientSecret);
        })
        .catch(err => {
            setMessage(err.response?.data?.message || 'Failed to load payment form. Please try again.');
        })
        .finally(() => {
            setIsLoading(false);
        });

    }, [isOpen, amount, currencyCode, description, metadata]);

    // This function receives the result from the CheckoutForm
    const handlePaymentResult = ({ success, error, paymentIntent }) => {
        if (success) {
            setMessage(success);
            if (onPaymentSuccess) {
                onPaymentSuccess(paymentIntent);
            }
            setTimeout(() => onClose(), 1500);
        } else if (error) {
            setMessage(error);
        }
    };
    
    if (!isOpen) return null;

    const appearance = { theme: 'stripe' };
    const options = { clientSecret, appearance };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Make Payment (${formatCurrency(amount, currencyCode)})`} maxWidthClass="max-w-md">
            <div className="p-6 space-y-6">
                {isLoading && (
                    <div className="p-8 text-center"><Loader /><p className="mt-2">Loading...</p></div>
                )}
                
                {/* Once the clientSecret is fetched, render the Elements provider and the form */}
                {clientSecret && (
                    <Elements options={options} stripe={stripePromise}>
                        <CheckoutForm onProcessing={setIsProcessing} onResult={handlePaymentResult} />
                    </Elements>
                )}
                
                {/* Message display for errors or success notifications */}
                {message && (
                    <div className={`p-3 mt-4 rounded-md text-sm ${message.includes('successful') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {message}
                    </div>
                )}
                
                {/* Action buttons are now here */}
                <div className="flex justify-end space-x-4 pt-4">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
                        disabled={isProcessing}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        form="payment-form" // This targets the form inside CheckoutForm
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                        // Disable button if form is not loaded or payment is processing
                        disabled={!clientSecret || isProcessing || isLoading}
                    >
                        {isProcessing ? 'Processing...' : 'Pay Now'}
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default PaymentModal;

