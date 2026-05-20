import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Suppress specific TensorFlow Lite WebAssembly logs
const suppressLog = (originalMethod: any) => (...args: any[]) => {
  const msg = args.join(' ');
  if (msg.includes('TensorFlow Lite XNNPACK delegate for CPU') || msg.includes('INFO: Created TensorFlow Lite')) return;
  originalMethod(...args);
};

console.info = suppressLog(console.info);
console.log = suppressLog(console.log);
console.warn = suppressLog(console.warn);
console.error = suppressLog(console.error);
console.debug = suppressLog(console.debug);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
