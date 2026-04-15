"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { collection, addDoc } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({ email: '', password: '', tenantId: '' });
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');

    try {
      // 1. Buat Akun Auth di Firebase
      const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
      
      // 2. Buat "KTP" di Firestore dan tetapkan rolenya sebagai CUSTOMER
      await addDoc(collection(db, "users"), {
        email: userCredential.user.email,
        role: "CUSTOMER",
        tenantId: formData.tenantId.toLowerCase().replace(/\s+/g, '') // Hilangkan spasi dan jadikan huruf kecil
      });

      alert("Pendaftaran berhasil! Silakan login.");
      router.push('/login');

    } catch (error) {
      console.error(error);
      setErrorMsg("Gagal mendaftar: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-xl shadow-md p-8 border border-gray-100">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-orange-600">Daftar Tenant Baru</h1>
          <p className="text-gray-500 text-sm mt-1">Buat akun untuk klien logistik Anda</p>
        </div>

        {errorMsg && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-6 border border-red-100">{errorMsg}</div>
        )}

        <form onSubmit={handleRegister} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nama Tenant / Merek</label>
            <input 
              type="text" required placeholder="Misal: Juragan Baju"
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 text-black"
              onChange={(e) => setFormData({...formData, tenantId: e.target.value})}
            />
            <p className="text-xs text-gray-400 mt-1">Akan otomatis menjadi ID (Tanpa spasi)</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input 
              type="email" required placeholder="nama@email.com"
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 text-black"
              onChange={(e) => setFormData({...formData, email: e.target.value})}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input 
              type="password" required placeholder="Minimal 6 karakter"
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 text-black"
              onChange={(e) => setFormData({...formData, password: e.target.value})}
            />
          </div>

          <button type="submit" disabled={isLoading} className="w-full bg-orange-600 text-white font-bold py-3 rounded-lg hover:bg-orange-700 transition disabled:bg-orange-400 mt-4">
            {isLoading ? "Mendaftarkan..." : "Daftar Tenant"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          Sudah punya akun? <Link href="/login" className="text-blue-600 font-bold hover:underline">Masuk di sini</Link>
        </p>
      </div>
    </div>
  );
}