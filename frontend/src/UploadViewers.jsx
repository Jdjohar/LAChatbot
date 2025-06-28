import React, { useEffect, useState } from 'react';

const VectorManager = () => {
  const [vectors, setVectors] = useState([]);
  const [queryText, setQueryText] = useState('');
  const [editText, setEditText] = useState({});
  const [loading, setLoading] = useState(false);

  const token = localStorage.getItem('token');

  const fetchVectors = async () => {
    setLoading(true);
    try {
      const url = `https://lachatbot.onrender.com/vectors${queryText ? `?queryText=${encodeURIComponent(queryText)}` : ''}`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const data = await res.json();
      setVectors(data);
    } catch (err) {
      console.error('Fetch error:', err);
      alert('Failed to fetch vectors');
    } finally {
      setLoading(false);
    }
  };

  const deleteVector = async (id) => {
    if (!window.confirm('Are you sure you want to delete this vector?')) return;
    try {
      const res = await fetch(`https://lachatbot.onrender.com/vectors/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error('Delete failed');
      setVectors(vectors.filter(v => v.id !== id));
    } catch (err) {
      console.error(err);
      alert('Delete failed');
    }
  };

  const updateVector = async (id) => {
    const newText = editText[id] || '';
    try {
      const res = await fetch(`https://lachatbot.onrender.com/vectors/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ newText })
      });
      if (!res.ok) throw new Error('Update failed');
      alert('Vector updated successfully');
      fetchVectors();
    } catch (err) {
      console.error(err);
      alert('Update failed');
    }
  };

  useEffect(() => {
    fetchVectors();
  }, []);

  return (
    <div className="max-w-4xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Your Vectors</h1>

      <div className="mb-4 flex gap-2">
        <input
          className="border p-2 flex-1"
          placeholder="Search vectors with text"
          value={queryText}
          onChange={(e) => setQueryText(e.target.value)}
        />
        <button
          onClick={fetchVectors}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          Search
        </button>
      </div>

      {loading && <p>Loading...</p>}
      {!loading && vectors.length === 0 && <p>No vectors found.</p>}

      <ul className="space-y-4">
        {vectors.map((vector) => (
          <li key={vector.id} className="border p-4 rounded shadow">
            <p className="mb-2"><strong>ID:</strong> {vector.id}</p>
            <p className="mb-2"><strong>Text:</strong> {vector.metadata?.text}</p>

            <textarea
              className="w-full border p-2 mt-2 mb-2"
              value={editText[vector.id] ?? vector.metadata?.text ?? ''}
              onChange={(e) =>
                setEditText({ ...editText, [vector.id]: e.target.value })
              }
            />

            <div className="flex gap-2">
              <button
                onClick={() => updateVector(vector.id)}
                className="bg-green-600 text-white px-3 py-1 rounded"
              >
                Update
              </button>
              <button
                onClick={() => deleteVector(vector.id)}
                className="bg-red-600 text-white px-3 py-1 rounded"
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default VectorManager;
