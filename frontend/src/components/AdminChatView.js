import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from './context/AuthContext';
import { useChat } from './context/ChatContext';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import Loader from './common/Loader';
import chatService from '../services/chatService'; // <-- Use the service
import {
    UserCircleIcon,
    ChatBubbleLeftRightIcon,
    UsersIcon
} from '@heroicons/react/24/outline';

const AdminChatView = () => {
    const { user, loading: authLoading } = useAuth();
    const {
        messages,
        activeChatRecipient,
        selectChatRecipient,
        sendMessage,
        onlineUsers, // This is an array of user IDs: ['id1', 'id2']
        currentUserId,
    } = useChat();

    const [staffList, setStaffList] = useState([]);
    const [loadingStaff, setLoadingStaff] = useState(true);
    const [staffError, setStaffError] = useState(null);
    const messagesEndRef = useRef(null);

    const isAdmin = user?.role === 'admin';

    // --- FIX 1: Use the centralized chatService to fetch the staff list ---
    const fetchStaffList = useCallback(async () => {
        setLoadingStaff(true);
        setStaffError(null);
        try {
            const staffData = await chatService.getStaffList();
            const validStaffList = staffData.filter(staff => staff && staff._id);
            setStaffList(validStaffList);
        } catch (err) {
            console.error("Error fetching staff list:", err);
            setStaffError("Failed to load staff list.");
        } finally {
            setLoadingStaff(false);
        }
    }, []);

    useEffect(() => {
        if (isAdmin && !authLoading) {
            fetchStaffList();
        }
    }, [isAdmin, authLoading, fetchStaffList]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    if (authLoading) {
        return <div className="flex items-center justify-center min-h-[50vh]"><Loader /></div>;
    }

    if (!isAdmin) {
        return <div className="p-8 text-center text-red-600">Access Denied.</div>;
    }

    // --- FIX 2: Correctly check if a user's ID is in the onlineUsers array ---
    const chatableStaff = staffList
        .map(staff => ({
            ...staff,
            isOnline: onlineUsers.includes(staff._id),
        }))
        .filter(staff => staff._id && staff._id !== currentUserId);

    return (
        <div className="flex h-[calc(100vh-120px)] bg-gray-100 rounded-lg shadow-lg overflow-hidden">
            {/* Left Sidebar: Staff List */}
            <div className="w-1/4 bg-white border-r border-gray-200 flex flex-col">
                <div className="p-4 border-b border-gray-200">
                    <h2 className="text-xl font-semibold text-gray-800 flex items-center">
                        <UsersIcon className="h-6 w-6 mr-2" /> Staff Members
                    </h2>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {loadingStaff ? (
                        <div className="p-4 text-center text-gray-500"><Loader /></div>
                    ) : staffError ? (
                        <div className="p-4 text-red-500 text-center">{staffError}</div>
                    ) : (
                        <ul>
                            {chatableStaff.map(staff => (
                                <li key={staff._id}>
                                    <button
                                        onClick={() => selectChatRecipient(staff)}
                                        className={`w-full text-left p-4 flex items-center justify-between hover:bg-gray-100 ${activeChatRecipient?._id === staff._id ? 'bg-sky-100' : ''}`}
                                    >
                                        <span className="flex items-center">
                                            <UserCircleIcon className="h-7 w-7 text-gray-500 mr-3" />
                                            <span>{staff.contactPersonName || staff.email}</span>
                                        </span>
                                        <span className={`h-2.5 w-2.5 rounded-full ${staff.isOnline ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>

            {/* Right Panel: Chat Area */}
            <div className="flex-1 flex flex-col bg-gray-50">
                {activeChatRecipient ? (
                    <>
                        <div className="p-4 border-b bg-white">
                            <h2 className="text-xl font-semibold flex items-center">
                                Chat with {activeChatRecipient.contactPersonName}
                            </h2>
                        </div>
                        <div className="flex-1 p-6 overflow-y-auto flex flex-col-reverse">
                            <div ref={messagesEndRef} />
                            {messages.slice().reverse().map((msg, index) => (
                                <ChatMessage
                                    key={msg._id || index}
                                    message={msg}
                                    isCurrentUser={msg.senderId === currentUserId}
                                />
                            ))}
                        </div>
                        <ChatInput
                            onSendMessage={(text) => sendMessage(text, activeChatRecipient._id)}
                        />
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
                        <ChatBubbleLeftRightIcon className="w-48 h-48 text-gray-300" />
                        <p>Select a staff member to chat.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminChatView;
