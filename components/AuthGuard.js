"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

export default function AuthGuard({ children, requiredRole }) {
  const [authorized, setAuthorized] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        // Jika tidak ada user yang login, arahkan ke login
        router.push('/login');
      } else {
        // Jika ada user, cek Role-nya di Firestore
        const q = query(collection(db, "users"), where("email", "==", user.email));
        const querySnapshot = await getDocs(q);
        
        let userRole = "";
        querySnapshot.forEach((doc) => {
          userRole = doc.data().role;
        });
        console.log("1. Email yang login:", user.email);
        console.log("2. Role di Database Firestore:", userRole);
        console.log("3. Role yang diminta Halaman ini:", requiredRole);

        if (userRole === requiredRole) {
          setAuthorized(true); // Role cocok, izinkan masuk
        } else {
          // Role tidak cocok (misal Customer coba buka Admin)
          router.push('/login');
        }
      }
    });

    return () => unsubscribe();
  }, [router, requiredRole]);

  if (!authorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 text-black font-bold">
        Memeriksa Izin Akses...
      </div>
    );
  }

  return children;
}