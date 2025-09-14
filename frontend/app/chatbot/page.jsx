"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Image, Mic, Download, Menu, X, MoreVertical, Copy } from "lucide-react";
import { Sidebar } from "../../components/sidebar";
import { useRouter } from "next/navigation";
import { jsPDF } from "jspdf";

export default function ChatPage() {
  const router = useRouter();
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const audioChunksRef = useRef([]);
  const [mode, setMode] = useState("plan");

  useEffect(() => {
    const token = localStorage.getItem("jwtToken");
    if (!token) router.push("/login");
  }, [router]);

  useEffect(() => {
    const history = JSON.parse(localStorage.getItem("chatHistory") || "[]");
    if (history.length) setMessages(history);
    else
      setMessages([
        {
          id: 1,
          content: "Yo! I'm your AI travel assistant. Where you headed today?",
          sender: "bot",
          timestamp: new Date(),
        },
      ]);
  }, []);

  useEffect(() => {
    localStorage.setItem("chatHistory", JSON.stringify(messages));
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
  const toggleDropdown = () => setIsDropdownOpen(!isDropdownOpen);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && (file.type.startsWith("image/") || file.type.startsWith("audio/")))
      setSelectedFile(file);
    else setSelectedFile(null);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      setMediaRecorder(recorder);
      audioChunksRef.current = [];
      recorder.start();
      setIsRecording(true);
      recorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        setSelectedFile(new File([audioBlob], "voice-recording.webm", { type: "audio/webm" }));
      };
    } catch {
      setSelectedFile(null);
    }
  };

  const stopRecording = () => {
    if (mediaRecorder) {
      mediaRecorder.stop();
      setIsRecording(false);
    }
  };

  const newChat = () => {
    setMessages([]);
    setInputValue("");
    setSelectedFile(null);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputValue.trim() && !selectedFile) return;
    if (isLoading) return;

    const userMessage = {
      id: Date.now(),
      content: inputValue || (selectedFile ? `Sent an audio file: ${selectedFile.name}` : ""),
      sender: "user",
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    try {
      let endpoint = "";
      if (mode === "plan") endpoint = "http://127.0.0.1:5000/chat";
      else if (mode === "search") endpoint = "http://127.0.0.1:5000/search";
      else endpoint = "http://127.0.0.1:5000/conversion_chat";

      let res;
      if (selectedFile && selectedFile.type.startsWith("audio/")) {
        const formData = new FormData();
        formData.append("audio", selectedFile);
        res = await fetch(endpoint, { method: "POST", body: formData });
      } else {
    const token = localStorage.getItem("jwtToken");
    const userId = localStorage.getItem("user_id"); // ✅ yahan se direct get karo

        res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: inputValue,user_id:userId }),
          
        });
      }

      const data = await res.json();
      console.log(data);
      
      const botResponse = {
        id: Date.now() + 1,
        content:
          mode === "plan"
            ? data.response || "Something went wrong!"
            : mode === "search"
            ? data.results?.[0]?.response || "No match found in knowledge base."
            : data.response || "Something went wrong!",
        sender: "bot",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botResponse]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { id: Date.now() + 1, content: `Error: ${err.message}`, sender: "bot", timestamp: new Date() },
      ]);
    } finally {
      setIsLoading(false);
      setSelectedFile(null);
    }
  };

  const sanitizeText = (text) => (typeof text === "string" ? text.replace(/[^a-zA-Z0-9\s.,!?]/g, "") : "");

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  const downloadSingleMessageAsPDF = (message) => {
    const doc = new jsPDF();
    const sender = message.sender === "user" ? "You" : "AI";
    const time = formatTime(message.timestamp);
    const content = sanitizeText(message.content);
    const lines = doc.splitTextToSize(content, 180);
    doc.setFontSize(12);
    doc.text(`${sender} (${time}):`, 20, 20);
    let y = 30;
    doc.setFontSize(10);
    lines.forEach((line) => {
      doc.text(line, 20, y);
      y += 7;
    });
    doc.save(`message-${message.id}.pdf`);
  };

  const downloadAsPDF = () => {
    const doc = new jsPDF();
    let y = 20;
    messages.forEach((msg) => {
      const sender = msg.sender === "user" ? "You" : "AI";
      const time = formatTime(msg.timestamp);
      const lines = doc.splitTextToSize(sanitizeText(msg.content), 180);
      if (y + lines.length * 7 > 280) {
        doc.addPage();
        y = 20;
      }
      doc.setFontSize(12);
      doc.text(`${sender} (${time}):`, 20, y);
      y += 10;
      doc.setFontSize(10);
      lines.forEach((line) => {
        if (y > 280) {
          doc.addPage();
          y = 20;
        }
        doc.text(line, 20, y);
        y += 7;
      });
      y += 5;
    });
    doc.save("chat-conversation.pdf");
  };

  const formatText = (text) =>
    text
      .replace(/\*\*(.*?)\*\*/g, "<b>$1</b>")
      .replace(/\n\n/g, "<br><br>")
      .replace(/\n/g, "<br>")
      .replace(
        /!\[(.*?)\]\((.*?)\)/g,
        (m, c, u) => `<div><a href="${u}" class="text-blue-400 hover:underline">${c}</a></div>`
      );

  const formatTime = (date) => {
    const d = new Date(date);
    if (isNaN(d)) return "";
    return new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit" }).format(d);
  };

  return (
    <div className="flex h-screen bg-[#0a0e1a] text-[#d9e1ff] font-sans">
      <Sidebar isOpen={isSidebarOpen} toggleSidebar={toggleSidebar} />
      <div className="flex-1 md:ml-64 flex flex-col w-full p-6">
        <div className="flex justify-between items-center mb-4 relative">
          <button
            onClick={toggleSidebar}
            className="md:hidden fixed top-4 left-4 z-50 p-2 bg-[#12172b] text-[#4a90e2] rounded-xl shadow-lg hover:bg-[#1e2742] transition-colors"
          >
            {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
          <div className="relative ml-auto">
            <button
              onClick={toggleDropdown}
              className="p-2 bg-[#12172b] text-[#4a90e2] rounded-xl shadow-lg hover:bg-[#1e2742] transition-colors"
            >
              <MoreVertical size={24} />
            </button>
            {isDropdownOpen && (
              <div className="absolute top-12 right-0 bg-[#12172b] border border-[#2a3457] rounded-xl shadow-xl z-50 p-3 w-48">
                <button
                  onClick={() => {
                    newChat();
                    setIsDropdownOpen(false);
                  }}
                  className="w-full text-left p-2 bg-[#1e2742] text-[#4a90e2] rounded-lg hover:bg-[#2a3457] transition-colors mb-2 flex items-center gap-2"
                >
                  <span>New Chat</span>
                </button>
                <button
                  onClick={() => {
                    downloadAsPDF();
                    setIsDropdownOpen(false);
                  }}
                  className="w-full text-left p-2 bg-[#1e2742] text-[#4a90e2] rounded-lg hover:bg-[#2a3457] transition-colors mb-2 flex items-center gap-2"
                >
                  <Download size={20} />
                  <span>Download All</span>
                </button>
                <button
                  onClick={() => {
                    setMode("plan");
                    setIsDropdownOpen(false);
                  }}
                  className={`w-full text-left p-2 rounded-lg transition-colors ${
                    mode === "plan" ? "bg-[#4a90e2] text-[#0a0e1a]" : "bg-[#1e2742] text-[#4a90e2] hover:bg-[#2a3457]"
                  } mb-2`}
                >
                  Plan
                </button>
                <button
                  onClick={() => {
                    setMode("search");
                    setIsDropdownOpen(false);
                  }}
                  className={`w-full text-left p-2 rounded-lg transition-colors ${
                    mode === "search" ? "bg-[#4a90e2] text-[#0a0e1a]" : "bg-[#1e2742] text-[#4a90e2] hover:bg-[#2a3457]"
                  } mb-2`}
                >
                  Search
                </button>
                <button
                  onClick={() => {
                    setMode("conversion");
                    setIsDropdownOpen(false);
                  }}
                  className={`w-full text-left p-2 rounded-lg transition-colors ${
                    mode === "conversion" ? "bg-[#4a90e2] text-[#0a0e1a]" : "bg-[#1e2742] text-[#4a90e2] hover:bg-[#2a3457]"
                  } mb-2`}
                >
                  Conversion Chat
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-[#12172b] rounded-2xl border border-[#2a3457] mb-4 space-y-6">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`message max-w-[80%] p-4 rounded-xl shadow-md transition-all duration-300 hover:shadow-xl relative ${
                msg.sender === "user"
                  ? "ml-auto bg-[#1e2742] border-r-4 border-[#4a90e2] text-right"
                  : "bg-[#171d35] border-l-4 border-[#4a90e2] text-left"
              }`}
            >
              <div className="absolute top-2 right-2 flex gap-2">
                <button
                  onClick={() => copyToClipboard(msg.content)}
                  className="p-1 bg-[#4a90e2] text-[#0a0e1a] rounded-full hover:bg-[#357abd] transition-colors"
                  title="Copy this message"
                >
                  <Copy size={16} />
                </button>
                <button
                  onClick={() => downloadSingleMessageAsPDF(msg)}
                  className="p-1 bg-[#4a90e2] text-[#0a0e1a] rounded-full hover:bg-[#357abd] transition-colors"
                  title="Download this message"
                >
                  <Download size={16} />
                </button>
              </div>
              {msg.file ? (
                msg.fileType.startsWith("image/") ? (
                  <img
                    src={msg.file}
                    className="chat-image user-image mb-2"
                    alt="User upload"
                    style={{ maxWidth: "200px", maxHeight: "200px", objectFit: "contain" }}
                  />
                ) : (
                  <audio src={msg.file} controls className="w-full mb-2" />
                )
              ) : (
                <div className="text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: formatText(msg.content) }} />
              )}
              <p className="text-xs text-[#7f8dc5] mt-1">{formatTime(msg.timestamp)}</p>
            </div>
          ))}
          {isLoading && (
            <div className="loader flex items-center gap-2 text-[#7f8dc5] my-3 animate-pulse">
              <div className="spinner w-6 h-6 border-4 border-[#1e2742] border-t-[#4a90e2] rounded-full animate-spin"></div>
              <span>
                {mode === "plan"
                  ? "Crafting your luxury itinerary..."
                  : mode === "search"
                  ? "Searching knowledge base..."
                  : "Processing your conversion query..."}
              </span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 bg-[#12172b] rounded-2xl border border-[#2a3457] shadow-md">
          <form onSubmit={handleSendMessage} className="flex gap-3 items-center">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2 bg-[#1e2742] text-[#4a90e2] rounded-lg hover:bg-[#2a3457] transition-colors"
              >
                <Image size={20} />
              </button>
              <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*,audio/*" className="hidden" />
              <button
                type="button"
                onClick={isRecording ? stopRecording : startRecording}
                className={`p-2 rounded-lg transition-colors ${
                  isRecording ? "bg-[#4a90e2] text-[#0a0e1a] hover:bg-[#357abd]" : "bg-[#1e2742] text-[#4a90e2] hover:bg-[#2a3457]"
                }`}
              >
                <Mic size={20} />
              </button>
            </div>
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Enter your travel query..."
              disabled={isLoading}
              className="flex-1 p-3 bg-[#12172b] border-none text-[#d9e1ff] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4a90e2] resize-none h-[60px] placeholder-[#7f8dc5] text-sm transition-all duration-200"
            />
            <button
              type="submit"
              disabled={isLoading || (!inputValue.trim() && !selectedFile)}
              className="p-3 bg-[#4a90e2] text-[#0a0e1a] rounded-lg hover:bg-[#357abd] disabled:bg-[#2a3457] disabled:cursor-not-allowed transition-colors flex items-center justify-center"
            >
              <Send className="h-5 w-5" />
            </button>
          </form>
          {selectedFile && (
            <p className="text-xs text-[#7f8dc5] mt-2">
              Selected: {selectedFile.name} ({selectedFile.type.startsWith("image/") ? "Image" : "Audio"})
            </p>
          )}
        </div>
      </div>
    </div>
  );
}