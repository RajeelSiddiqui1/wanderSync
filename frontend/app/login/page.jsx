"use client"

import { useState } from "react"
import { Eye, EyeOff } from "lucide-react"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState(null)

  const handleLogin = async (e) => {
    e.preventDefault()
    setMessage(null)

    if (!email || !password) {
      setMessage({ type: "error", text: "Email and password are required!" })
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch("http://127.0.0.1:5000/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      setIsLoading(false)

      if (data.success) {
        setMessage({ type: "success", text: data.message })
        localStorage.setItem("jwtToken", data.jwt)
        setEmail("")
        setPassword("")
        // Optional: redirect to chat page
        window.location.href = "/chatbot"
      } else {
        setMessage({ type: "error", text: data.message })
      }
    } catch (err) {
      setIsLoading(false)
      setMessage({ type: "error", text: err.message })
    }
  }

  return (
    <div className="flex items-center justify-center h-screen bg-[#1a1a1a] text-[#e6e6e6] font-sans">
      <div className="w-full max-w-md p-8 bg-[#262626] rounded-xl border border-[#333] shadow-lg animate-fade-in">
        <h1 className="text-2xl font-semibold text-center text-[#d4af37] mb-2">🔑 Login</h1>
        <p className="text-sm text-[#a3a3a3] text-center mb-6">Access your WanderSync account</p>

        {message && (
          <p
            className={`text-sm mb-4 px-3 py-2 rounded ${
              message.type === "error" ? "bg-[#4b0000] text-[#ff6961]" : "bg-[#1a3d1a] text-[#33cc33]"
            }`}
          >
            {message.text}
          </p>
        )}

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <input
            type="email"
            placeholder="Email Address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="p-3 bg-[#1a1a1a] border border-[#444] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d4af37] placeholder-[#a3a3a3] text-[#e6e6e6] transition-all"
          />

          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 bg-[#1a1a1a] border border-[#444] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#d4af37] placeholder-[#a3a3a3] text-[#e6e6e6] transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#d4af37] hover:text-[#b8860b]"
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="p-3 bg-[#d4af37] text-[#1a1a1a] rounded-lg hover:bg-[#b8860b] disabled:bg-[#444] disabled:cursor-not-allowed transition-colors font-semibold"
          >
            {isLoading ? "Logging in..." : "Login"}
          </button>
        </form>

        <p className="text-xs text-center text-[#a3a3a3] mt-4">
          Don't have an account? <a href="/register" className="text-[#d4af37] hover:text-[#b8860b]">Register</a>
        </p>
      </div>
    </div>
  )
}
