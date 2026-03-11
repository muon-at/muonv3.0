import React, { createContext, useState, useContext } from 'react';

interface ChatSidebarContextType {
  isChatSidebarOpen: boolean;
  setIsChatSidebarOpen: (isOpen: boolean) => void;
}

const ChatSidebarContext = createContext<ChatSidebarContextType | undefined>(undefined);

export const ChatSidebarProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isChatSidebarOpen, setIsChatSidebarOpen] = useState(false);

  return (
    <ChatSidebarContext.Provider value={{ isChatSidebarOpen, setIsChatSidebarOpen }}>
      {children}
    </ChatSidebarContext.Provider>
  );
};

export const useChatSidebar = () => {
  const context = useContext(ChatSidebarContext);
  if (!context) {
    throw new Error('useChatSidebar must be used within ChatSidebarProvider');
  }
  return context;
};
