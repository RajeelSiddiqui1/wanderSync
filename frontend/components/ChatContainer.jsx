"use client";

import { useState, useRef, useEffect } from "react";

function ChatContainer() {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [query, setQuery] = useState("");
  const responseBoxRef = useRef(null);

  // Auto-scroll
  useEffect(() => {
    if (responseBoxRef.current) {
      responseBoxRef.current.scrollTop = responseBoxRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  // Format text with bold, line breaks, and images
  const formatText = (text) => {
    let html = text
      .replace(/\*\*(.*?)\*\*/g, "<b>$1</b>") // bold
      .replace(/\n\n/g, "<br><br>")
      .replace(/\n/g, "<br>");

    html = html.replace(/!\[(.*?)\]\((.*?)\)/g, (match, caption, url) => {
      return `<div><img src="${url}" style="margin-top:12px;border-radius:10px;max-width:100%;height:auto;box-shadow:0 4px 12px rgba(0,0,0,0.4)"/><div style="font-size:0.9rem;color:#d8c3f5;margin-top:5px;">${caption}</div></div>`;
    });
    return html;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    setMessages((prev) => [...prev, { text: query, type: "user" }]);
    setIsLoading(true);

    try {
      const res = await fetch("http://127.0.0.1:5000/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();
      setIsLoading(false);
      setMessages((prev) => [...prev, { text: data.response, type: "bot" }]);
    } catch (err) {
      setIsLoading(false);
      setMessages((prev) => [
        ...prev,
        { text: `Error: ${err.message}`, type: "bot", isError: true },
      ]);
    }

    setQuery("");
  };

  return (
    <div className="flex flex-col w-full h-full p-6">
      <h1 className="text-center text-4xl font-extrabold text-[#bb86fc] mb-2 tracking-tight">
        🌍 WanderSync
      </h1>
      <p className="text-center text-[#d8c3f5] mb-6 font-medium">
        Your Premium AI-Powered Travel Assistant
      </p>

      <div
        ref={responseBoxRef}
        className="flex-1 overflow-y-auto p-6 bg-[#2e1a47] rounded-2xl border border-[#4a3375] mb-4 shadow-lg"
      >
        {messages.length === 0 && (
          <div className="text-center py-8 text-[#d8c3f5]">
            <p className="text-xl mb-2">Welcome to WanderSync! 🎉</p>
            <p>Ask me anything about travel destinations, itineraries, or recommendations.</p>
          </div>
        )}
        
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`p-4 mb-4 rounded-xl max-w-[85%] shadow-md break-words ${
              msg.type === "bot"
                ? "bg-[#3b2555] border-l-4 border-[#bb86fc] text-[#e8def8]"
                : "bg-[#4a3375] border-r-4 border-[#9575cd] text-[#e8def8] ml-auto"
            }`}
            dangerouslySetInnerHTML={{ __html: msg.type === "bot" ? formatText(msg.text) : msg.text }}
          />
        ))}

        {isLoading && (
          <div className="flex items-center gap-3 text-[#d8c3f5]">
            <div className="w-6 h-6 border-4 border-[#4a3375] border-t-[#bb86fc] rounded-full animate-spin"></div>
            <span>Crafting your luxury itinerary...</span>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-3 bg-[#2e1a47] p-4 rounded-2xl border border-[#4a3375] shadow-lg">
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Enter your travel query..."
          className="flex-1 bg-[#3b2555] border-none text-[#e8def8] p-4 rounded-xl h-16 resize-none focus:outline-none focus:ring-2 focus:ring-[#bb86fc] transition-all"
          required
        />
        <button
          type="submit"
          className="bg-[#bb86fc] text-white px-6 py-3 rounded-xl hover:bg-[#9f4fff] transition-colors font-semibold"
        >
          Send
        </button>
      </form>
    </div>
  );
}

export default ChatContainer;