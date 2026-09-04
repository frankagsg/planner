import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import './styles/index.css';
import './styles/calendar.css';
import App from './App';
import { SettingsProvider } from './context/SettingsContext';
import { FeedbackProvider } from './components/ui/Feedback';
import { ErrorBoundary } from './components/ErrorBoundary';

// HashRouter keeps routing working when served as static files on the Pi with
// no server-side route config.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary area="App">
      <SettingsProvider>
        <FeedbackProvider>
          <HashRouter>
            <App />
          </HashRouter>
        </FeedbackProvider>
      </SettingsProvider>
    </ErrorBoundary>
  </StrictMode>
);
