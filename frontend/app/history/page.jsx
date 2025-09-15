"use client"

import { useState, useEffect, useRef } from "react"
import { Download, Menu, X, Trash2, Eye } from "lucide-react"
import { Sidebar } from "../../components/sidebar"
import { useRouter } from "next/navigation"
import { jsPDF } from 'jspdf'

export default function HistoryPage() {
  const router = useRouter()
  const [messagePairs, setMessagePairs] = useState([])
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [sortOrder, setSortOrder] = useState("newest")
  const [isGridView, setIsGridView] = useState(false)
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false)
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false)
  const [selectedPair, setSelectedPair] = useState(null)
  const messagesEndRef = useRef(null)
  const [userId, setUserId] = useState(null)

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
        setUserId(user_id)

        const res = await fetch(`http://127.0.0.1:5000/history?user_id=${user_id}`, {
          method: "GET",
          headers: { "Authorization": `Bearer ${token}` }
        })

        if (!res.ok) {
          throw new Error("Failed to fetch history")
        }

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

  const formatTextForPDF = (text) => {
    return typeof text === 'string' ? text.replace(/!\[(.*?)\]\((.*?)\)/g, '$1 ($2)') : ''
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

  const downloadPairAsPDF = (pair) => {
    if (!pair || !pair.query) return
    const doc = new jsPDF()
    let y = 20

    // Query
    const querySender = pair.query.sender === "user" ? "You" : "AI"
    const queryTime = formatTime(pair.query.timestamp)
    const queryContent = sanitizeText(formatTextForPDF(pair.query.content))
    const queryLines = doc.splitTextToSize(`${querySender} (${queryTime}):\n${queryContent}`, 180)
    doc.setFontSize(12)
    doc.text(queryLines, 20, y)
    y += queryLines.length * 7 + 10

    // Response
    if (pair.response) {
      const responseSender = pair.response.sender === "user" ? "You" : "AI"
      const responseTime = formatTime(pair.response.timestamp)
      const responseContent = sanitizeText(formatTextForPDF(pair.response.content))
      const responseLines = doc.splitTextToSize(`${responseSender} (${responseTime}):\n${responseContent}`, 180)
      doc.setFontSize(12)
      doc.text(responseLines, 20, y)
    }

    doc.save(`chat-${pair.query.id}.pdf`)
    setIsDownloadModalOpen(false)
    setSelectedPair(null)
  }

  const openDownloadModal = (pair, e) => {
    e.stopPropagation()
    setSelectedPair(pair)
    setIsDownloadModalOpen(true)
  }

  const openDetailsModal = (pair, e) => {
    e.stopPropagation()
    setSelectedPair(pair)
    setIsDetailsModalOpen(true)
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

  const deleteSingleChat = async (chat_id) => {
    if (!userId || !chat_id) return
    try {
      const token = localStorage.getItem("jwtToken")
      const res = await fetch(`http://127.0.0.1:5000/history/${userId}/${chat_id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      })
      if (res.ok) {
        setMessagePairs((prev) => prev.filter((pair) => pair.query.chat_id !== chat_id))
        alert(`Chat ${chat_id} deleted successfully`)
      } else {
        const data = await res.json()
        alert(data.error || "Failed to delete chat")
      }
    } catch (err) {
      alert("Error deleting chat")
    }
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
          <div className="flex gap-4 w-full sm:w-auto">
            <button
              onClick={toggleView}
              className="p-2 bg-[#4a90e2] text-[#0a0e1a] rounded-lg hover:bg-[#357abd] transition-colors w-full sm:w-auto"
            >
              {isGridView ? "Switch to Row View" : "Switch to Grid View"}
            </button>
          </div>
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
              className={`p-4 bg-[#1e2742] rounded-xl shadow-md hover:shadow-xl transition-all duration-300 border border-[#2a3457] ${
                isGridView ? 'flex flex-col h-full' : 'flex flex-row items-center min-h-[80px]'
              }`}
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
                  onClick={(e) => openDetailsModal({ query, response }, e)}
                  className="p-1 bg-[#4a90e2] text-[#0a0e1a] rounded-full hover:bg-[#357abd] transition-colors"
                  title="View details"
                >
                  <Eye size={16} />
                </button>
                <button
                  onClick={(e) => openDownloadModal({ query, response }, e)}
                  className="p-1 bg-[#4a90e2] text-[#0a0e1a] rounded-full hover:bg-[#357abd] transition-colors"
                  title="Download this chat"
                >
                  <Download size={16} />
                </button>
                {/* <button
                  onClick={(e) => {
                    e.stopPropagation()
                    if (confirm(`Are you sure you want to delete chat ${query.chat_id}?`)) {
                      deleteSingleChat(query.chat_id)
                    }
                  }}
                  className="p-1 bg-red-600 text-[#0a0e1a] rounded-full hover:bg-red-700 transition-colors"
                  title="Delete this chat"
                >
                  <Trash2 size={16} />
                </button> */}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {isDownloadModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-[#1e2742] p-6 rounded-lg shadow-xl">
            <h2 className="text-lg font-semibold mb-4">Download Chat</h2>
            <p className="mb-4">Do you want to download this chat as a PDF?</p>
            <div className="flex justify-end gap-4">
              <button
                onClick={() => {
                  setIsDownloadModalOpen(false)
                  setSelectedPair(null)
                }}
                className="p-2 bg-gray-600 text-[#d9e1ff] rounded-lg hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={() => downloadPairAsPDF(selectedPair)}
                className="p-2 bg-[#4a90e2] text-[#0a0e1a] rounded-lg hover:bg-[#357abd]"
              >
                Download
              </button>
            </div>
          </div>
        </div>
      )}

      {isDetailsModalOpen && selectedPair && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-[#1e2742] p-6 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <h2 className="text-lg font-semibold mb-4">Chat Details</h2>
            <div className="mb-4">
              <p className="text-xs text-[#7f8dc5] mb-2">
                {selectedPair.query.sender === "user" ? "You" : "AI"} ({formatTime(selectedPair.query.timestamp)}):
              </p>
              <div 
                className="text-sm leading-relaxed break-words"
                dangerouslySetInnerHTML={{ __html: formatText(selectedPair.query.content) }}
              />
            </div>
            {selectedPair.response && (
              <div className="mb-4">
                <p className="text-xs text-[#7f8dc5] mb-2">
                  {selectedPair.response.sender === "user" ? "You" : "AI"} ({formatTime(selectedPair.response.timestamp)}):
                </p>
                <div 
                  className="text-sm leading-relaxed break-words"
                  dangerouslySetInnerHTML={{ __html: formatText(selectedPair.response.content) }}
                />
              </div>
            )}
            <div className="flex justify-end gap-4">
              <button
                onClick={() => {
                  setIsDetailsModalOpen(false)
                  setSelectedPair(null)
                }}
                className="p-2 bg-gray-600 text-[#d9e1ff] rounded-lg hover:bg-gray-700"
              >
                Close
              </button>
              <button
                onClick={() => downloadPairAsPDF(selectedPair)}
                className="p-2 bg-[#4a90e2] text-[#0a0e1a] rounded-lg hover:bg-[#357abd]"
              >
                Download
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}