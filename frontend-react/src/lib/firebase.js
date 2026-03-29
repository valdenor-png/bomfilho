import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: "AIzaSyAPrrX6MTM3JkuZjXkmPvTZWcOJI8q202g",
  authDomain: "bomfilho.firebaseapp.com",
  projectId: "bomfilho",
  storageBucket: "bomfilho.firebasestorage.app",
  messagingSenderId: "81077433458",
  appId: "1:81077433458:web:3cc26477e68b7cf80afeeb",
};

const VAPID_KEY = 'BO-jXHnjrOqvTsq4ZMkRZ1CH69FNKEn7fZU3FZg_UdfCpdj7gH4vDuTc8vGwRU68Cj8iOMVUQjIzE80p5nXT4aY';

let app, messaging;

try {
  app = initializeApp(firebaseConfig);
  messaging = getMessaging(app);
} catch (err) {
  console.warn('Firebase init failed:', err);
}

export async function requestPushPermission() {
  if (!messaging) return null;
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;
    const token = await getToken(messaging, { vapidKey: VAPID_KEY });
    if (token) {
      localStorage.setItem('bomfilho_push_token', token);
    }
    return token;
  } catch (err) {
    console.warn('Push permission error:', err);
    return null;
  }
}

export function onForegroundMessage(callback) {
  if (!messaging) return;
  onMessage(messaging, (payload) => {
    callback(payload);
  });
}
