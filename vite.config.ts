import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
// PWA cache temporarily disabled while diagnosing a blank startup screen.
// Re-enable after verifying fresh deployment on GitHub Pages.
export default defineConfig({
 base:'/NABT/',
 plugins:[react()]
});
