// src/hooks/useChat.js

import { useContext } from 'react';
// This is the correct path given your context folder is inside 'src/components'
import { ChatContext } from '../components/context/ChatContext';

export const useChat = () => {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};