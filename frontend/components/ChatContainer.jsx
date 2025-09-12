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
      return `<div><img src="${url}" style="margin-top:12px;border-radius:10px;max-width:100%;height:auto;box-shadow:0 4px 12px rgba(0,0,0,0.4)"/><div style="font-size:0.9rem;color:#ccc;margin-top:5px;">${caption}</div></div>`;
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
    <div className="flex flex-col max-w-3xl w-full p-5 h-screen mx-auto bg-[#121212]">
      <h1 className="text-center text-3xl font-bold text-pink-500 mb-2">🌍 WanderSync</h1>
      <p className="text-center text-gray-400 mb-5">Your premium AI-powered travel assistant</p>

      <div
        ref={responseBoxRef}
        className="flex-1 overflow-y-auto p-5 bg-gray-800 rounded-xl border border-gray-700 mb-4"
      >
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`p-3 mb-3 rounded-lg max-w-[80%] shadow-md break-words ${
              msg.type === "bot" ? "bg-[#222] border-l-4 border-pink-500 text-left" : "bg-[#333] border-r-4 border-green-500 text-right ml-auto"
            }`}
            dangerouslySetInnerHTML={{ __html: msg.type === "bot" ? formatText(msg.text) : msg.text }}
          />
        ))}

        {isLoading && (
          <div className="flex items-center gap-3 text-gray-400">
            <div className="w-6 h-6 border-4 border-gray-700 border-t-pink-500 rounded-full animate-spin"></div>
            <span>Crafting your luxury itinerary...</span>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-3 bg-gray-800 p-3 rounded-xl border border-gray-700">
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Enter your travel query..."
          className="flex-1 bg-gray-800 border-none text-white p-3 rounded-lg h-16 resize-none focus:outline-none"
          required
        />
        <button
          type="submit"
          className="bg-pink-500 text-white px-6 py-3 rounded-lg hover:bg-pink-600 transition-colors"
        >
          Send
        </button>
      </form>
    </div>
  );
}

export default ChatContainer;
