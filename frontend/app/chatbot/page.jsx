"use client"

import { useState, useRef, useEffect } from "react"
import { Send, Bot, User, Image, Mic, Download } from "lucide-react"
import { Menu, X } from 'lucide-react'
import { Sidebar } from "../../components/sidebar"
import { useRouter } from "next/navigation"
import { jsPDF } from 'jspdf'

export default function ChatPage() {
  const router = useRouter()

  useEffect(() => {
    const token = localStorage.getItem("jwtToken")
    if (!token) {
      router.push("/login")
    }
  }, [router])

  const [messages, setMessages] = useState([
    {
      id: 1,
      content: "Yo! I'm your AI travel assistant. Where you headed today?",
      sender: "bot",
      timestamp: new Date(),
    },
  ])
  const [inputValue, setInputValue] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  const [isRecording, setIsRecording] = useState(false)
  const [mediaRecorder, setMediaRecorder] = useState(null)
  const messagesEndRef = useRef(null)
  const fileInputRef = useRef(null)
  const audioChunksRef = useRef([])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    const history = JSON.parse(localStorage.getItem("chatHistory") || "[]")
    if (history.length) setMessages(history)
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen)
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file && (file.type.startsWith("image/") || file.type.startsWith("audio/"))) {
      setSelectedFile(file)
    } else {
      setSelectedFile(null)
    }
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      setMediaRecorder(recorder)
      audioChunksRef.current = []
      recorder.start()
      setIsRecording(true)
      recorder.ondataavailable = (e) => audioChunksRef.current.push(e.data)
      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" })
        setSelectedFile(new File([audioBlob], "voice-recording.webm", { type: "audio/webm" }))
      }
    } catch (err) {
      setSelectedFile(null)
    }
  }

  const stopRecording = () => {
    if (mediaRecorder) {
      mediaRecorder.stop()
      setIsRecording(false)
    }
  }

  const handleSendMessage = async (e) => {
    e.preventDefault()
    if (!inputValue.trim() && !selectedFile) return
    if (isLoading) return

    const userMessage = {
      id: Date.now(),
      content: inputValue || (selectedFile ? `[${selectedFile.type.startsWith("image/") ? "Image" : "Audio"}] ${selectedFile.name}` : ""),
      sender: "user",
      timestamp: new Date(),
      file: selectedFile ? URL.createObjectURL(selectedFile) : null,
      fileType: selectedFile ? selectedFile.type : null
    }

    setMessages(prev => [...prev, userMessage])
    setInputValue("")
    setSelectedFile(null)
    setIsLoading(true)
    if (fileInputRef.current) fileInputRef.current.value = ""

    try {
      const res = await fetch("http://127.0.0.1:5000/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: inputValue }),
      })

      const data = await res.json()
      const botResponse = { id: Date.now() + 1, content: data.response || "Something went wrong!", sender: "bot", timestamp: new Date() }
      setMessages(prev => [...prev, botResponse])
      setIsLoading(false)

      const history = JSON.parse(localStorage.getItem("chatHistory") || "[]")
      localStorage.setItem("chatHistory", JSON.stringify([...history, { ...userMessage, file: null }, botResponse]))
    } catch (err) {
      setIsLoading(false)
      setMessages(prev => [...prev, { id: Date.now() + 1, content: `Error: ${err.message}`, sender: "bot", timestamp: new Date() }])
    }
  }

  const newChat = () => {
    localStorage.removeItem("chatHistory")
    setMessages([
      {
        id: 1,
        content: "Yo! I'm your AI travel assistant. Where you headed today?",
        sender: "bot",
        timestamp: new Date(),
      },
    ])
  }

  // Utility function to remove special characters
  const sanitizeText = (text) => {
    return typeof text === 'string' ? text.replace(/[^a-zA-Z0-9\s.,!?]/g, '') : ''
  }

  // Download individual message as PDF
  const downloadSingleMessageAsPDF = (message) => {
    const doc = new jsPDF()
    const sender = message.sender === "user" ? "You" : "AI"
    const time = formatTime(message.timestamp)
    const content = sanitizeText(message.content)
    const lines = doc.splitTextToSize(content, 180)

    doc.setFontSize(12)
    doc.text(`${sender} (${time}):`, 20, 20)
    doc.setFontSize(10)
    let y = 30
    lines.forEach((line) => {
      doc.text(line, 20, y)
      y += 7
    })

    doc.save(`message-${message.id}.pdf`)
  }

  // Download all messages as PDF
  const downloadAsPDF = () => {
    const doc = new jsPDF()
    let y = 20

    messages.forEach((message) => {
      const sender = message.sender === "user" ? "You" : "AI"
      const time = formatTime(message.timestamp)
      const content = sanitizeText(message.content)
      const lines = doc.splitTextToSize(content, 180)

      if (y + lines.length * 7 > 280) {
        doc.addPage()
        y = 20
      }

      doc.setFontSize(12)
      doc.text(`${sender} (${time}):`, 20, y)
      y += 10

      doc.setFontSize(10)
      lines.forEach((line) => {
        if (y > 280) {
          doc.addPage()
          y = 20
        }
        doc.text(line, 20, y)
        y += 7
      })

      y += 5
    })

    doc.save('chat-conversation.pdf')
  }

  const formatText = (text) => {
    let html = text.replace(/\*\*(.*?)\*\*/g, "<b>$1</b>").replace(/\n\n/g, "<br><br>").replace(/\n/g, "<br>")
    html = html.replace(/!\[(.*?)\]\((.*?)\)/g, (match, caption, url) => `<div><img src="${url}" class="chat-image ai-image"/><div class="caption">${caption}</div></div>`)
    return html
  }

  const formatTime = (date) => {
    const d = new Date(date)
    if (isNaN(d)) return ""
    return new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit" }).format(d)
  }

  return (
    <div className="flex h-screen bg-[#1a1a1a] text-[#e6e6e6] font-sans">
      <Sidebar isOpen={isSidebarOpen} toggleSidebar={toggleSidebar} />
      <div className="flex-1 md:ml-64 flex flex-col w-full p-5">
        <div className="flex justify-between items-center mb-2">
          <button
            onClick={toggleSidebar}
            className="md:hidden fixed top-4 left-4 z-50 p-2 bg-[#262626] text-[#d4af37] rounded-xl shadow-lg hover:bg-[#333] transition-colors"
          >
            {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={downloadAsPDF}
              className="p-2 bg-[#d4af37] text-[#1a1a1a] rounded-lg hover:bg-[#b8860b] transition-colors flex items-center gap-2"
            >
              <Download size={20} />
              <span className="hidden md:inline">Download All</span>
            </button>
            <button
              onClick={newChat}
              className="p-2 bg-[#d4af37] text-[#1a1a1a] rounded-lg hover:bg-[#b8860b] transition-colors"
            >
              New Chat
            </button>
          </div>
        </div>

        <h1 className="text-center text-2xl font-semibold text-[#d4af37] mb-1 animate-fade-in">🌍 WanderSync</h1>
        <p className="text-center text-sm text-[#a3a3a3] mb-5 animate-fade-in">Your premium AI-powered travel assistant</p>

        <div className="flex-1 overflow-y-auto p-5 bg-[#262626] rounded-xl border border-[#333] mb-4 space-y-5">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`message max-w-[80%] p-4 rounded-xl shadow-md transition-all duration-300 hover:shadow-lg relative ${
                message.sender === "user" ? "ml-auto bg-[#333] border-r-4 border-[#b8860b] text-right" : "bg-[#2d2d2d] border-l-4 border-[#d4af37] text-left"
              }`}
            >
              <button
                onClick={() => downloadSingleMessageAsPDF(message)}
                className="absolute top-2 right-2 p-1 bg-[#d4af37] text-[#1a1a1a] rounded-full hover:bg-[#b8860b] transition-colors"
                title="Download this message"
              >
                <Download size={16} />
              </button>
              {message.file ? (
                message.fileType.startsWith("image/") ? (
                  <img
                    src={message.file}
                    className="chat-image user-image mb-2"
                    alt="User upload"
                    style={{ maxWidth: "200px", maxHeight: "200px", objectFit: "contain" }}
                  />
                ) : (
                  <audio src={message.file} controls className="w-full mb-2" />
                )
              ) : (
                <div className="text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: formatText(message.content) }} />
              )}
              <p className="text-xs text-[#a3a3a3] mt-1">{formatTime(message.timestamp)}</p>
            </div>
          ))}
          {isLoading && (
            <div className="loader flex items-center gap-2 text-[#a3a3a3] my-3 animate-pulse">
              <div className="spinner w-6 h-6 border-4 border-[#333] border-t-[#d4af37] rounded-full animate-spin"></div>
              <span>Crafting your luxury itinerary...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-3 bg-[#262626] rounded-xl border border-[#333] shadow-md">
          <form onSubmit={handleSendMessage} className="flex gap-3 items-center">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2 bg-[#333] text-[#d4af37] rounded-lg hover:bg-[#444] transition-colors"
              >
                <Image size={20} />
              </button>
              <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*,audio/*" className="hidden" />
              <button
                type="button"
                onClick={isRecording ? stopRecording : startRecording}
                className={`p-2 rounded-lg transition-colors ${isRecording ? "bg-[#b8860b] text-[#1a1a1a] hover:bg-[#d4af37]" : "bg-[#333] text-[#d4af37] hover:bg-[#444]"}`}
              >
                <Mic size={20} />
              </button>
            </div>
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Enter your travel query..."
              disabled={isLoading}
              className="flex-1 p-3 bg-[#262626] border-none text-[#e6e6e6] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d4af37] resize-none h-[60px] placeholder-[#a3a3a3] text-sm transition-all duration-200"
            />
            <button
              type="submit"
              disabled={isLoading || (!inputValue.trim() && !selectedFile)}
              className="p-3 bg-[#d4af37] text-[#1a1a1a] rounded-lg hover:bg-[#b8860b] disabled:bg-[#444] disabled:cursor-not-allowed transition-colors flex items-center justify-center"
            >
              <Send className="h-5 w-5" />
            </button>
          </form>
          {selectedFile && (
            <p className="text-xs text-[#a3a3a3] mt-2">
              Selected: {selectedFile.name} ({selectedFile.type.startsWith("image/") ? "Image" : "Audio"})
            </p>
          )}
        </div>
      </div>
    </div>
  )
}