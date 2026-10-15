import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
export default defineConfig({
 plugins:[
  react(),
  VitePWA({
   registerType:'prompt',
   includeAssets:['icon.svg'],
   manifest:{
    name:'نَبْت | منصة الحضور والمعرفة',
    short_name:'نَبْت',
    description:'منصة عربية لإدارة الحضور والمكتبة المعرفية',
    lang:'ar',dir:'rtl',display:'standalone',start_url:'/',
    theme_color:'#086b34',background_color:'#faf9f4',
    icons:[{src:'/icon.svg',sizes:'any',type:'image/svg+xml',purpose:'any'}]
   },
   workbox:{navigateFallback:'/index.html'}
  })
 ]
});
