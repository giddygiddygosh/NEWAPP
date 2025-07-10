import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from './context/AuthContext';
import { useChat } from './context/ChatContext';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import Loader from './common/Loader';
import chatService from '../services/chatService'; // <-- Use the service
import {
    ShieldCheckIcon,
    ChatBubbleLeftRightIcon,
    UserCircleIcon
} from '@heroicons/react/24/outline';

const StaffChatView = () => {
    const { user, loading: authLoading } = useAuth();
    const {
        messages,
        activeChatRecipient,
        selectChatRecipient,
        sendMessage,
        onlineUsers, // This is an array of user IDs: ['id1', 'id2']
        currentUserId,
    } = useChat();

    const [adminList, setAdminList] = useState([]);
    const [loadingAdmins, setLoadingAdmins] = useState(true);
    const [adminError, setAdminError] = useState(null);
    const messagesEndRef = useRef(null);

    const isStaffOrManager = user?.role === 'staff' || user?.role === 'manager';

    // --- FIX 1: Use the centralized chatService to fetch the admin list ---
    const fetchAdminList = useCallback(async () => {
        if (!user?.company?._id) return; // Don't fetch if we don't know the company
        setLoadingAdmins(true);
        setAdminError(null);
        try {
            const allAdmins = await chatService.getAdminList();
            const loggedInUserCompanyId = user.company._id;
            
            // Filter admins to only show those from the same company
            const filteredAdmins = allAdmins.filter(adminUser =>
                adminUser && adminUser.company === loggedInUserCompanyId
            );

            setAdminList(filteredAdmins);

            if (filteredAdmins.length > 0 && !activeChatRecipient) {
                selectChatRecipient(filteredAdmins[0]);
            }
        } catch (err) {
            console.error("Error fetching admin list:", err);
            setAdminError("Failed to load admin list.");
        } finally {
            setLoadingAdmins(false);
        }
    }, [user, activeChatRecipient, selectChatRecipient]);

    useEffect(() => {
        if (isStaffOrManager && !authLoading) {
            fetchAdminList();
        }
    }, [isStaffOrManager, authLoading, fetchAdminList]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    if (authLoading) {
        return <div className="flex items-center justify-center min-h-[50vh]"><Loader /></div>;
    }

    if (!isStaffOrManager) {
        return <div className="p-8 text-center text-red-600">Access Denied.</div>;
    }

    // --- FIX 2: Correctly check if a user's ID is in the onlineUsers array ---
    const chatableAdmins = adminList
        .map(adminUser => ({
            ...adminUser,
            isOnline: onlineUsers.includes(adminUser._id),
        }))
        .filter(adminUser => adminUser._id !== currentUserId);

    return (
        <div className="flex h-[calc(100vh-120px)] bg-gray-100 rounded-lg shadow-lg overflow-hidden">
            {/* Left Sidebar: Admin List */}
            <div className="w-1/4 bg-white border-r border-gray-200 flex flex-col">
                <div className="p-4 border-b border-gray-200">
                    <h2 className="text-xl font-semibold text-gray-800 flex items-center">
                        <ShieldCheckIcon className="h-6 w-6 mr-2" /> Admins
                    </h2>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {loadingAdmins ? (
                        <div className="p-4 text-center text-gray-500"><Loader /></div>
                    ) : adminError ? (
                        <div className="p-4 text-red-500 text-center">{adminError}</div>
                    ) : (
                        <ul>
                            {chatableAdmins.map(adminUser => (
                                <li key={adminUser._id}>
                                    <button
                                        onClick={() => selectChatRecipient(adminUser)}
                                        className={`w-full text-left p-4 flex items-center justify-between hover:bg-gray-100 ${activeChatRecipient?._id === adminUser._id ? 'bg-sky-100' : ''}`}
                                    >
                                        <span className="flex items-center">
                                            <UserCircleIcon className="h-7 w-7 text-gray-500 mr-3" />
                                            <span>{adminUser.contactPersonName || adminUser.email}</span>
                                        </span>
                                        <span className={`h-2.5 w-2.5 rounded-full ${adminUser.isOnline ? 'bg-green-500' : 'bg-gray-400'}`}></span>
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
                        <p>Select an admin to start a conversation.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default StaffChatView;
