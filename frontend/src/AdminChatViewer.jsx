import React, { useEffect, useState, useRef } from 'react';

export default function AdminChatViewer() {
  const [sessions, setSessions] = useState([]);
  const [selectedVisitorId, setSelectedVisitorId] = useState(null);
  const [chatHistory, setChatHistory] = useState([]);
  const bottomRef = useRef(null);

  useEffect(() => {
    fetch('http://localhost:3000/admin/chats') // Adjust this if deployed
      .then(res => res.json())
      .then(data => setSessions(data.sessions || []))
      .catch(err => console.error('Failed to load sessions:', err));
  }, []);

 useEffect(() => {
  if (!selectedVisitorId) return;
  fetch(`http://localhost:3000/admin/chats/${selectedVisitorId}`)
    .then(res => res.json())
    .then(data => {
      console.log('API response:', data);
      setChatHistory(data.history || []);
    });
}, [selectedVisitorId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="w-64 border-r bg-white overflow-y-auto shadow-md">
        <h2 className="text-xl font-semibold text-center py-4 border-b">Visitor Sessions</h2>
    <ul className="divide-y">
  {sessions.map((s, i) => (
    <li
      key={i}
      onClick={() => setSelectedVisitorId(s._id)}
      className={`cursor-pointer px-4 py-3 hover:bg-indigo-100 ${s._id === selectedVisitorId ? 'bg-indigo-50 font-semibold' : ''}`}
    >
      <div className="text-sm font-medium">
        {i + 1}. Visitor ID: {s._id}
      </div>
      {s.lastUpdated && (
        <div className="text-xs text-gray-500">
          {new Date(s.lastUpdated).toLocaleString()}
        </div>
      )}
    </li>
  ))}
</ul>
      </div>

      {/* Chat History */}
      <div className="flex-1 flex flex-col">
        <div className="bg-indigo-600 text-white px-6 py-4 text-lg font-semibold shadow">
          {selectedVisitorId ? `Chat with ${selectedVisitorId}` : 'Select a visitor session'}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4 bg-gray-50">
            {console.log(selectedVisitorId,"selectedVisitorId")}
            {console.log(chatHistory,"chatHistory")}
            
          {chatHistory.map((msg, idx) => (
            <React.Fragment key={idx}>
              <div className="max-w-lg ml-auto bg-indigo-100 p-3 rounded-2xl shadow-sm">
                <div className="text-sm text-gray-800 whitespace-pre-line">{msg.message}</div>
              </div>
              <div className="max-w-lg mr-auto bg-white p-3 rounded-2xl shadow-sm">
                <div className="text-sm text-gray-800 whitespace-pre-line">{msg.reply}</div>
              </div>
            </React.Fragment>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  );
}
