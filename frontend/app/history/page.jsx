"use client"

import { useState, useEffect, useRef } from "react"
import { Download, Menu, X } from "lucide-react"
import { Sidebar } from "../../components/sidebar"
import { useRouter } from "next/navigation"
import { jsPDF } from 'jspdf'

export default function HistoryPage() {
  const router = useRouter()
  const [messagePairs, setMessagePairs] = useState([])
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const messagesEndRef = useRef(null)

  // Check for authentication
  useEffect(() => {
    const token = localStorage.getItem("jwtToken")
    if (!token) {
      router.push("/login")
    }
  }, [router])

  // Fetch chat history from backend and pair queries with responses
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch("http://127.0.0.1:5000/history", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        })
        const data = await res.json()
        const history = data.history
        // Pair queries and responses
        const pairs = []
        for (let i = 0; i < history.length; i += 2) {
          const query = history[i]?.query ? {
            id: i + 1,
            content: history[i].query,
            sender: "user",
            timestamp: new Date(history[i].timestamp),
            file: history[i].file || null,
            fileType: history[i].fileType || null
          } : null
          const response = history[i + 1]?.response ? {
            id: i + 2,
            content: history[i + 1].response,
            sender: "bot",
            timestamp: new Date(history[i + 1].timestamp),
            file: history[i + 1].file || null,
            fileType: history[i + 1].fileType || null
          } : null
          if (query) {
            pairs.push({ query, response })
          }
        }
        setMessagePairs(pairs)
      } catch (err) {
        console.error("Error fetching history:", err)
        setMessagePairs([{ 
          query: { 
            id: 1, 
            content: "Error loading history", 
            sender: "bot", 
            timestamp: new Date() 
          }, 
          response: null 
        }])
      }
    }
    fetchHistory()
  }, [])

  // Scroll to bottom when message pairs update
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }
  useEffect(() => {
    scrollToBottom()
  }, [messagePairs])

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen)
  }

  // Utility function to remove special characters
  const sanitizeText = (text) => {
    return typeof text === 'string' ? text.replace(/[^a-zA-Z0-9\s.,!?]/g, '') : ''
  }

  // Format text for markdown-like rendering
  const formatText = (text) => {
    let html = text.replace(/\*\*(.*?)\*\*/g, "<b>$1</b>").replace(/\n\n/g, "<br><br>").replace(/\n/g, "<br>")
    html = html.replace(/!\[(.*?)\]\((.*?)\)/g, (match, caption, url) => `<div><img src="${url}" class="chat-image ai-image"/><div class="caption">${caption}</div></div>`)
    return html
  }

  // Download individual response as PDF
  const downloadSingleResponseAsPDF = (message) => {
    if (!message) return
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

  // Download all conversation as PDF
  const downloadAsPDF = () => {
    const doc = new jsPDF()
    let y = 20

    messagePairs.forEach(({ query, response }) => {
      if (query) {
        const querySender = "You"
        const queryTime = formatTime(query.timestamp)
        const queryContent = sanitizeText(query.content)
        const queryLines = doc.splitTextToSize(queryContent, 180)

        if (y + queryLines.length * 7 > 280) {
          doc.addPage()
          y = 20
        }

        doc.setFontSize(12)
        doc.text(`${querySender} (${queryTime}):`, 20, y)
        y += 10
        doc.setFontSize(10)
        queryLines.forEach((line) => {
          if (y > 280) {
            doc.addPage()
            y = 20
          }
          doc.text(line, 20, y)
          y += 7
        })
        y += 5
      }

      if (response) {
        const responseSender = "AI"
        const responseTime = formatTime(response.timestamp)
        const responseContent = sanitizeText(response.content)
        const responseLines = doc.splitTextToSize(responseContent, 180)

        if (y + responseLines.length * 7 > 280) {
          doc.addPage()
          y = 20
        }

        doc.setFontSize(12)
        doc.text(`${responseSender} (${responseTime}):`, 20, y)
        y += 10
        doc.setFontSize(10)
        responseLines.forEach((line) => {
          if (y > 280) {
            doc.addPage()
            y = 20
          }
          doc.text(line, 20, y)
          y += 7
        })
        y += 5
      }
    })

    doc.save('chat-history.pdf')
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
          </div>
        </div>

        <h1 className="text-center text-2xl font-semibold text-[#d4af37] mb-1 animate-fade-in">🌍 WanderSync History</h1>
        <p className="text-center text-sm text-[#a3a3a3] mb-5 animate-fade-in">View your past travel conversations</p>

        <div className="flex-1 overflow-y-auto p-5 bg-[#262626] rounded-xl border border-[#333] mb-4 space-y-5">
          {messagePairs.map(({ query, response }, index) => (
            <div key={index} className="space-y-5">
              {query && (
                <div
                  className="message max-w-[80%] p-4 rounded-xl shadow-md transition-all duration-300 hover:shadow-lg relative ml-auto bg-[#333] border-r-4 border-[#b8860b] text-right"
                >
                  <button
                    onClick={() => downloadSingleResponseAsPDF(query)}
                    className="absolute top-2 right-2 p-1 bg-[#d4af37] text-[#1a1a1a] rounded-full hover:bg-[#b8860b] transition-colors"
                    title="Download this message"
                  >
                    <Download size={16} />
                  </button>
                  {query.file ? (
                    query.fileType.startsWith("image/") ? (
                      <img
                        src={query.file}
                        className="chat-image user-image mb-2"
                        alt="User upload"
                        style={{ maxWidth: "200px", maxHeight: "200px", objectFit: "contain" }}
                      />
                    ) : (
                      <audio src={query.file} controls className="w-full mb-2" />
                    )
                  ) : (
                    <div className="text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: formatText(query.content) }} />
                  )}
                  <p className="text-xs text-[#a3a3a3] mt-1">{formatTime(query.timestamp)}</p>
                </div>
              )}
              {response && (
                <div
                  className="message max-w-[80%] p-4 rounded-xl shadow-md transition-all duration-300 hover:shadow-lg relative bg-[#2d2d2d] border-l-4 border-[#d4af37] text-left"
                >
                  <button
                    onClick={() => downloadSingleResponseAsPDF(response)}
                    className="absolute top-2 right-2 p-1 bg-[#d4af37] text-[#1a1a1a] rounded-full hover:bg-[#b8860b] transition-colors"
                    title="Download this response"
                  >
                    <Download size={16} />
                  </button>
                  {response.file ? (
                    response.fileType.startsWith("image/") ? (
                      <img
                        src={response.file}
                        className="chat-image ai-image mb-2"
                        alt="AI response"
                        style={{ maxWidth: "200px", maxHeight: "200px", objectFit: "contain" }}
                      />
                    ) : (
                      <audio src={response.file} controls className="w-full mb-2" />
                    )
                  ) : (
                    <div className="text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: formatText(response.content) }} />
                  )}
                  <p className="text-xs text-[#a3a3a3] mt-1">{formatTime(response.timestamp)}</p>
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>
    </div>
  )
}