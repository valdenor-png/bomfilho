importScripts('https://www.gstatic.com/firebasejs/12.11.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.11.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyAPrrX6MTM3JkuZjXkmPvTZWcOJI8q202g",
  authDomain: "bomfilho.firebaseapp.com",
  projectId: "bomfilho",
  storageBucket: "bomfilho.firebasestorage.app",
  messagingSenderId: "81077433458",
  appId: "1:81077433458:web:3cc26477e68b7cf80afeeb",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title, body, icon } = payload.notification || {};
  self.registration.showNotification(title || 'BomFilho', {
    body: body || 'Voce tem uma nova notificacao',
    icon: icon || '/img/icone_oficial.png',
    badge: '/img/icone_oficial.png',
    data: payload.data,
    vibrate: [200, 100, 200],
  });
});
