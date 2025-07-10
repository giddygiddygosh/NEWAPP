// backend/models/ChatMessage.js

const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
    senderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // References the User model
        required: true,
        index: true // Index for faster query performance
    },
    recipientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // References the User model
        required: true,
        index: true // Index for faster query performance
    },
    content: {
        type: String,
        required: true,
        trim: true
    },
    timestamp: {
        type: Date,
        default: Date.now,
        index: true // Index for sorting messages by time
    },
    read: { // Optional: for read receipts
        type: Boolean,
        default: false
    }
}, {
    timestamps: true // Adds createdAt and updatedAt fields
});

// Optional: Compound index for efficient chat history retrieval
// This index helps when querying for messages between two specific users, regardless of who sent first.
chatMessageSchema.index({ senderId: 1, recipientId: 1, timestamp: 1 });
chatMessageSchema.index({ recipientId: 1, senderId: 1, timestamp: 1 });


const ChatMessage = mongoose.model('ChatMessage', chatMessageSchema);

module.exports = ChatMessage;