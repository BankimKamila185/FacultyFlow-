import { messaging } from '../config/firebase';
import { getToken } from 'firebase/messaging';
import { API_URL } from '../config';

export const requestFCMToken = async (backendToken) => {
    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            console.log('Notification permission granted.');
            // Service Workers (required for FCM) don't work over file:// in Electron
            // We skip token generation if we detect a non-http environment to avoid console errors
            if (window.location.protocol === 'file:') {
                console.warn('[FCM] Skipping Service Worker registration on file:// protocol. Push notifications will work via polling instead.');
                return null;
            }

            const fcmToken = await getToken(messaging);
            // ... (rest of the logic)
            if (fcmToken) {
                console.log('FCM Token:', fcmToken);
                await fetch(`${API_URL}/auth/fcm-token`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${backendToken}`
                    },
                    body: JSON.stringify({ fcmToken }),
                });
                return fcmToken;
            }
        }
    } catch (error) {
        if (window.location.protocol === 'file:') {
            console.warn('[FCM] Native push suppressed due to protocol restrictions. System will use background sync for alerts.');
        } else {
            console.error('An error occurred while retrieving or sending the FCM token. ', error);
        }
    }
};
