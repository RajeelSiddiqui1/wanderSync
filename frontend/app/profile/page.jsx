"use client"

import { useState, useEffect } from "react"
import { Sidebar } from "@/components/sidebar"
import { Menu, X } from "lucide-react"

export default function ProfilePage() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen)

  useEffect(() => {
    const fetchProfile = async () => {
      const token = localStorage.getItem("jwtToken")
      if (!token) {
        setError("Not logged in")
        setLoading(false)
        return
      }

      try {
        const res = await fetch("http://127.0.0.1:5000/profile", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        const data = await res.json()
        if (data.success) {
          setUser(data.user)
        } else {
          setError(data.message || "Failed to fetch profile")
        }
        setLoading(false)
      } catch (err) {
        setError(err.message)
        setLoading(false)
      }
    }

    fetchProfile()
  }, [])

  if (loading) return <p className="text-center mt-20 text-[#7f8dc5]">Loading profile...</p>
  if (error) return <p className="text-center mt-20 text-[#ff6961]">{error}</p>

  const avatarUrl = `https://avatar.iran.liara.run/username?username=${encodeURIComponent(user.name.split(" ")[0])}`

  return (
    <div className="flex h-screen bg-[#0a0e1a] text-[#d9e1ff] font-sans">
      <Sidebar isOpen={isSidebarOpen} toggleSidebar={toggleSidebar} />

      <div className="flex-1 md:ml-64 flex flex-col w-full p-6">
        <div className="flex justify-between items-center mb-6">
          <button
            onClick={toggleSidebar}
            className="md:hidden fixed top-4 left-4 z-50 p-2 bg-[#12172b] text-[#4a90e2] rounded-xl shadow-lg hover:bg-[#1e2742] transition-colors"
          >
            {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        <div className="w-full max-w-md mx-auto p-8 bg-[#12172b] rounded-2xl border border-[#2a3457] shadow-md hover:shadow-xl transition-all duration-300">
          <div className="flex flex-col items-center gap-4">
            <img
              src={avatarUrl}
              alt="Avatar"
              className="w-24 h-24 rounded-full border-2 border-[#4a90e2]"
            />
            <h2 className="text-xl font-medium text-[#d9e1ff]">{user.name}</h2>
            <p className="text-sm text-[#7f8dc5]">{user.email}</p>
          </div>

          <button
            onClick={() => {
              localStorage.removeItem("jwtToken")
              window.location.href = "/login"
            }}
            className="mt-6 w-full p-3 bg-[#4a90e2] text-[#0a0e1a] rounded-lg hover:bg-[#357abd] transition-colors font-semibold"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  )
}