// NABT lightweight service worker: network first and no stale application-shell caches.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',()=>{});

self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async clients=>{const existing=clients.find(c=>c.url.includes('/NABT/'));if(existing){await existing.focus();if('navigate' in existing)await existing.navigate('/NABT/#notifications');return;}return self.clients.openWindow('/NABT/#notifications');}));});
