import React, { createContext, useContext, useState } from 'react';

interface ChannelUnreadContextType {
  channelUnreadCounts: Record<string, number>;
  setChannelUnreadCounts: (counts: Record<string, number>) => void;
}

const ChannelUnreadContext = createContext<ChannelUnreadContextType | undefined>(undefined);

export const ChannelUnreadProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [channelUnreadCounts, setChannelUnreadCounts] = useState<Record<string, number>>({});

  return (
    <ChannelUnreadContext.Provider value={{ channelUnreadCounts, setChannelUnreadCounts }}>
      {children}
    </ChannelUnreadContext.Provider>
  );
};

export const useChannelUnread = () => {
  const context = useContext(ChannelUnreadContext);
  if (!context) {
    throw new Error('useChannelUnread must be used within ChannelUnreadProvider');
  }
  return context;
};
