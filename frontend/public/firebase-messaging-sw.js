importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: "AIzaSyB08-H8LJWKE7deSHmRCFSb6-XyxptFdZc",
    authDomain: "facultyflow-6c38f.firebaseapp.com",
    projectId: "facultyflow-6c38f",
    storageBucket: "facultyflow-6c38f.firebasestorage.app",
    messagingSenderId: "489085687002",
    appId: "1:489085687002:web:4880f0650f413f5cdb81e3",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: '/logo192.png'
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});
