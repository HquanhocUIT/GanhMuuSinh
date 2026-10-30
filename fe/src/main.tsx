import React from 'react';
import ReactDOM from 'react-dom/client';
import Root from './Root';
import '@fontsource/be-vietnam-pro/vietnamese-400.css';
import '@fontsource/be-vietnam-pro/latin-400.css';
import '@fontsource/be-vietnam-pro/vietnamese-500.css';
import '@fontsource/be-vietnam-pro/latin-500.css';
import '@fontsource/be-vietnam-pro/vietnamese-600.css';
import '@fontsource/be-vietnam-pro/latin-600.css';
import '@fontsource/be-vietnam-pro/vietnamese-700.css';
import '@fontsource/be-vietnam-pro/latin-700.css';
import '@fontsource/lora/vietnamese-400.css';
import '@fontsource/lora/latin-400.css';
import '@fontsource/lora/vietnamese-500.css';
import '@fontsource/lora/latin-500.css';
import '@fontsource/lora/vietnamese-500-italic.css';
import '@fontsource/lora/latin-500-italic.css';
import './styles.css';
import './readability.css';
import './admin/admin.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
