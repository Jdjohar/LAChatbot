import { Link, useLocation } from 'react-router-dom';
import React, { useState, useEffect, useRef } from "react";
export default function Navbar() {
  const location = useLocation();

  const linkStyle = (path) =>
    location.pathname === path
      ? 'text-blue-600 font-semibold'
      : 'text-gray-700';

  return (
    <nav className="bg-white shadow px-6 py-4 mb-6">
      <div className="flex gap-6 items-center">
        <Link to="/" className={linkStyle('/')}>
          🗨️ Chat
        </Link>
        <Link to="/upload" className={linkStyle('/upload')}>
          📤 Upload
        </Link>
        <Link to="/widget" className={linkStyle('/widget')}>
          ⚙️ Widget
        </Link>
      </div>
    </nav>
  );
}
