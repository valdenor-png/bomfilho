const firebaseConfig = {
  apiKey: "AIzaSyAPrrX6MTM3JkuZjXkmPvTZWcOJI8q202g",
  authDomain: "bomfilho.firebaseapp.com",
  projectId: "bomfilho",
  storageBucket: "bomfilho.firebasestorage.app",
  messagingSenderId: "81077433458",
  appId: "1:81077433458:web:3cc26477e68b7cf80afeeb",
};

const VAPID_KEY = 'BO-jXHnjrOqvTsq4ZMkRZ1CH69FNKEn7fZU3FZg_UdfCpdj7gH4vDuTc8vGwRU68Cj8iOMVUQjIzE80p5nXT4aY';

let messagingInstance = null;

async function getMessagingLazy() {
  if (messagingInstance) return messagingInstance;
  const [{ initializeApp }, { getMessaging }] = await Promise.all([
    import('firebase/app'),
    import('firebase/messaging'),
  ]);
  const app = initializeApp(firebaseConfig);
  messagingInstance = getMessaging(app);
  return messagingInstance;
}

export async function requestPushPermission() {
  try {
    const messaging = await getMessagingLazy();
    const { getToken } = await import('firebase/messaging');
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

export async function onForegroundMessage(callback) {
  try {
    const messaging = await getMessagingLazy();
    const { onMessage } = await import('firebase/messaging');
    onMessage(messaging, (payload) => {
      callback(payload);
    });
  } catch {
    // Firebase not available
  }
}
