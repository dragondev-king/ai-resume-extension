import React from 'react';
import ReactDOM from 'react-dom/client';
import { AppProviders } from '../components/AppProviders';
import GenerateView from '../components/GenerateView';
import '../index.css';

function PopupApp() {
  return (
    <div className="popup-shell bg-white">
      <AppProviders>
        <GenerateView compact />
      </AppProviders>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PopupApp />
  </React.StrictMode>
);
