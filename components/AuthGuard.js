"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';

export default function AuthGuard({ children, requiredRole }) {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/login');
        return;
      }

      try {
        const q = query(collection(db, "users"), where("email", "==", user.email));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
          router.push('/login');
          return;
        }

        let userData = null;
        querySnapshot.forEach((doc) => { userData = doc.data(); });

        if (userData.role === requiredRole) {
          setAuthorized(true); // Izinkan masuk
        } else {
          // Jika salah kamar, arahkan ke ruangannya masing-masing
          if (userData.role === "SUPER_ADMIN") router.push('/superadmin');
          else if (userData.role === "ADMIN") router.push('/admin');
          else if (userData.role === "CUSTOMER") router.push('/customer');
          else if (userData.role === "FULFILLMENT") router.push('/fulfillment/admin');
          else if (userData.role === "FULFILLMENT_MANAGER") router.push('/fulfillment/manager');
          else router.push('/login');
        }
      } catch (error) {
        console.error("Error AuthGuard:", error);
        router.push('/login');
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [requiredRole, router]);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-100 text-blue-600 font-bold">Memuat Sistem...</div>;
  if (!authorized) return null;

  return <>{children}</>;
}