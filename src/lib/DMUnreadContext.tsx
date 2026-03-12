import React, { createContext, useContext, useState } from 'react';

interface DMUnreadContextType {
  dmUnreadCounts: Record<string, number>;
  setDmUnreadCounts: (counts: Record<string, number>) => void;
  totalDMUnread: number;
}

const DMUnreadContext = createContext<DMUnreadContextType | undefined>(undefined);

export const DMUnreadProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dmUnreadCounts, setDmUnreadCounts] = useState<Record<string, number>>({});
  
  const totalDMUnread = Object.values(dmUnreadCounts).reduce((sum, count) => sum + count, 0);

  return (
    <DMUnreadContext.Provider value={{ dmUnreadCounts, setDmUnreadCounts, totalDMUnread }}>
      {children}
    </DMUnreadContext.Provider>
  );
};

export const useDMUnread = () => {
  const context = useContext(DMUnreadContext);
  if (!context) {
    throw new Error('useDMUnread must be used within DMUnreadProvider');
  }
  return context;
};
