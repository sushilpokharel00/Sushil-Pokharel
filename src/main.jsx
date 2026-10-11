import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { configureNativeApp } from './native-app.js';
import './styles.css';

configureNativeApp();

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
