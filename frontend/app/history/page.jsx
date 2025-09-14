"use client"

import { useState, useEffect, useRef } from "react"
import { Download, Menu, X, Trash2 } from "lucide-react"
import { Sidebar } from "../../components/sidebar"
import { useRouter } from "next/navigation"
import { jsPDF } from 'jspdf'

export default function HistoryPage() {
  const router = useRouter()
  const [messagePairs, setMessagePairs] = useState([])
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [sortOrder, setSortOrder] = useState("newest")
  const [selectedPair, setSelectedPair] = useState(null)
  const [isGridView, setIsGridView] = useState(false)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const token = localStorage.getItem("jwtToken")
        if (!token) {
          router.push("/login")
          return
        }

        const decoded = JSON.parse(atob(token.split(".")[1]))
        const user_id = decoded.user_id

         const res = await fetch(`http://127.0.0.1:5000/history?user_id=${user_id}`, {
          method: "GET",
        })

        const data = await res.json()
        const history = data.history || []
        const pairs = []
        for (let i = 0; i < history.length; i += 2) {
          const query = history[i]?.query ? {
            id: i + 1,
            chat_id: history[i].chat_id,
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
  }, [router])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }
  useEffect(() => {
    scrollToBottom()
  }, [messagePairs])

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen)
  }

  const toggleView = () => {
    setIsGridView(!isGridView)
  }

  const sanitizeText = (text) => {
    return typeof text === 'string' ? text.replace(/[^a-zA-Z0-9\s.,!?]/g, '') : ''
  }

  const formatText = (text) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, "<b>$1</b>")
      .replace(/\n\n/g, "<br><br>")
      .replace(/\n/g, "<br>")
      .replace(
        /!\[(.*?)\]\((.*?)\)/g,
        (match, caption, url) => `<div><a href="${url}" class="text-blue-400 hover:underline">${caption}</a></div>`
      )
  }

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

  const deleteMessagePair = async (index, chat_id) => {
    try {
      const token = localStorage.getItem("jwtToken")
      const res = await fetch(`http://127.0.0.1:5000/history/${chat_id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        }
      })
      if (res.ok) {
        setMessagePairs((prev) => prev.filter((_, i) => i !== index))
        setSelectedPair(null)
      } else {
        const data = await res.json()
        console.error(data.error)
      }
    } catch (err) {
      console.error("Error deleting chat:", err)
    }
  }

  const formatTime = (date) => {
    const d = new Date(date)
    if (isNaN(d)) return ""

    const options = {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }

    return new Intl.DateTimeFormat("en-US", options).format(d)
  }

  const filteredAndSortedPairs = messagePairs
    .filter(({ query }) =>
      query.content.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      if (sortOrder === "newest") {
        return b.query.timestamp - a.query.timestamp
      } else {
        return a.query.timestamp - b.query.timestamp
      }
    })

  return (
    <div className="flex h-screen bg-[#0a0e1a] text-[#d9e1ff] font-sans">
      <Sidebar isOpen={isSidebarOpen} toggleSidebar={toggleSidebar} />
      <div className="flex-1 md:ml-64 flex flex-col w-full p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-4 sm:mb-6 gap-4">
          <button
            onClick={toggleSidebar}
            className="md:hidden fixed top-4 left-4 z-50 p-2 bg-[#12172b] text-[#4a90e2] rounded-xl shadow-lg hover:bg-[#1e2742] transition-colors"
          >
            {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
          <button
            onClick={toggleView}
            className="p-2 bg-[#4a90e2] text-[#0a0e1a] rounded-lg hover:bg-[#357abd] transition-colors w-full sm:w-auto"
          >
            {isGridView ? "Switch to Row View" : "Switch to Grid View"}
          </button>
        </div>

        <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row gap-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search queries..."
            className="flex-1 p-3 bg-[#12172b] border border-[#2a3457] text-[#d9e1ff] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4a90e2] placeholder-[#7f8dc5] text-sm"
          />
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className="p-3 bg-[#12172b] border border-[#2a3457] text-[#d9e1ff] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4a90e2] text-sm"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
          </select>
        </div>

        <div className={`flex-1 overflow-y-auto p-4 sm:p-6 bg-[#12172b] rounded-2xl border border-[#2a3457] ${
          isGridView ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6' : 'flex flex-col gap-4'
        }`}>
          {filteredAndSortedPairs.map(({ query, response }, index) => (
            <div
              key={index}
              className={`p-4 bg-[#1e2742] rounded-xl shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer border border-[#2a3457] ${
                isGridView ? 'flex flex-col h-full' : 'flex flex-row items-center min-h-[80px]'
              }`}
              onClick={() => setSelectedPair({ query, response })}
            >
              <div className={isGridView ? 'flex-1 flex flex-col' : 'flex-1 pr-4'}>
                <p className="text-xs text-[#7f8dc5] mb-2">{formatTime(query.timestamp)}</p>
                <div 
                  className="text-sm leading-relaxed break-words overflow-hidden"
                  style={{ 
                    display: '-webkit-box',
                    WebkitLineClamp: isGridView ? 4 : 2,
                    WebkitBoxOrient: 'vertical'
                  }}
                  dangerouslySetInnerHTML={{ __html: formatText(query.content) }}
                />
              </div>
              <div className={`flex gap-2 ${isGridView ? 'mt-3 justify-end' : 'flex-none items-center'}`}>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    deleteMessagePair(index, query.chat_id)
                  }}
                  className="p-1 bg-[#4a90e2] text-[#0a0e1a] rounded-full hover:bg-[#357abd] transition-colors"
                  title="Delete this query"
                >
                  <Trash2 size={16} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    downloadSingleResponseAsPDF(query)
                  }}
                  className="p-1 bg-[#4a90e2] text-[#0a0e1a] rounded-full hover:bg-[#357abd] transition-colors"
                  title="Download this query"
                >
                  <Download size={16} />
                </button>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {selectedPair && (
          <div className="fixed inset-0 bg-[#0a0e1a] bg-opacity-80 flex items-center justify-center z-50 p-4">
            <div className="bg-[#12172b] rounded-2xl border border-[#2a3457] p-4 sm:p-6 w-full max-w-[95vw] sm:max-w-3xl max-h-[85vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-[#4a90e2]">Query Details</h2>
                <button
                  onClick={() => setSelectedPair(null)}
                  className="p-2 bg-[#1e2742] text-[#4a90e2] rounded-full hover:bg-[#2a3457] transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="mb-4">
                <p className="text-sm text-[#7f8dc5] mb-1">Query ({formatTime(selectedPair.query.timestamp)}):</p>
                {selectedPair.query.file ? (
                  selectedPair.query.fileType.startsWith("image/") ? (
                    <img
                      src={selectedPair.query.file}
                      className="chat-image user-image mb-2 max-w-full"
                      alt="User upload"
                      style={{ maxWidth: "min(100%, 300px)", maxHeight: "200px", objectFit: "contain" }}
                    />
                  ) : (
                    <audio src={selectedPair.query.file} controls className="w-full mb-2 max-w-full" />
                  )
                ) : (
                  <div 
                    className="text-sm leading-relaxed p-4 bg-[#1e2742] rounded-lg break-words"
                    dangerouslySetInnerHTML={{ __html: formatText(selectedPair.query.content) }}
                  />
                )}
              </div>
              {selectedPair.response && (
                <div>
                  <p className="text-sm text-[#7f8dc5] mb-1">Response ({formatTime(selectedPair.response.timestamp)}):</p>
                  {selectedPair.response.file ? (
                    selectedPair.response.fileType.startsWith("image/") ? (
                      <img
                        src={selectedPair.response.file}
                        className="chat-image ai-image mb-2 max-w-full"
                        alt="AI response"
                        style={{ maxWidth: "min(100%, 300px)", maxHeight: "200px", objectFit: "contain" }}
                      />
                    ) : (
                      <audio src={selectedPair.response.file} controls className="w-full mb-2 max-w-full" />
                    )
                  ) : (
                    <div 
                      className="text-sm leading-relaxed p-4 bg-[#171d35] rounded-lg break-words"
                      dangerouslySetInnerHTML={{ __html: formatText(selectedPair.response.content) }}
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}



