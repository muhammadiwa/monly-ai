import React, { useState } from 'react';
import { ChatWidget, ChatFAB } from '@/pages/chat-ai';

export default function GlobalChat() {
  const [isChatOpen, setIsChatOpen] = useState(false);

  return (
    <>
      {isChatOpen ? (
        <ChatWidget isOpen={isChatOpen} onToggle={() => setIsChatOpen(false)} />
      ) : (
        <ChatFAB onClick={() => setIsChatOpen(true)} />
      )}
    </>
  );
}
