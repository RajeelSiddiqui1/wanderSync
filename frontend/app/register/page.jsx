"use client"

import { useState } from "react"
import { Eye, EyeOff } from "lucide-react"

export default function RegisterPage() {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState(null)

  const handleRegister = async (e) => {
    e.preventDefault()
    setMessage(null)

    if (!name || !email || !password) {
      setMessage({ type: "error", text: "All fields are required!" })
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch("http://127.0.0.1:5000/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      })
      const data = await res.json()
      setIsLoading(false)
      if (data.success) {
        setMessage({ type: "success", text: data.message })
        setName("")
        setEmail("")
        setPassword("")
        window.location.href = "/login"
      } else {
        setMessage({ type: "error", text: data.message })
      }
    } catch (err) {
      setIsLoading(false)
      setMessage({ type: "error", text: err.message })
    }
  }

  return (
    <div className="flex items-center justify-center h-screen bg-[#0a0e1a] text-[#d9e1ff] font-sans">
      <div className="w-full max-w-md p-8 bg-[#12172b] rounded-2xl border border-[#2a3457] shadow-md hover:shadow-xl transition-all duration-300">
        <h1 className="text-2xl font-semibold text-center text-[#4a90e2] mb-2">📝 Register</h1>
        <p className="text-sm text-[#7f8dc5] text-center mb-6">Create your WanderSync account</p>

        {message && (
          <p
            className={`text-sm mb-4 px-3 py-2 rounded-lg ${
              message.type === "error" ? "bg-[#4b0000] text-[#ff6961]" : "bg-[#1a3d1a] text-[#33cc33]"
            }`}
          >
            {message.text}
          </p>
        )}

        <form onSubmit={handleRegister} className="flex flex-col gap-4">
          <input
            type="text"
            placeholder="Full Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="p-3 bg-[#12172b] border border-[#2a3457] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4a90e2] placeholder-[#7f8dc5] text-[#d9e1ff] transition-all"
          />

          <input
            type="email"
            placeholder="Email Address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="p-3 bg-[#12172b] border border-[#2a3457] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4a90e2] placeholder-[#7f8dc5] text-[#d9e1ff] transition-all"
          />

          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 bg-[#12172b] border border-[#2a3457] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4a90e2] placeholder-[#7f8dc5] text-[#d9e1ff] transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#4a90e2] hover:text-[#357abd]"
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="p-3 bg-[#4a90e2] text-[#0a0e1a] rounded-lg hover:bg-[#357abd] disabled:bg-[#2a3457] disabled:cursor-not-allowed transition-colors font-semibold"
          >
            {isLoading ? "Creating Account..." : "Register"}
          </button>
        </form>

        <p className="text-xs text-center text-[#7f8dc5] mt-4">
          Already have an account? <a href="/login" className="text-blue-400 hover:underline">Login</a>
        </p>
      </div>
    </div>
  )
}