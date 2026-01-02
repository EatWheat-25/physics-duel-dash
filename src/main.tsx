import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import 'katex/dist/katex.min.css'
import 'katex/dist/contrib/mhchem.mjs'
import './index.css'

createRoot(document.getElementById("root")!).render(<App />);
