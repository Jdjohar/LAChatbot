import React, { useState } from "react";

export default function UploadData() {
  const [filename, setFilename] = useState('');
  const [data, setData] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [jsonMode, setJsonMode] = useState(false); // Toggle for structured input

  const handleUpload = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    const token = localStorage.getItem('token');
    if (!token) {
      setMessage('❌ You must be logged in to upload data.');
      setLoading(false);
      return;
    }

    let payload = { filename };

    try {
      if (jsonMode) {
        // Try to parse and flatten structured JSON
        const parsed = JSON.parse(data);
        if (!parsed.products || !Array.isArray(parsed.products)) {
          throw new Error("Invalid JSON structure. Expected 'products' array.");
        }

        const flatText = parsed.products
          .map(p => `${p.title}\n\n${p.text}`)
          .join('\n\n---\n\n');

        payload.data = flatText;
      } else {
        payload.data = data;
      }
    } catch (jsonErr) {
      setMessage(`❌ JSON Error: ${jsonErr.message}`);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('https://lachatbot.onrender.com/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
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
        <div className="flex items-center mb-2">
          <input
            type="checkbox"
            checked={jsonMode}
            onChange={() => setJsonMode(!jsonMode)}
            className="mr-2"
          />
          <label>Structured JSON Mode (products array)</label>
        </div>

        <div>
          <label className="block mb-1 font-medium">Filename {filename}</label>
          <input
            type="text"
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
            className="w-full border p-2 rounded"
            required
          />
        </div>

        <div>
          <label className="block mb-1 font-medium">
            {jsonMode ? "Paste Product JSON" : "Paste Raw Text Content"}
          </label>
          <textarea
            rows={10}
            value={data}
            onChange={(e) => setData(e.target.value)}
            className="w-full border p-2 rounded font-mono"
            placeholder={jsonMode ? `{
  "products": [
    {
      "title": "Product Name",
      "text": "Benefits and description here..."
    }
  ]
}` : "Paste plain text data to embed..."}
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-60"
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
