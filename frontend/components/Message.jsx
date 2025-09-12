"use client"

import { useState } from 'react';
import InputForm from './InputForm';
import Message from './Message';

function ChatContainer() {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (query) => {
    if (!query.trim()) return;

    // Add user message
    setMessages((prev) => [...prev, { text: query, type: 'user' }]);

    // Show loader
    setIsLoading(true);

    try {
      const res = await fetch('http://127.0.0.1:5000/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });

      const data = await res.json();
      setIsLoading(false);

      // Add bot message
      setMessages((prev) => [...prev, { text: data.response, type: 'bot' }]);
    } catch (err) {
      setIsLoading(false);
      setMessages((prev) => [
        ...prev,
        { text: `Error: ${err.message}`, type: 'bot', isError: true },
      ]);
    }
  };

  return (
    <div className="max-w-3xl w-full p-5 flex flex-col flex-1">
      <h1 className="text-center text-3xl font-bold text-purple-400 mb-2">
        🌍 WanderSync
      </h1>
      <p className="text-center text-gray-400 mb-5">
        Your premium AI-powered travel assistant
      </p>
      <div
        className="flex-1 overflow-y-auto p-5 bg-gray-800 rounded-xl border border-gray-700 mb-4"
        id="responseBox"
      >
        {messages.map((msg, index) => (
          <Message key={index} text={msg.text} type={msg.type} isError={msg.isError} />
        ))}
        {isLoading && (
          <div className="flex items-center gap-3 text-gray-400">
            <div className="w-6 h-6 border-4 border-gray-700 border-t-purple-400 rounded-full animate-spin"></div>
            <span>Crafting your luxury itinerary...</span>
          </div>
        )}
      </div>
      <InputForm onSubmit={handleSubmit} />
    </div>
  );
}

export default ChatContainer;