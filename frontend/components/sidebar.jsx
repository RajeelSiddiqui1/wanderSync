'use client'

import { useState, useEffect } from "react"
import { Menu, X, ChevronUp, ChevronDown } from 'lucide-react'

export function Sidebar({ isOpen, toggleSidebar }) {
  const navItems = [
    { name: 'Chat', href: '/chatbot' },
    { name: 'History', href: '/history' },
  ]

  const [showBottomMenu, setShowBottomMenu] = useState(false)
  const [currentPath, setCurrentPath] = useState('')

  useEffect(() => {
    setCurrentPath(window.location.pathname)
  }, [])

  const handleToggleBottomMenu = () => setShowBottomMenu(!showBottomMenu)

  return (
    <div className={`fixed inset-y-0 left-0 transform ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 w-64 bg-[#0a0e1a] text-[#d9e1ff] transition-transform duration-300 ease-in-out z-40 border-r border-[#2a3457] shadow-lg flex flex-col justify-between`}>
      <div className="p-6">
        <h2 className="text-2xl font-extrabold text-[#4a90e2] mb-8 tracking-tight">🌍 WanderSync</h2>
        <nav className="space-y-2">
          {navItems.map((item) => (
            <a
              key={item.name}
              href={item.href}
              className={`block py-2 px-4 rounded-xl transition-colors border-l-4 font-medium
                ${currentPath === item.href ? 'bg-[#1e2742] border-[#4a90e2] text-[#d9e1ff]' : 'border-transparent hover:bg-[#1e2742] hover:border-[#4a90e2] text-[#d9e1ff]'}
                `}
              onClick={toggleSidebar}
            >
              {item.name}
            </a>
          ))}
        </nav>
      </div>

      <div className="p-6 border-t border-[#2a3457] relative">
        <button
          onClick={handleToggleBottomMenu}
          className="flex justify-between items-center w-full p-2 bg-[#12172b] rounded-lg hover:bg-[#2a3457] transition-colors text-[#4a90e2]"
        >
          <span>User Menu</span>
          {showBottomMenu ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {showBottomMenu && (
          <div className="absolute bottom-16 left-6 w-[calc(100%-1.5rem)] bg-[#12172b] border border-[#2a3457] rounded-lg shadow-xl flex flex-col mt-2 overflow-hidden z-50">
            <a
              href="/profile"
              className="block px-4 py-2 hover:bg-[#2a3457] transition-colors text-[#d9e1ff]"
              onClick={toggleSidebar}
            >
              Profile
            </a>
            <button
              onClick={() => {
                localStorage.removeItem("jwtToken")
                localStorage.removeItem("user_id")  // ✅ user_id bhi hatao
                window.location.href = "/login"
              }}
              className="w-full text-left px-4 py-2 hover:bg-[#2a3457] transition-colors text-[#d9e1ff]"
            >
              Logout
            </button>

          </div>
        )}
      </div>
    </div>
  )
}