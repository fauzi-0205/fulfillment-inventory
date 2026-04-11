import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth"; // Ini tambahan untuk fitur Login

const firebaseConfig = {
  apiKey: "AIzaSyCvQoMBeBJAnvSxvGMLS1aS2NR0zjJo7dU",
  authDomain: "fulfillment-inventory.firebaseapp.com",
  projectId: "fulfillment-inventory",
  storageBucket: "fulfillment-inventory.firebasestorage.app",
  messagingSenderId: "1095848219156",
  appId: "1:1095848219156:web:a5cc6d7245e9ea34c08d01",
};

// Inisialisasi Firebase
const app = initializeApp(firebaseConfig);

// Inisialisasi Firestore (Database)
const db = getFirestore(app);

// Inisialisasi Authentication (Keamanan)
const auth = getAuth(app);

// Export db dan auth agar bisa dipakai di halaman lain
export { db, auth };