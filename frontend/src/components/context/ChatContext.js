import React, { createContext, useState, useContext, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import chatService from '../../services/chatService';

const ChatContext = createContext(null);

export const ChatProvider = ({ children }) => {
    const { user, loading: authLoading } = useAuth();
    const [messages, setMessages] = useState([]);
    const [activeChatRecipient, setActiveChatRecipient] = useState(null);
    const [onlineUsers, setOnlineUsers] = useState([]);
    const socketRef = useRef(null);

    const currentUserId = user?._id;

    // Connect to socket and set up listeners
    useEffect(() => {
        // Only try to connect if authentication is complete AND we have a user
        if (!authLoading && user) {
            // --- FIX 1: Handle failed connection ---
            // connectSocket() will return null if no token is found.
            const newSocket = chatService.connectSocket();

            // Only proceed if the socket connection was successfully initiated
            if (newSocket) {
                socketRef.current = newSocket;

                // Listen for incoming messages
                socketRef.current.on('receiveMessage', (message) => {
                    console.log('[ChatContext] Received message:', message);
                    setMessages((prevMessages) => [...prevMessages, message]);
                });

                // Listen for updates to the list of online users
                socketRef.current.on('onlineUsers', (users) => {
                    console.log('[ChatContext] Online users:', users);
                    setOnlineUsers(users);
                });

                // Listen for the disconnect event
                socketRef.current.on('disconnect', () => {
                    console.log('[ChatContext] Socket disconnected');
                });

                // --- FIX 2: The 'userConnected' event is no longer needed. ---
                // The server now authenticates the user automatically via the JWT token.
                // We can remove the old 'connect' listener that was emitting this.

                // Clean up listeners when the component unmounts or user changes
                return () => {
                    if (socketRef.current) {
                        console.log('[ChatContext] Disconnecting socket on cleanup');
                        socketRef.current.off('receiveMessage');
                        socketRef.current.off('onlineUsers');
                        socketRef.current.off('disconnect');
                        chatService.disconnectSocket();
                        socketRef.current = null;
                    }
                };
            }
        } else if (!authLoading && !user && socketRef.current) {
            // If the user logs out, ensure the socket is disconnected
            chatService.disconnectSocket();
            socketRef.current = null;
        }
    }, [authLoading, user]); // Dependency array is now simpler

    const fetchChatHistory = useCallback(async (recipientId) => {
        if (!currentUserId || !recipientId) return;
        try {
            const history = await chatService.getChatHistory(currentUserId, recipientId);
            setMessages(history);
        } catch (error) {
            console.error('[ChatContext] Failed to fetch chat history:', error);
        }
    }, [currentUserId]);

    const selectChatRecipient = useCallback((recipientUser) => {
        setActiveChatRecipient(recipientUser);
        if (currentUserId && recipientUser?._id) {
            fetchChatHistory(recipientUser._id);
        } else {
            setMessages([]);
        }
    }, [currentUserId, fetchChatHistory]);

    const sendMessage = useCallback(async (content, recipientId) => {
        if (!socketRef.current || !content || !recipientId || !currentUserId) {
            return;
        }
        const messageData = {
            senderId: currentUserId,
            recipientId: recipientId,
            content: content,
            timestamp: new Date().toISOString(),
        };
        try {
            // Emit message to the server
            socketRef.current.emit('sendMessage', messageData);
            // Optimistically add message to the UI
            setMessages((prevMessages) => [...prevMessages, messageData]);
            // Save message to the database
            await chatService.saveMessage(messageData);
        } catch (error) {
            console.error('[ChatContext] Error sending message:', error);
        }
    }, [currentUserId]);

    const value = {
        messages,
        activeChatRecipient,
        selectChatRecipient,
        sendMessage,
        onlineUsers,
        chatLoading: authLoading
    };

    return (
        <ChatContext.Provider value={value}>
            {children}
        </ChatContext.Provider>
    );
};

export const useChat = () => {
    const context = useContext(ChatContext);
    if (context === undefined) {
        throw new Error('useChat must be used within a ChatProvider');
    }
    return context;
};
