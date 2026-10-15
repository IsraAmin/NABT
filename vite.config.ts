import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {VitePWA} from 'vite-plugin-pwa';
export default defineConfig({plugins:[react(),VitePWA({registerType:'prompt',manifest:{name:'نَبْت',short_name:'نَبْت',lang:'ar',dir:'rtl',display:'standalone',start_url:'/',theme_color:'#07662c',background_color:'#fbfaf5',icons:[{src:'/icon-192.png',sizes:'192x192',type:'image/png'},{src:'/icon-512.png',sizes:'512x512',type:'image/png'}]}})]});
