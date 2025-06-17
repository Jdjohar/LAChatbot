import React, { useState, useEffect, useRef } from "react";
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import ChatbotApp from './ChatbotApp';
import Upload from './Upload';
import WidgetSettings from './WidgetSettings';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-100">
        <Navbar />
        <Routes>
          <Route path="/" element={<ChatbotApp />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/widget" element={<WidgetSettings />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
