import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// TODO: Replace with your real Firebase config from console.firebase.google.com
// Project settings → Your apps → Web app → SDK setup and configuration
const firebaseConfig = {
  apiKey:            'YOUR_API_KEY',
  authDomain:        'YOUR_PROJECT_ID.firebaseapp.com',
  projectId:         'YOUR_PROJECT_ID',
  storageBucket:     'YOUR_PROJECT_ID.appspot.com',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId:             'YOUR_APP_ID',
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const db = getFirestore(app);
