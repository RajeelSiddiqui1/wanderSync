"use client"

import { useState, useEffect } from "react"
import { Sidebar } from "@/components/sidebar"

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

  if (loading) return <p className="text-center mt-20 text-[#a3a3a3]">Loading profile...</p>
  if (error) return <p className="text-center mt-20 text-[#ff6961]">{error}</p>

  const avatarUrl = `https://avatar.iran.liara.run/username?username=${encodeURIComponent(user.name.split(" ")[0])}`

  return (
    <div className="flex h-screen bg-[#1a1a1a] text-[#e6e6e6] font-sans">
      <Sidebar isOpen={isSidebarOpen} toggleSidebar={toggleSidebar} />

      <div className="flex-1 md:ml-64 flex flex-col w-full p-5">
        <div className="flex justify-between items-center mb-4">
          <button
            onClick={toggleSidebar}
            className="md:hidden fixed top-4 left-4 z-50 p-2 bg-[#262626] text-[#d4af37] rounded-xl shadow-lg hover:bg-[#333] transition-colors"
          >
            {isSidebarOpen ? "Close" : "Menu"}
          </button>
        </div>

        <div className="w-full max-w-md mx-auto p-8 bg-[#262626] rounded-xl border border-[#333] shadow-lg animate-fade-in">
          <h1 className="text-2xl font-semibold text-center text-[#d4af37] mb-4">👤 Your Profile</h1>

          <div className="flex flex-col items-center gap-4">
            <img
              src={avatarUrl}
              alt="Avatar"
              className="w-24 h-24 rounded-full border-2 border-[#d4af37]"
            />
            <h2 className="text-xl font-medium text-[#e6e6e6]">{user.name}</h2>
            <p className="text-sm text-[#a3a3a3]">{user.email}</p>
          </div>

          <button
            onClick={() => {
              localStorage.removeItem("jwtToken")
              window.location.href = "/login"
            }}
            className="mt-6 w-full p-3 bg-[#d4af37] text-[#1a1a1a] rounded-lg hover:bg-[#b8860b] transition-colors font-semibold"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  )
}
