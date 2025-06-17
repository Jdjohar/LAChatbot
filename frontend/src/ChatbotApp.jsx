import React, { useState, useEffect, useRef } from "react";

/**
 * ChatbotApp.jsx – A single‑page React UI for your Node/Express chatbot backend.
 *
 * ➡️ Features
 *   • Signup & Login (JWT stored in localStorage)
 *   • Chat interface with streaming‑like UX (shows user msg instantly, waits for bot reply)
 *   • Minimal Tailwind styling + smooth scroll to bottom
 *
 * 📦 Assumes backend routes:
 *   POST /signup { username, password }
 *   POST /login  { username, password }  -> { token }
 *   POST /chat   { message } ("Authorization: Bearer <token>") -> { reply }
 */

export default function ChatbotApp() {
    const [token, setToken] = useState(() => localStorage.getItem("token") || "");
    const [view, setView] = useState(token ? "chat" : "auth");

    function handleAuthSuccess(jwt) {
        localStorage.setItem("token", jwt);
        setToken(jwt);
        setView("chat");
    }

    function handleLogout() {
        localStorage.removeItem("token");
        localStorage.removeItem("userid");
        setToken("");
        setView("auth");
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-100 via-white to-pink-100 p-4">
            <div className="w-full max-w-md shadow-2xl rounded-2xl bg-white overflow-hidden">
                {view === "auth" ? (
                    <AuthForm onSuccess={handleAuthSuccess} />
                ) : (
                    <ChatUI token={token} onLogout={handleLogout} />
                )}
            </div>
        </div>
    );
}

/********************* AUTH ************************/
function AuthForm({ onSuccess }) {
    const [mode, setMode] = useState("login"); // "login" | "signup"
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const BASE_URL = "http://localhost:3000";
    const endpoint = mode === "login" ? `${BASE_URL}/login` : `${BASE_URL}/signup`;

    async function handleSubmit(e) {
        e.preventDefault();
        setError("");
        try {
            const res = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();
            console.log(data, "data");
            localStorage.setItem("userid", data.userid)
            
            if (!res.ok) throw new Error(data.error || "Something went wrong");
            if (mode === "login") {
                onSuccess(data.token);
            } else {
                // Auto‑switch to login on successful signup
                setMode("login");
                setUsername("");
                setPassword("");
                setError("Signup successful! Please log in.");
            }
        } catch (err) {
            setError(err.message);
        }
    }

    return (
        <div className="p-8">

            <h2 className="text-2xl font-semibold mb-6 text-center capitalize">{mode}</h2>
            {error && <p className="mb-4 text-sm text-red-600 text-center">{error}</p>}
            <form onSubmit={handleSubmit} className="space-y-4">
                <input
                    className="w-full border rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    placeholder="Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                />
                <input
                    className="w-full border rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    placeholder="Password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                />
                <button
                    type="submit"
                    className="w-full bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl py-3 transition"
                >
                    {mode === "login" ? "Log In" : "Sign Up"}
                </button>
            </form>

            <p className="mt-6 text-center text-sm">
                {mode === "login" ? "Don't have an account?" : "Already have an account?"}
                <button
                    onClick={() => setMode(mode === "login" ? "signup" : "login")}
                    className="ml-1 text-indigo-600 hover:underline"
                >
                    {mode === "login" ? "Sign up" : "Log in"}
                </button>
            </p>
        </div>
    );
}

/********************* CHAT ************************/
function ChatUI({ token, onLogout }) {
    const [messages, setMessages] = useState([]); // { sender: "user"|"bot", text }
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const bottomRef = useRef(null);

    useEffect(() => {
  const fetchChats = async () => {
    const token = localStorage.getItem('token');
    const res = await fetch('http://localhost:3000/chats', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    console.log(data,"data");
    
setMessages(
  data.flatMap(c => {
    const msgs = [{ sender: "user", text: c.message }];
    if (c.reply) msgs.push({ sender: "bot", text: c.reply });
    return msgs;
  })
);
};

  fetchChats();
}, []);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    async function sendMessage(e) {
        e.preventDefault();
        if (!input.trim() || loading) return;

        const userText = input.trim();
        setMessages((m) => [...m, { sender: "user", text: userText }]);
        setInput("");
        setLoading(true);
        console.log("token:", token);
        console.log("userText:", userText);
         const BASE_URL = "http://localhost:3000";
        try {
            const res = await fetch(`${BASE_URL}/chat`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ message: userText }),
            });
            console.log(res,"res");
            const data = await res.json();
            console.log(data,"data");
            
            setMessages((m) => [...m, { sender: "bot", text: data.reply || data.error }]);
        } catch (err) {
            setMessages((m) => [...m, { sender: "bot", text: "Error contacting server." }]);
        }
        setLoading(false);
    }

    return (
        <div className="flex flex-col h-[32rem]">
            {/* Header */}
            <div className="bg-indigo-500 text-white p-4 flex justify-between items-center">
                <h3 className="font-semibold">Chatbot</h3>
                <button onClick={onLogout} className="text-sm hover:underline">
                    Logout
                </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4 bg-gray-50">
                {messages.map((msg, idx) => (
                    <div
                        key={idx}
                        className={`max-w-xs rounded-2xl p-3 shadow ${msg.sender === "user"
                            ? "ml-auto bg-indigo-100"
                            : "mr-auto bg-white"
                            }`}
                    >
                        {msg.text}
                    </div>
                ))}
                {loading && (
                    <div className="mr-auto bg-white max-w-xs rounded-2xl p-3 shadow animate-pulse">
                        ...
                    </div>
                )}
                <div ref={bottomRef} />
            </div>

            {/* Input */}
            <form onSubmit={sendMessage} className="p-4 flex gap-2 bg-white border-t">
                <input
                    className="flex-1 border rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    placeholder="Type a message..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                />
                <button
                    type="submit"
                    className="bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-xl disabled:opacity-50"
                    disabled={loading}
                >
                    Send
                </button>
            </form>
        </div>
    );
}
