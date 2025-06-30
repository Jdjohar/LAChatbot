import React, { useEffect, useState } from 'react';

export default function ManageKeywords() {
    const [keywords, setKeywords] = useState([]);
    const [products, setProducts] = useState([]);
    const [form, setForm] = useState({ phrase: '', product: '', weight: 1 });
    const [editingId, setEditingId] = useState(null);
    const [message, setMessage] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const token = localStorage.getItem('token');

    useEffect(() => {
        fetchKeywords();
    }, []);

    const productList = [
        'La Vedaa Happy Heart Capsules',
        'La Vedaa Men Care Capsules',
        'La Vedaa Energy Booster Capsules',
        'La Vedaa Deep Sleep Capsules',
        'La Vedaa Women Care Capsules',
        'La Vedaa Women Care & Energy Booster Combo Pack',
        'La Vedaa Men Care & Energy Booster Combo Pack',
    ];
    const fetchKeywords = async () => {
        try {
            const res = await fetch('https://lachatbot.onrender.com/admin/keywords', {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();

            if (Array.isArray(data.keywords)) {
                const sorted = [...data.keywords].sort((a, b) => b.phrase.length - a.phrase.length);
                setKeywords(sorted);
            }

            if (Array.isArray(data.products)) {
                setProducts(data.products);
            }
        } catch (err) {
            setMessage('❌ Failed to fetch keywords');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const url = editingId
            ? `https://lachatbot.onrender.com/admin/keywords/${editingId}`
            : 'https://lachatbot.onrender.com/admin/keywords';
        const method = editingId ? 'PUT' : 'POST';
const userId = localStorage.getItem('userid');
        const res = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },
             body: JSON.stringify({ ...form, userId }) // include userId
        });

        if (res.ok) {
            setMessage(editingId ? '✅ Keyword updated' : '✅ Keyword added');
            setForm({ phrase: '', product: '', weight: 1 });
            setEditingId(null);
            fetchKeywords();
        } else {
            const result = await res.json();
            setMessage(result.error || '❌ Failed to save keyword');
        }
    };

    const handleEdit = (kw) => {
        setForm({ phrase: kw.phrase, product: kw.product, weight: kw.weight });
        setEditingId(kw._id);
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this keyword?')) return;

        const res = await fetch(`https://lachatbot.onrender.com/admin/keywords/${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` }
        });

        if (res.ok) {
            setMessage('✅ Keyword deleted');
            fetchKeywords();
        } else {
            setMessage('❌ Failed to delete keyword');
        }
    };

    return (
        <div className="max-w-4xl mx-auto mt-10 p-6 bg-white shadow-lg rounded">
            <h2 className="text-2xl font-bold mb-4">🔑 Manage Product Keywords</h2>

            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <input
                    type="text"
                    placeholder="Keyword phrase"
                    value={form.phrase}
                    onChange={(e) => setForm({ ...form, phrase: e.target.value })}
                    className="border p-2 rounded"
                    required
                />
                <select
                    value={form.product || ''}
                    onChange={(e) => setForm({ ...form, product: e.target.value })}
                    className="border p-2 rounded w-full"
                    required
                >
                    <option value="">Select Product</option>
                    {productList.map((product) => (
                        <option key={product} value={product}>
                            {product}
                        </option>
                    ))}
                </select>
                <input
                    type="number"
                    value={form.weight}
                    onChange={(e) => setForm({ ...form, weight: Number(e.target.value) })}
                    className="border p-2 rounded"
                    min={1}
                    max={10}
                />
                <button
                    type="submit"
                    className="col-span-1 md:col-span-3 bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
                >
                    {editingId ? 'Update Keyword' : 'Add Keyword'}
                </button>
            </form>

            {message && <div className="mb-4 text-sm text-gray-700">{message}</div>}


            <div className="overflow-auto max-h-[500px] border rounded">
                <div className="mb-4">
                    <input
                        type="text"
                        placeholder="Search keywords or product..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="border border-gray-300 rounded px-3 py-2 w-full"
                    />
                </div>
                <table className="w-full table-auto text-sm">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="p-2 border-b">Phrase</th>
                            <th className="p-2 border-b">Product</th>
                            <th className="p-2 border-b text-center">Weight</th>
                            <th className="p-2 border-b text-center">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {keywords
                            .filter(
                                (kw) =>
                                    kw.phrase.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                    kw.product.toLowerCase().includes(searchTerm.toLowerCase())
                            )
                            .sort((a, b) => a.phrase.length - b.phrase.length)
                            .map((kw) => (
                                <tr key={kw._id}>
                                    <td className="p-2 border-b">{kw.phrase}</td>
                                    <td className="p-2 border-b">{kw.product}</td>
                                    <td className="p-2 border-b text-center">{kw.weight}</td>
                                    <td className="p-2 border-b text-center">
                                        <button onClick={() => handleEdit(kw)} className="text-blue-600 mr-3 hover:underline">Edit</button>
                                        <button onClick={() => handleDelete(kw._id)} className="text-red-600 hover:underline">Delete</button>
                                    </td>
                                </tr>
                            ))}
                        {keywords.length === 0 && (
                            <tr>
                                <td colSpan="4" className="p-4 text-center text-gray-500">No keywords yet</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
