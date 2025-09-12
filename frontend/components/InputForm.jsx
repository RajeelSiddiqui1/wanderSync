"use client"

import { useState } from 'react';

function InputForm({ onSubmit }) {
  const [query, setQuery] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(query);
    setQuery('');
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-3 bg-gray-800 p-3 rounded-xl border border-gray-700">
      <textarea
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Enter your travel query..."
        className="flex-1 bg-gray-800 border-none text-white p-3 rounded-lg h-16 resize-none focus:outline-none"
        required
      />
      <button
        type="submit"
        className="bg-purple-500 text-white px-6 py-3 rounded-lg hover:bg-purple-600 transition-colors"
      >
        Send
      </button>
    </form>
  );
}

export default InputForm;