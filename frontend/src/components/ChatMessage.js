// src/components/ChatMessage.js

import React from 'react';
import { format } from 'date-fns';

const ChatMessage = ({ message, isCurrentUser }) => {
    const messageClasses = isCurrentUser
        ? "bg-sky-600 text-white self-end rounded-bl-lg"
        : "bg-gray-200 text-gray-800 self-start rounded-br-lg";

    const bubbleClasses = "p-3 max-w-[70%] break-words shadow-sm rounded-t-lg";

    const senderName = message.senderName || 'Unknown User';

    return (
        <div className={`flex flex-col mb-3 ${isCurrentUser ? 'items-end' : 'items-start'}`}>
            {!isCurrentUser && (
                <div className="text-xs text-gray-500 mb-1 px-1">
                    {senderName}
                </div>
            )}
            <div className={`${bubbleClasses} ${messageClasses}`}>
                <p className="text-sm">{message.content}</p>
                <span className="block text-right text-xs mt-1 opacity-75">
                    {message.timestamp ? format(new Date(message.timestamp), 'hh:mm a') : ''}
                </span>
            </div>
        </div>
    );
};

export default ChatMessage;