"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, where, getDocs, updateDoc, doc, addDoc, serverTimestamp } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../../lib/firebase';
import AuthGuard from '../../components/AuthGuard';

export default function CustomerDashboard() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState("");
  const [tenantId, setTenantId] = useState("");
  
  // Tab & Loading States
  const [activeTab, setActiveTab] = useState("STOK"); // 'STOK' (Sampingan Sidebar) atau 'LOG'
  const [statusTab, setStatusTab] = useState("IN_WAREHOUSE"); // Tab filter status
  const [loading, setLoading] = useState(true);

  // Data States
  const [inventory, setInventory] = useState([]);
  const [logs, setLogs] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");

  // Modal States
  const [selectedImage, setSelectedImage] = useState(null);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [selectedItems, setSelectedItems] = useState([]);
  const [requestNote, setRequestNote] = useState("");
  const [isRequesting, setIsRequesting] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserEmail(user.email);
        await fetchData(user.email);
      } else {
        router.push('/login');
      }
    });
    return () => unsubscribe();
  }, [router]);

  const fetchData = async (email) => {
    setLoading(true);
    try {
      const userQuery = query(collection(db, "users"), where("email", "==", email));
      const userSnapshot = await getDocs(userQuery);
      
      let currentTenantId = "";
      userSnapshot.forEach((doc) => { currentTenantId = doc.data().tenantId; });
      if (!currentTenantId) return;
      setTenantId(currentTenantId);

      // Ambil Barang
      const invQuery = query(collection(db, "inventory"), where("tenantId", "==", currentTenantId));
      const invSnapshot = await getDocs(invQuery);
      setInventory(invSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      // Ambil Log
      const logQuery = query(collection(db, "logs"), where("tenantId", "==", currentTenantId));
      const logSnapshot = await getDocs(logQuery);
      const logsData = logSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      logsData.sort((a, b) => (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0));
      setLogs(logsData);

    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  // Filter Data Berdasarkan Tab Status & Search
  const filteredInventory = inventory.filter(item => {
    const matchStatus = item.status === statusTab;
    const matchSearch = item.packageId?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        item.recipientName?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchStatus && matchSearch;
  });

  // Hitung Statistikm
  const countInWarehouse = inventory.filter(i => i.status === "IN_WAREHOUSE").length;
  const countShipped = inventory.filter(i => i.status === "SHIPPED").length;

  const handleCheckboxChange = (id) => {
    setSelectedItems(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  };

  const handleRequestShipment = async () => {
    setIsRequesting(true);
    try {
      for (const itemId of selectedItems) {
        await updateDoc(doc(db, "inventory", itemId), { status: "REQUESTED" });
        await addDoc(collection(db, "shippingRequests"), {
          inventoryId: itemId, tenantId, requestedBy: userEmail,
          customerNotes: requestNote, status: "PENDING", requestedAt: serverTimestamp()
        });
      }

      await addDoc(collection(db, "logs"), {
        tenantId, userEmail, action: "MINTA KIRIM",
        details: `Meminta kirim ${selectedItems.length} barang. Note: ${requestNote || "-"}`,
        timestamp: serverTimestamp()
      });

      alert("Permintaan pengiriman berhasil dikirim!");
      setShowNoteModal(false);
      setSelectedItems([]);
      setRequestNote("");
      await fetchData(userEmail);
    } catch (error) { alert("Gagal."); } finally { setIsRequesting(false); }
  };

  return (
    <AuthGuard requiredRole="CUSTOMER">
      <div className="min-h-screen bg-gray-50 flex">
        
        {/* POP-UP FOTO */}
        {selectedImage && (
          <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4" onClick={() => setSelectedImage(null)}>
            <img src={selectedImage} className="max-h-[90vh] rounded-lg shadow-2xl border-4 border-white" alt="Zoom" />
          </div>
        )}

        {/* POP-UP NOTE SHIPPING */}
        {showNoteModal && (
          <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
              <h3 className="text-xl font-bold text-gray-800 mb-4">Instruksi Pengiriman</h3>
              <p className="text-sm text-gray-500 mb-2">Anda memilih {selectedItems.length} barang untuk dikirim.</p>
              <textarea 
                className="w-full p-4 border rounded-xl text-black focus:ring-2 focus:ring-orange-500 outline-none h-32"
                placeholder="Tulis instruksi (Contoh: Packing kayu, pakai J&T, dll)..."
                value={requestNote}
                onChange={(e) => setRequestNote(e.target.value)}
              />
              <div className="flex gap-3 mt-6">
                <button onClick={() => setShowNoteModal(false)} className="flex-1 py-3 font-bold text-gray-500 hover:bg-gray-100 rounded-xl transition">Batal</button>
                <button 
                  onClick={handleRequestShipment} disabled={isRequesting}
                  className="flex-1 py-3 font-bold bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition disabled:bg-gray-300"
                >
                  {isRequesting ? "Memproses..." : "Kirim Request"}
                </button>
              </div>
            </div>
          </div>
        )}

        <aside className="w-64 bg-teal-900 text-white flex flex-col fixed h-full">
          <div className="p-6">
            <h2 className="text-2xl font-bold text-teal-400">Client Portal</h2>
            <p className="text-xs text-teal-200 mt-1 truncate">{userEmail}</p>
          </div>
          <nav className="flex-1 px-4 space-y-2">
            <button onClick={() => setActiveTab("STOK")} className={`w-full text-left px-4 py-3 rounded-xl transition ${activeTab === "STOK" ? "bg-teal-700 shadow-inner font-bold" : "hover:bg-teal-800"}`}>📦 Stok & Barang</button>
            <button onClick={() => setActiveTab("LOG")} className={`w-full text-left px-4 py-3 rounded-xl transition ${activeTab === "LOG" ? "bg-teal-700 shadow-inner font-bold" : "hover:bg-teal-800"}`}>🕒 Riwayat Aktivitas</button>
          </nav>
          <div className="p-4 border-t border-teal-800">
            <button onClick={async () => { await auth.signOut(); router.push('/login'); }} className="w-full py-3 text-red-300 font-bold hover:bg-red-900/30 rounded-xl transition">🚪 Keluar</button>
          </div>
        </aside>

        <main className="flex-1 ml-64 p-8">
          
          {activeTab === "STOK" && (
            <div className="animate-fade-in">
              {/* STATS CARDS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                  <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl text-2xl">📥</div>
                  <div><p className="text-sm text-gray-500 font-medium">Barang di Gudang</p><p className="text-3xl font-black text-gray-800">{countInWarehouse}</p></div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                  <div className="p-4 bg-green-50 text-green-600 rounded-2xl text-2xl">🚚</div>
                  <div><p className="text-sm text-gray-500 font-medium">Total Terkirim</p><p className="text-3xl font-black text-gray-800">{countShipped}</p></div>
                </div>
              </div>

              <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                {/* TABS STATUS (MENYAMPING) */}
                <div className="flex bg-gray-200 p-1 rounded-xl w-full md:w-auto">
                  <button onClick={() => setStatusTab("IN_WAREHOUSE")} className={`px-4 py-2 rounded-lg text-sm font-bold transition ${statusTab === "IN_WAREHOUSE" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500"}`}>Di Gudang</button>
                  <button onClick={() => setStatusTab("REQUESTED")} className={`px-4 py-2 rounded-lg text-sm font-bold transition ${statusTab === "REQUESTED" ? "bg-white text-orange-600 shadow-sm" : "text-gray-500"}`}>Proses</button>
                  <button onClick={() => setStatusTab("SHIPPED")} className={`px-4 py-2 rounded-lg text-sm font-bold transition ${statusTab === "SHIPPED" ? "bg-white text-green-600 shadow-sm" : "text-gray-500"}`}>Terkirim</button>
                </div>

                <div className="flex gap-3 w-full md:w-auto">
                  <input 
                    type="text" placeholder="🔍 Cari ID / Nama..." 
                    className="p-3 border rounded-xl text-black focus:ring-2 focus:ring-blue-500 outline-none w-full md:w-64"
                    value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  {statusTab === "IN_WAREHOUSE" && (
                    <button 
                      onClick={() => setShowNoteModal(true)} disabled={selectedItems.length === 0}
                      className="bg-orange-500 text-white px-6 py-3 rounded-xl font-bold shadow-lg hover:bg-orange-600 transition disabled:bg-gray-300 whitespace-nowrap"
                    >
                      Minta Kirim ({selectedItems.length})
                    </button>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500 text-xs font-bold uppercase tracking-wider">
                      {statusTab === "IN_WAREHOUSE" && <th className="p-4 border-b text-center">Pilih</th>}
                      <th className="p-4 border-b">Tgl Masuk</th>
                      <th className="p-4 border-b">Package ID</th>
                      <th className="p-4 border-b">Nama Penerima</th>
                      <th className="p-4 border-b">No. Rak</th>
                      <th className="p-4 border-b text-center">Foto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInventory.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50 border-b text-sm transition text-gray-800">
                        {statusTab === "IN_WAREHOUSE" && (
                          <td className="p-4 text-center">
                            <input 
                              type="checkbox" className="w-5 h-5 accent-orange-500 cursor-pointer"
                              checked={selectedItems.includes(item.id)} onChange={() => handleCheckboxChange(item.id)}
                            />
                          </td>
                        )}
                        <td className="p-4 text-gray-500">{item.createdAt?.toDate().toLocaleDateString('id-ID')}</td>
                        <td className="p-4 font-bold">{item.packageId}</td>
                        <td className="p-4">{item.recipientName}</td>
                        <td className="p-4 font-mono font-bold">{item.sackNumber}</td>
                        <td className="p-4 text-center">
                          {item.photoUrl ? (
                            <button onClick={() => setSelectedImage(item.photoUrl)} className="hover:scale-110 transition">
                              <img src={item.photoUrl} className="w-10 h-10 object-cover rounded-lg border shadow-sm mx-auto" alt="Preview" />
                            </button>
                          ) : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredInventory.length === 0 && <div className="p-12 text-center text-gray-400 font-medium">Data tidak ditemukan.</div>}
              </div>
            </div>
          )}

          {activeTab === "LOG" && (
            <div className="animate-fade-in max-w-4xl">
              <h1 className="text-2xl font-bold text-gray-800 mb-6">Riwayat Aktivitas Anda</h1>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden divide-y">
                {logs.map((log) => (
                  <div key={log.id} className="p-5 hover:bg-gray-50 flex items-start gap-4 transition">
                    <div className={`p-3 rounded-2xl text-xl ${log.action === 'MINTA KIRIM' ? 'bg-orange-50 text-orange-600' : 'bg-green-50 text-green-600'}`}>
                      {log.action === 'MINTA KIRIM' ? '📦' : '🚚'}
                    </div>
                    <div>
                      <div className="flex justify-between w-full mb-1">
                        <p className="font-bold text-gray-900">{log.action}</p>
                        <p className="text-xs text-gray-400">{log.timestamp?.toDate().toLocaleString('id-ID')}</p>
                      </div>
                      <p className="text-sm text-gray-600">{log.details}</p>
                    </div>
                  </div>
                ))}
                {logs.length === 0 && <div className="p-12 text-center text-gray-400">Belum ada riwayat aktivitas.</div>}
              </div>
            </div>
          )}
        </main>
      </div>
    </AuthGuard>
  );
}