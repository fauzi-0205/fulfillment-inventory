"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, query, where, getDocs, addDoc, serverTimestamp, updateDoc, doc } from 'firebase/firestore';
import { auth, db } from '../../../lib/firebase';
import AuthGuard from '../../../components/AuthGuard';
import * as XLSX from 'xlsx';

export default function FulfillmentManagerDashboard() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState("");
  const [branchLocation, setBranchLocation] = useState("");
  const [activeTab, setActiveTab] = useState("stok");
  const [isLoading, setIsLoading] = useState(false);

  // State untuk Filter & Pencarian
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [selectedImage, setSelectedImage] = useState(null);

  // ==========================================
  // SETUP INISIAL & AMBIL CABANG
  // ==========================================
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserEmail(user.email);
        const q = query(collection(db, "users"), where("email", "==", user.email));
        const snap = await getDocs(q);
        snap.forEach((doc) => {
          setBranchLocation(doc.data().branchLocation || "Cabang Default");
        });
      }
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    if (confirm("Yakin ingin keluar dari portal Manager?")) {
      await signOut(auth);
      router.push('/login');
    }
  };

  // ==========================================
  // AMBIL DATA STOK & RIWAYAT REQUEST
  // ==========================================
  const [inventoryData, setInventoryData] = useState([]);
  const [requestHistory, setRequestHistory] = useState([]);
  
  const fetchData = async () => {
    if (!branchLocation) return;
    setIsLoading(true);
    try {
      const qInv = query(collection(db, "jastip_inventory"), 
        where("branchLocation", "==", branchLocation)
      );
      const snapInv = await getDocs(qInv);
      
      const inv = snapInv.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(item => item.status !== "SHIPPED");
        
      inv.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
      setInventoryData(inv);

      const qReq = query(collection(db, "jastip_requests"), where("branchLocation", "==", branchLocation));
      const snapReq = await getDocs(qReq);
      const reqs = snapReq.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      reqs.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
      setRequestHistory(reqs);

    } catch (error) { console.error(error); } finally { setIsLoading(false); }
  };

  useEffect(() => { if (branchLocation) fetchData(); }, [branchLocation, activeTab]);

  // ==========================================
  // FUNGSI AGING & STATISTIK KPI (BUG FIX: SAFE DATE)
  // ==========================================
  const getAgingDetails = (createdAt) => {
    // Tambahan proteksi jika createdAt belum selesai disinkronisasi Firebase
    if (!createdAt || typeof createdAt.toDate !== 'function') return { days: 0, level: 1 };
    
    const diffDays = Math.ceil(Math.abs(new Date() - createdAt.toDate()) / (1000 * 60 * 60 * 24));
    if (diffDays <= 7) return { days: diffDays, level: 1 };
    if (diffDays <= 14) return { days: diffDays, level: 2 };
    if (diffDays <= 30) return { days: diffDays, level: 3 };
    return { days: diffDays, level: 4 };
  };

  const todayStr = new Date().toLocaleDateString('id-ID');
  const todayItems = inventoryData.filter(item => {
    if (!item.createdAt || typeof item.createdAt.toDate !== 'function') return false;
    return item.createdAt.toDate().toLocaleDateString('id-ID') === todayStr;
  });
  
  const stats = {
    totalStok: inventoryData.length,
    masukHariIni: todayItems.length,
    beratHariIni: todayItems.reduce((sum, item) => sum + parseFloat(item.beratFinal || 0), 0).toFixed(2),
    agingWarning: inventoryData.filter(item => getAgingDetails(item.createdAt).level >= 3).length
  };

  // ==========================================
  // LOGIKA FILTERING DATA
  // ==========================================
  const filteredInventory = inventoryData.filter((item) => {
    const matchSearch = item.packageId?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        item.resiEkspedisi?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        item.namaPaket?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchStatus = filterStatus === "" || item.status === filterStatus;
    
    let matchDate = true;
    if (filterDate) {
      if (item.createdAt && typeof item.createdAt.toDate === 'function') {
        const itemDate = item.createdAt.toDate();
        const offset = itemDate.getTimezoneOffset() * 60000;
        const localDateStr = (new Date(itemDate - offset)).toISOString().split('T')[0];
        matchDate = localDateStr === filterDate;
      } else {
        matchDate = false;
      }
    }

    return matchSearch && matchStatus && matchDate;
  });

  // ==========================================
  // LOGIKA PEMILIHAN BARANG & REQUEST GABUNG
  // ==========================================
  const [selectedItems, setSelectedItems] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [requestForm, setRequestForm] = useState({ tujuanInfo: "", notes: "" });

  const toggleSelectItem = (id) => {
    if (selectedItems.includes(id)) setSelectedItems(selectedItems.filter(item => item !== id));
    else setSelectedItems([...selectedItems, id]);
  };

  const toggleSelectAll = () => {
    if (selectedItems.length === filteredInventory.length && filteredInventory.length > 0) setSelectedItems([]);
    else setSelectedItems(filteredInventory.map(item => item.id));
  };

  const totalBeratEstimasi = inventoryData
    .filter(i => selectedItems.includes(i.id))
    .reduce((total, item) => total + parseFloat(item.beratFinal || 0), 0)
    .toFixed(2);

  const handleSubmitRequest = async (e) => {
    e.preventDefault();
    if (selectedItems.length === 0) return alert("Pilih minimal 1 barang!");
    setIsLoading(true);
    try {
      const batchId = `BATCH-${branchLocation.substring(0, 3).toUpperCase()}-${Math.floor(10000 + Math.random() * 90000)}`;
      
      await addDoc(collection(db, "jastip_requests"), {
        batchId: batchId,
        branchLocation: branchLocation,
        managerEmail: userEmail,
        inventoryIds: selectedItems,
        tujuanInfo: requestForm.tujuanInfo,
        notes: requestForm.notes,
        totalEstimasiBerat: totalBeratEstimasi,
        status: "PENDING",
        resiKeluar: "",
        createdAt: serverTimestamp()
      });

      // Update status item secara paralel
      await Promise.all(selectedItems.map(itemId => 
        updateDoc(doc(db, "jastip_inventory", itemId), { status: "REQUESTED" })
      ));

      await addDoc(collection(db, "jastip_logs"), {
        branchLocation, userEmail, action: "MANAGER_REQUEST_GABUNG",
        details: `Manager mengajukan Batch ${batchId} (${selectedItems.length} barang) tujuan ${requestForm.tujuanInfo}`,
        timestamp: serverTimestamp()
      });

      alert(`✅ Berhasil diajukan! ID: ${batchId}`);
      setIsModalOpen(false);
      setSelectedItems([]);
      setRequestForm({ tujuanInfo: "", notes: "" });
      fetchData();
    } catch (error) { alert("Error: " + error.message); } finally { setIsLoading(false); }
  };

  // ==========================================
  // FUNGSI TAMBAHAN (BATAL, HOLD, DOWNLOAD)
  // ==========================================
  const handleCancelRequest = async (reqDoc) => {
    if(!confirm(`Yakin ingin membatalkan Request ${reqDoc.batchId}? Barang akan dikembalikan ke status IN_WAREHOUSE.`)) return;
    setIsLoading(true);
    try {
      await updateDoc(doc(db, "jastip_requests", reqDoc.id), { status: "CANCELLED", canceledAt: serverTimestamp() });
      
      // Kembalikan status item secara paralel
      await Promise.all(reqDoc.inventoryIds.map(itemId => 
        updateDoc(doc(db, "jastip_inventory", itemId), { status: "IN_WAREHOUSE" })
      ));

      await addDoc(collection(db, "jastip_logs"), { branchLocation, userEmail, action: "MANAGER_CANCEL_REQUEST", details: `Membatalkan batch ${reqDoc.batchId}`, timestamp: serverTimestamp() });
      alert("✅ Request berhasil dibatalkan!"); 
      fetchData();
    } catch (error) { alert("Gagal membatalkan: " + error.message); } finally { setIsLoading(false); }
  };

  const handleToggleHold = async (item) => {
    const isHold = item.status === "HOLD_KARANTINA";
    const newStatus = isHold ? "IN_WAREHOUSE" : "HOLD_KARANTINA";
    if(!confirm(`Ubah status paket ${item.packageId} menjadi ${newStatus}?`)) return;
    try {
      await updateDoc(doc(db, "jastip_inventory", item.id), { status: newStatus });
      await addDoc(collection(db, "jastip_logs"), { branchLocation, userEmail, action: isHold ? "RELEASE_HOLD" : "SET_HOLD", details: `Paket ${item.packageId} diubah ke ${newStatus}`, timestamp: serverTimestamp() });
      fetchData();
    } catch(err) { alert("Gagal mengubah status!"); }
  };

  const handleDownloadReport = () => {
    const dataToExport = filteredInventory.map(item => {
      const aging = getAgingDetails(item.createdAt);
      return {
        'Tgl Masuk': (item.createdAt && typeof item.createdAt.toDate === 'function') ? item.createdAt.toDate().toLocaleString('id-ID') : '-',
        'ID Jastip': item.packageId, 'Resi Masuk': item.resiEkspedisi,
        'Nama Paket': item.namaPaket, 'Tujuan': item.tujuan,
        'Dimensi': item.dimensi, 'Berat Aktual (Kg)': item.beratAktual,
        'Berat Volumetrik (Kg)': item.beratVolumetrik, 'Berat Tagihan Final (Kg)': item.beratFinal,
        'Status': item.status, 'Lokasi Rak': item.rakId || '-',
        'Lama Inap (Hari)': aging.days, 'Warning Level': `Level ${aging.level}`
      };
    });
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    worksheet['!cols'] = [{wch:20},{wch:20},{wch:20},{wch:30},{wch:15},{wch:15},{wch:15},{wch:20},{wch:20},{wch:15},{wch:15},{wch:15},{wch:15}];
    const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, worksheet, "Laporan_Manager");
    XLSX.writeFile(workbook, `Report_Manager_${branchLocation}_${new Date().toLocaleDateString('id-ID')}.xlsx`);
  };

  return (
    <AuthGuard requiredRole="FULFILLMENT_MANAGER">
      <div className="min-h-screen bg-slate-50 flex font-sans">
        
        {/* POPUP FOTO */}
        {selectedImage && (
          <div className="fixed inset-0 bg-black/80 z-[110] flex items-center justify-center p-4 animate-fade-in" onClick={() => setSelectedImage(null)}>
            <div className="relative max-w-4xl w-full flex flex-col items-center">
              <button className="absolute -top-12 right-0 text-white text-4xl font-bold hover:text-red-500 transition-colors">&times;</button>
              <img src={selectedImage} className="max-h-[85vh] rounded-lg shadow-2xl border-4 border-white object-contain" alt="Foto Barang" />
              <p className="text-white mt-4 text-sm font-bold bg-black/50 px-4 py-2 rounded-full">Klik di mana saja untuk menutup</p>
            </div>
          </div>
        )}

        {/* MODAL REQUEST GABUNG */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-3xl p-8 max-w-lg w-full shadow-2xl">
              <h2 className="text-2xl font-black text-gray-800 mb-2">Formulir Pengiriman Gabungan</h2>
              <p className="text-gray-500 mb-6 border-b pb-4">Anda memilih <strong>{selectedItems.length} paket</strong> (Total: {totalBeratEstimasi} Kg).</p>
              
              <form onSubmit={handleSubmitRequest} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Tujuan Pengiriman</label>
                  <input type="text" placeholder="Contoh: Singapore / Nama Customer..." className="w-full p-4 border rounded-xl bg-gray-50 focus:ring-2 focus:ring-indigo-500 outline-none" value={requestForm.tujuanInfo} onChange={(e) => setRequestForm({...requestForm, tujuanInfo: e.target.value})} required />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Catatan Khusus</label>
                  <textarea placeholder="Contoh: Tolong packing aman..." className="w-full p-4 border rounded-xl bg-gray-50 h-28 focus:ring-2 focus:ring-indigo-500 outline-none" value={requestForm.notes} onChange={(e) => setRequestForm({...requestForm, notes: e.target.value})}></textarea>
                </div>
                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 font-bold text-gray-600 bg-gray-200 rounded-xl hover:bg-gray-300">Batal</button>
                  <button type="submit" disabled={isLoading} className="flex-1 py-4 font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-500/30 disabled:bg-gray-400">Kirim Instruksi</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* SIDEBAR MANAGER */}
        <aside className="w-64 bg-slate-900 text-white flex flex-col shadow-xl z-10">
          <div className="p-6">
            <div className="text-[10px] font-bold tracking-widest text-indigo-400 mb-1 uppercase">Manager Portal</div>
            <h2 className="text-2xl font-black text-white">Jastip Hub</h2>
            <p className="text-xs text-slate-400 mt-2 uppercase flex items-center gap-1">📍 Cabang {branchLocation}</p>
          </div>
          <nav className="flex-1 px-4 space-y-2 mt-4">
            <button onClick={() => setActiveTab("stok")} className={`w-full text-left px-4 py-3 rounded-xl transition ${activeTab === "stok" ? "bg-indigo-600 font-bold shadow-md" : "hover:bg-slate-800 text-slate-300"}`}>📦 Stok Gudang</button>
            <button onClick={() => setActiveTab("riwayat")} className={`w-full text-left px-4 py-3 rounded-xl transition ${activeTab === "riwayat" ? "bg-indigo-600 font-bold shadow-md" : "hover:bg-slate-800 text-slate-300"}`}>📜 Riwayat Pengiriman</button>
          </nav>
          <div className="p-4 border-t border-slate-800">
            <button onClick={handleLogout} className="w-full py-3 text-red-400 font-bold hover:bg-red-500/10 rounded-xl transition text-sm">🚪 Logout Sistem</button>
          </div>
        </aside>

        {/* MAIN CONTENT */}
        <main className="flex-1 p-8 flex flex-col relative max-h-screen overflow-y-auto">
          
          <div className="mb-6 flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-black text-gray-800">Dashboard Manager {branchLocation}</h1>
              <p className="text-gray-500 mt-1">Monitoring stok, resolusi masalah, dan ajukan penggabungan barang.</p>
            </div>
          </div>

          {/* KARTU STATISTIK KPI */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
             <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200">
               <p className="text-[10px] font-bold text-gray-500 uppercase">Total Stok Aktif</p>
               <p className="text-2xl font-black text-indigo-700">{stats.totalStok} <span className="text-sm font-normal text-gray-400">Paket</span></p>
             </div>
             <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200">
               <p className="text-[10px] font-bold text-gray-500 uppercase">Masuk Hari Ini</p>
               <p className="text-2xl font-black text-blue-600">{stats.masukHariIni} <span className="text-sm font-normal text-gray-400">Paket</span></p>
             </div>
             <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200">
               <p className="text-[10px] font-bold text-gray-500 uppercase">Potensi Tagihan Hari Ini</p>
               <p className="text-2xl font-black text-green-600">{stats.beratHariIni} <span className="text-sm font-normal text-gray-400">Kg</span></p>
             </div>
             <div className="bg-red-50 p-4 rounded-2xl shadow-sm border border-red-200">
  <p className="text-[10px] font-bold text-red-500 uppercase">Warning (Inap &gt;14 Hari)</p>
  <p className="text-2xl font-black text-red-700">{stats.agingWarning} <span className="text-sm font-normal text-red-400">Paket</span></p>
</div>
          </div>

          {/* TAB 1: STOK GUDANG DENGAN FILTER */}
          {activeTab === "stok" && (
            <div className="animate-fade-in flex-1 flex flex-col">
              
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 mb-6 flex flex-wrap gap-4 items-center justify-between">
                <div className="flex flex-wrap gap-4 flex-1">
                  <div className="relative w-full md:w-auto">
                    <span className="absolute left-3 top-2 text-gray-400">🔍</span>
                    <input type="text" placeholder="Cari ID/Resi..." className="pl-10 pr-4 py-2 bg-gray-50 border rounded-xl text-sm outline-none" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                  </div>
                  <input type="date" className="px-4 py-2 bg-gray-50 border rounded-xl text-sm outline-none" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} />
                  <select className="px-4 py-2 bg-gray-50 border rounded-xl text-sm outline-none" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                    <option value="">Semua Status</option>
                    <option value="BELUM_MASUK_RAK">Belum Masuk Rak</option>
                    <option value="IN_WAREHOUSE">Di Rak (Siap)</option>
                    <option value="REQUESTED">Diproses (Gabung)</option>
                    <option value="HOLD_KARANTINA">Karantina / Bermasalah</option>
                  </select>
                </div>
                <button onClick={handleDownloadReport} className="bg-green-600 hover:bg-green-700 text-white font-bold px-4 py-2 rounded-xl text-sm shadow-md flex items-center gap-2">
                  📊 Laporan Excel
                </button>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex-1 pb-24">
                <table className="w-full text-left border-collapse text-sm min-w-[1000px]">
                  <thead>
                    <tr className="bg-indigo-50 text-indigo-800 font-bold uppercase tracking-wider text-xs sticky top-0 z-10 border-b border-indigo-100">
                      <th className="p-4 w-12 text-center">
                        <input type="checkbox" onChange={toggleSelectAll} checked={selectedItems.length === filteredInventory.length && filteredInventory.length > 0} className="w-4 h-4 cursor-pointer accent-indigo-600" />
                      </th>
                      <th className="p-4">Tgl Tiba</th>
                      <th className="p-4">ID & Resi</th>
                      <th className="p-4">Paket & Tujuan</th>
                      <th className="p-4 text-center">Berat</th>
                      <th className="p-4 text-center">Status</th>
                      <th className="p-4 text-center">Foto</th>
                      <th className="p-4 text-center">Rak</th>
                      <th className="p-4 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInventory.map((item) => (
                      <tr key={item.id} className={`hover:bg-slate-50 border-b transition ${selectedItems.includes(item.id) ? 'bg-indigo-50/30' : ''}`}>
                        <td className="p-4 text-center">
                          <input type="checkbox" checked={selectedItems.includes(item.id)} onChange={() => toggleSelectItem(item.id)} className="w-4 h-4 cursor-pointer accent-indigo-600" />
                        </td>
                        <td className="p-4 text-gray-500 text-xs">
                          {(item.createdAt && typeof item.createdAt.toDate === 'function') ? item.createdAt.toDate().toLocaleDateString('id-ID') : '-'}
                        </td>
                        <td className="p-4">
                          <span className="font-bold text-indigo-700 block">{item.packageId}</span>
                          <span className="text-gray-400 text-[10px]">{item.resiEkspedisi}</span>
                        </td>
                        <td className="p-4">
                          <span className="font-bold text-gray-800 block uppercase">{item.namaPaket}</span>
                          <span className="text-gray-500 text-xs">{item.tujuan}</span>
                        </td>
                        <td className="p-4 text-center font-black text-gray-800">{item.beratFinal} kg</td>
                        <td className="p-4 text-center">
                          <span className={`text-[10px] font-black px-2 py-1 rounded-full uppercase ${
                            item.status === 'BELUM_MASUK_RAK' ? 'bg-red-100 text-red-600' : 
                            item.status === 'IN_WAREHOUSE' ? 'bg-blue-100 text-blue-600' : 
                            item.status === 'HOLD_KARANTINA' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-orange-100 text-orange-600'
                          }`}>
                            {item.status.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          {item.photoUrl ? (
                            <button onClick={() => setSelectedImage(item.photoUrl)} className="hover:scale-110 transition border rounded p-1 bg-white shadow-sm">
                              <img src={item.photoUrl} alt="Foto" className="w-8 h-8 object-cover rounded-sm" />
                            </button>
                          ) : <span className="text-[10px] text-gray-300">-</span>}
                        </td>
                        <td className="p-4 text-center">
                          <span className="bg-gray-100 px-2 py-1 rounded font-mono font-bold text-gray-600 text-[10px] border">
                            {item.rakId || "N/A"}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <button 
                            onClick={() => handleToggleHold(item)}
                            className={`px-3 py-1 text-[10px] font-bold rounded-lg border ${item.status === 'HOLD_KARANTINA' ? 'bg-green-100 text-green-700 border-green-300' : 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'}`}
                          >
                            {item.status === 'HOLD_KARANTINA' ? '✅ Lepas Hold' : '🚨 Karantina'}
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredInventory.length === 0 && ( <tr><td colSpan="9" className="p-16 text-center text-gray-400">Data tidak ditemukan.</td></tr> )}
                  </tbody>
                </table>
              </div>

              {/* FLOATING ACTION BAR */}
              <div className={`fixed bottom-10 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-6 py-4 rounded-2xl shadow-2xl z-50 flex items-center gap-6 transition-all duration-300 ${selectedItems.length > 0 ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0 pointer-events-none'}`}>
                <div className="flex flex-col">
                  <span className="font-black text-lg">{selectedItems.length} Paket Dipilih</span>
                  <span className="text-xs text-indigo-300">Total Berat: {totalBeratEstimasi} Kg</span>
                </div>
                <div className="h-10 w-px bg-gray-700 mx-2"></div>
                <button onClick={() => setIsModalOpen(true)} className="bg-indigo-500 hover:bg-indigo-400 text-white px-6 py-3 rounded-xl font-bold transition flex items-center gap-2 shadow-lg">
                  📦 Ajukan Gabung Barang
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: RIWAYAT REQUEST (DENGAN TOMBOL BATAL & STATUS CANCELLED) */}
          {activeTab === "riwayat" && (
            <div className="animate-fade-in w-full">
               <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                 <h2 className="text-xl font-bold mb-6 text-gray-800 border-b pb-4">Riwayat Instruksi</h2>
                 {requestHistory.length === 0 ? ( <div className="text-center p-10 text-gray-400">Belum ada riwayat.</div> ) : (
                   <div className="space-y-4">
                     {requestHistory.map(req => (
                       <div key={req.id} className="border rounded-xl p-5 hover:bg-gray-50 transition">
                         <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                           <div>
                             <div className="flex items-center gap-3 mb-2">
                               <span className="bg-gray-100 text-gray-800 px-3 py-1 rounded-lg text-xs font-black border">{req.batchId}</span>
                               <span className="text-xs text-gray-500">{(req.createdAt && typeof req.createdAt.toDate === 'function') ? req.createdAt.toDate().toLocaleString('id-ID') : '-'}</span>
                             </div>
                             <h3 className="font-bold text-lg text-gray-800">Kirim {req.inventoryIds.length} Paket ke {req.tujuanInfo}</h3>
                             <p className="text-sm text-gray-500 mt-1">Estimasi: {req.totalEstimasiBerat} Kg</p>
                           </div>
                           <div className="text-right">
                             {req.status === "PENDING" ? (
                               <>
                                 <div className="inline-flex items-center gap-2 bg-orange-100 text-orange-700 px-4 py-2 rounded-xl font-bold text-sm">⏳ Sedang Proses</div>
                                 <button 
                                   onClick={() => handleCancelRequest(req)}
                                   className="block w-full mt-2 text-[10px] font-bold text-red-500 hover:text-red-700 underline text-right"
                                 >
                                   Batalkan Request
                                 </button>
                               </>
                             ) : req.status === "CANCELLED" ? (
                               <div className="inline-flex items-center gap-2 bg-red-100 text-red-700 px-4 py-2 rounded-xl font-bold text-sm">❌ Dibatalkan</div>
                             ) : (
                               <div className="flex flex-col items-end">
                                 <div className="inline-flex items-center gap-2 bg-green-100 text-green-700 px-4 py-2 rounded-xl font-bold text-sm mb-1">✅ Terkirim</div>
                                 <span className="text-[10px] font-bold text-gray-600">AWB: {req.resiKeluar}</span>
                               </div>
                             )}
                           </div>
                         </div>
                       </div>
                     ))}
                   </div>
                 )}
               </div>
            </div>
          )}

        </main>
      </div>
    </AuthGuard>
  );
}