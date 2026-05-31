import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey:            'AIzaSyADonJ3TCdAEOHVk7oJdA8Q6JnpYiChAC4',
  authDomain:        'starfuse-765a0.firebaseapp.com',
  projectId:         'starfuse-765a0',
  storageBucket:     'starfuse-765a0.firebasestorage.app',
  messagingSenderId: '863128586971',
  appId:             '1:863128586971:android:85252f82e6a89712305afe',
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const db = getFirestore(app);
