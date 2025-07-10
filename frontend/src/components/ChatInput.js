// src/components/ChatInput.js

import React, { useState } from 'react';
import { PaperAirplaneIcon } from '@heroicons/react/24/solid'; // Example icon

const ChatInput = ({ onSendMessage, disabled }) => {
    const [message, setMessage] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (message.trim() && onSendMessage) {
            onSendMessage(message.trim());
            setMessage('');
        }
    };

    return (
        <form onSubmit={handleSubmit} className="flex p-4 border-t border-gray-200 bg-white">
            <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type your message..."
                className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
                disabled={disabled}
            />
            <button
                type="submit"
                className="ml-3 bg-sky-600 hover:bg-sky-700 text-white p-2 rounded-lg transition duration-200 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={disabled || !message.trim()}
            >
                <PaperAirplaneIcon className="h-6 w-6 transform rotate-90" />
            </button>
        </form>
    );
};

export default ChatInput;