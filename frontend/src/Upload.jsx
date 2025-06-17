import React, { useState, useEffect, useRef } from "react";
export default function UploadData() {
  const [filename, setFilename] = useState('');
  const [data, setData] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleUpload = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    const token = localStorage.getItem('token');
    if (!token) {
      setMessage('You must be logged in to upload data.');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('http://localhost:3000/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ filename, data }),
      });

      const result = await res.json();

      if (res.ok) {
        setMessage('✅ Data uploaded successfully!');
        setFilename('');
        setData('');
      } else {
        setMessage(`❌ ${result.error}`);
      }
    } catch (error) {
      console.error('Upload failed:', error);
      setMessage('❌ Upload failed. Check console for details.');
    }

    setLoading(false);
  };

  return (
    <div className="max-w-xl mx-auto p-4 mt-10 bg-white shadow-xl rounded-lg">
      <h2 className="text-2xl font-semibold mb-4">Upload New Data</h2>
      <form onSubmit={handleUpload} className="space-y-4">
        <div>
          <label className="block mb-1">Filename</label>
          <input
            type="text"
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
            className="w-full border p-2 rounded"
            required
          />
        </div>
        <div>
          <label className="block mb-1">Text Content</label>
          <textarea
            rows={8}
            value={data}
            onChange={(e) => setData(e.target.value)}
            className="w-full border p-2 rounded"
            required
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          {loading ? 'Uploading...' : 'Upload'}
        </button>
      </form>
      {message && (
        <div className="mt-4 text-center text-sm text-gray-700">{message}</div>
      )}
    </div>
  );
}
