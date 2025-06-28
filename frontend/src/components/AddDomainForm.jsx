import React, { useState, useEffect } from 'react';

const AddDomainForm = () => {
  const token  = localStorage.getItem("token");
  const [domain, setDomain] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    console.log(token,"token");
    
    e.preventDefault();
    setMessage('');
    setError('');
    if (!token) {
      setError('Please log in to add a domain.');
      return;
    }
    try {
      const response = await fetch('http://localhost:3000/add-domain', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ domain }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to add domain');
      }
      setMessage(data.message || 'Domain added successfully');
      setDomain('');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div style={{ margin: '20px 0', padding: '15px', border: '1px solid #ddd', borderRadius: '5px' }}>
      <h3>Add Customer Website Domain</h3>
      <p className='p-2'>Enter the domain where you’ll embed the chatbot widget (e.g., https://customerwebsite.com).</p>
      <form onSubmit={handleSubmit} >
        <input
          type="text"
          value={domain}
          className='mb-3'
          onChange={(e) => setDomain(e.target.value)}
          placeholder="https://customerwebsite.com"
          style={{ padding: '8px', width: '300px', marginRight: '10px', borderRadius: '4px', border: '1px solid #ccc' }}
          required
        />
        <button
          type="submit"
          style={{
            padding: '8px 16px',
            background: '#1e3a8a',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Add Domain
        </button>
      </form>
      {message && <p style={{ color: 'green', marginTop: '10px' }}>{message}</p>}
      {error && <p style={{ color: 'red', marginTop: '10px' }}>{error}</p>}
    </div>
  );
};

export default AddDomainForm;