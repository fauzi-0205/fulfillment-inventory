"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { collection, query, where, getDocs, updateDoc, doc, addDoc, serverTimestamp } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../../lib/firebase';

import AuthGuard from '@/components/AuthGuard';

export default function CustomerDashboard() {
  const router = useRouter();
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const [tenantId, setTenantId] = useState("");
  
  const [selectedItems, setSelectedItems] = useState([]);
  const [isRequesting, setIsRequesting] = useState(false);
  // STATE BARU: Untuk menyimpan catatan / instruksi
  const [requestNote, setRequestNote] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserEmail(user.email);
        await fetchCustomerData(user.email);
      } else {
        router.push('/login');
      }
    });
    return () => unsubscribe();
  }, [router]);

  const fetchCustomerData = async (email) => {
    try {
      const userQuery = query(collection(db, "users"), where("email", "==", email));
      const userSnapshot = await getDocs(userQuery);
      
      let currentTenantId = "";
      userSnapshot.forEach((doc) => { currentTenantId = doc.data().tenantId; });

      if (!currentTenantId) { setLoading(false); return; }
      setTenantId(currentTenantId);

      const inventoryQuery = query(collection(db, "inventory"), where("tenantId", "==", currentTenantId));
      const inventorySnapshot = await getDocs(inventoryQuery);
      
      const items = [];
      inventorySnapshot.forEach((doc) => { items.push({ id: doc.id, ...doc.data() }); });
      setInventory(items);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckboxChange = (itemId) => {
    if (selectedItems.includes(itemId)) {
      setSelectedItems(selectedItems.filter(id => id !== itemId));
    } else {
      setSelectedItems([...selectedItems, itemId]);
    }
  };

  const handleRequestShipment = async () => {
    if (selectedItems.length === 0) return;
    setIsRequesting(true);

    try {
      for (const itemId of selectedItems) {
        // 1. Ubah status barang
        const itemRef = doc(db, "inventory", itemId);
        await updateDoc(itemRef, { status: "REQUESTED" });

        // 2. Simpan ke riwayat beserta CATATAN (Notes)
        await addDoc(collection(db, "shippingRequests"), {
          inventoryId: itemId,
          tenantId: tenantId,
          requestedBy: userEmail,
          customerNotes: requestNote, // DATA NOTE MASUK KE SINI
          status: "PENDING",
          requestedAt: serverTimestamp()
        });
      }

      alert(`Sukses! Permintaan pengiriman telah dikirim ke Admin.`);
      
      setSelectedItems([]);
      setRequestNote(""); // Kosongkan catatan setelah sukses
      await fetchCustomerData(userEmail);

    } catch (error) {
      console.error("Error requesting shipment: ", error);
      alert("Terjadi kesalahan saat memproses permintaan.");
    } finally {
      setIsRequesting(false);
    }
  };

  return (
    <AuthGuard requiredRole="CUSTOMER">
    <div className="min-h-screen bg-gray-50 flex">
      <aside className="w-64 bg-teal-800 text-white flex flex-col">
        <div className="p-6">
          <h2 className="text-2xl font-bold text-teal-400">Client Portal</h2>
          <p className="text-sm text-teal-200 mt-1">{userEmail}</p>
        </div>
        <nav className="flex-1 px-4 space-y-2">
          <Link href="/customer" className="block px-4 py-2 bg-teal-600 rounded-md">Stok Saya</Link>
          <Link href="#" className="block px-4 py-2 hover:bg-teal-700 rounded-md">Riwayat Pengiriman</Link>
        </nav>
      </aside>

      <main className="flex-1 p-8">
        <div className="flex justify-between items-start mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Daftar Barang di Gudang</h1>
          
          {/* AREA TOMBOL & CATATAN (Hanya muncul jika ada barang dicentang) */}
          <div className="flex flex-col items-end w-1/3">
            {selectedItems.length > 0 && (
              <textarea 
                className="w-full p-3 mb-3 border border-gray-300 rounded-lg text-sm text-black focus:ring-2 focus:ring-orange-500"
                rows="2"
                placeholder="Instruksi pengiriman (Misal: Tolong double wrap, pakai kurir X...)"
                value={requestNote}
                onChange={(e) => setRequestNote(e.target.value)}
              />
            )}
            
            <button 
              onClick={handleRequestShipment}
              disabled={selectedItems.length === 0 || isRequesting}
              className={`px-6 py-3 rounded-lg font-bold shadow w-full transition ${
                selectedItems.length === 0 
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                : 'bg-orange-500 text-white hover:bg-orange-600'
              }`}
            >
              {isRequesting ? 'Memproses...' : `📦 Minta Kirim Barang (${selectedItems.length})`}
            </button>
          </div>
        </div>

        {/* TABEL BARANG (Tetap sama seperti sebelumnya) */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Memuat data barang Anda...</div>
          ) : inventory.length === 0 ? (
            <div className="p-8 text-center text-gray-500">Belum ada barang di gudang.</div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-100 text-gray-700 text-sm">
                  <th className="p-4 border-b w-12 text-center">Pilih</th>
                  <th className="p-4 border-b">Package ID</th>
                  <th className="p-4 border-b">Penerima</th>
                  <th className="p-4 border-b">No Rak</th>
                  <th className="p-4 border-b">Status</th>
                </tr>
              </thead>
              <tbody>
                {inventory.map((item) => (
                  <tr key={item.id} className={`hover:bg-gray-50 text-gray-800 border-b ${selectedItems.includes(item.id) ? 'bg-orange-50' : ''}`}>
                    <td className="p-4 text-center">
                      <input 
                        type="checkbox" 
                        className="w-5 h-5 text-orange-500 rounded border-gray-300 cursor-pointer disabled:opacity-50"
                        checked={selectedItems.includes(item.id)}
                        onChange={() => handleCheckboxChange(item.id)}
                        disabled={item.status !== "IN_WAREHOUSE"} 
                      />
                    </td>
                    <td className="p-4 font-medium">{item.packageId}</td>
                    <td className="p-4">{item.recipientName}</td>
                    <td className="p-4">{item.sackNumber}</td>
                    <td className="p-4">
                      <span className={`text-xs font-bold px-2 py-1 rounded ${
                        item.status === 'IN_WAREHOUSE' ? 'bg-blue-100 text-blue-800' :
                        item.status === 'REQUESTED' ? 'bg-orange-100 text-orange-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
    </AuthGuard>
  );
}