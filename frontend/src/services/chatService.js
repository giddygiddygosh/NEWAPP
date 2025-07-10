import io from 'socket.io-client';
import api from '../utils/api';

// The URL should point to your main backend server where Socket.IO is now running.
const SOCKET_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5004';

let socket = null;

const chatService = {
    // Connects to the Socket.IO server with authentication
    connectSocket: () => {
        if (socket) {
            return socket;
        }
        const token = localStorage.getItem('token');
        if (!token) {
            console.error("Chat Service: No token found, cannot connect to WebSocket.");
            return null;
        }
        socket = io(SOCKET_URL, {
            auth: {
                token: `Bearer ${token}`
            },
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            transports: ['websocket'],
        });
        socket.on('connect', () => {
            console.log('✅ Successfully connected to WebSocket server with authentication.');
        });
        socket.on('connect_error', (err) => {
            console.error('❌ WebSocket connection error:', err.message);
        });
        return socket;
    },

    disconnectSocket: () => {
        if (socket) {
            socket.disconnect();
            socket = null;
        }
    },

    // --- ADDED: Fetches the list of staff and managers for the chat ---
    getStaffList: async () => {
        try {
            // This endpoint was created in the backend chatRoutes.js
            const response = await api.get('/chat/staff'); 
            return response.data;
        } catch (error) {
            console.error('Error fetching staff list:', error);
            throw error;
        }
    },

    // --- ADDED: Fetches the list of admins for the chat ---
    getAdminList: async () => {
        try {
            const response = await api.get('/users/roles/admin');
            return response.data;
        } catch (error) {
            console.error('Error fetching admin list:', error);
            throw error;
        }
    },

    getChatHistory: async (userId1, userId2) => {
        try {
            const response = await api.get(`/chat/history?user1=${userId1}&user2=${userId2}`);
            return response.data;
        } catch (error) {
            console.error('Error fetching chat history:', error);
            throw error;
        }
    },

    saveMessage: async (messageData) => {
        try {
            const response = await api.post('/chat/messages', messageData);
            return response.data;
        } catch (error) {
            console.error('Error saving message:', error);
            throw error;
        }
    },
};

export default chatService;

