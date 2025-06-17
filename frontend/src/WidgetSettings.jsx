import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AddDomainForm from './components/AddDomainForm'

const WidgetSettings = () => {
  const [settings, setSettings] = useState({ theme: '#1e3a8a', position: 'bottom-right', avatar: '' });
  const [embedCode, setEmbedCode] = useState('');
  const [message, setMessage] = useState('');
  const token = localStorage.getItem('token');
  const navigate = useNavigate();
  const userId = localStorage.getItem("userid") // Replace with dynamic userId from auth

  useEffect(() => {
    if (!token) navigate('/');
    fetchEmbedCode();
  }, [token, navigate]);

  const fetchEmbedCode = async () => {
    try {
      const res = await fetch(`http://localhost:3000/widget/${userId}`);
      const { embedCode } = await res.json();
      setEmbedCode(embedCode);
    } catch (err) {
      setMessage('Error fetching embed code');
    }
  };

  const handleSave = async () => {
    try {
      const res = await fetch('http://localhost:3000/widget/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ userId, ...settings })
      });
      const data = await res.json();
      setMessage(data.message);
      fetchEmbedCode();
    } catch (err) {
      setMessage('Error saving settings');
    }
  };

  return (
    <div className="p-4 max-w-md mx-auto">
      <h2 className="text-2xl mb-4">Widget Settings</h2>
      <div className="mb-4">
        <label className="block mb-1">Theme Color</label>
        <input
          type="color"
          value={settings.theme}
          onChange={e => setSettings({ ...settings, theme: e.target.value })}
          className="w-full"
        />
      </div>
      <div className="mb-4">
        <label className="block mb-1">Position</label>
        <select
          value={settings.position}
          onChange={e => setSettings({ ...settings, position: e.target.value })}
          className="w-full p-2 border rounded"
        >
          <option value="bottom-right">Bottom Right</option>
          <option value="bottom-left">Bottom Left</option>
        </select>
      </div>
      <div className="mb-4">
        <label className="block mb-1">Avatar URL</label>
        <input
          type="text"
          value={settings.avatar}
          onChange={e => setSettings({ ...settings, avatar: e.target.value })}
          className="w-full p-2 border rounded"
          placeholder="https://example.com/avatar.png"
        />
      </div>
      <button
        onClick={handleSave}
        className="bg-blue-900 text-white p-2 rounded"
      >
        Save Settings
      </button>

      <AddDomainForm />
      {embedCode && (
        <div className="mt-4">
          <h3 className="text-lg mb-2">Embed Code</h3>
          <textarea
            readOnly
            value={embedCode}
            className="w-full p-2 border rounded"
            rows="4"
          />
          <p className="text-sm mt-2">Copy this code and paste it before the body tag in your website's HTML.</p>
        </div>
      )}
      {message && <p className="mt-2 text-green-600">{message}</p>}
    </div>
  );
};

export default WidgetSettings;