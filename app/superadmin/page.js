"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, signOut } from 'firebase/auth';
// Tambahkan setDoc, getDoc, addDoc
import { collection, query, getDocs, updateDoc, doc, deleteDoc, setDoc, getDoc, serverTimestamp, addDoc } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import AuthGuard from '../../components/AuthGuard';
import * as XLSX from 'xlsx'; // <-- Wajib ada
// Tambahkan icon BarChart3, Building2, Settings, DownloadCloud, Power
import { 
  ShieldAlert, Users, Database, LogOut, Trash2, Edit, 
  Search, Save, X, Activity, Server, BarChart3, Building2, Settings, DownloadCloud, Power
} from 'lucide-react';

export default function SuperAdminDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("USERS");
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("");

  // Global States
  const [allUsers, setAllUsers] = useState([]);
  const [allInventory, setAllInventory] = useState([]);
  const [allLogs, setAllLogs] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("ALL"); // State baru untuk filter tipe gudang

  // --- STATE BARU ---
  const [masterBranches, setMasterBranches] = useState([]);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [newBranch, setNewBranch] = useState({ code: "", name: "", location: "" });

  // Edit Item Modal States
  const [editingItem, setEditingItem] = useState(null);
  const [editForm, setEditForm] = useState({});

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserEmail(user.email);
        fetchAllData();
      }
    });
    return () => unsubscribe();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      // 1. Ambil SEMUA Users
      const userSnap = await getDocs(collection(db, "users"));
      setAllUsers(userSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      // 2. Ambil Data Inventory (GABUNGAN REGULAR & FULFILLMENT)
      const invSnap = await getDocs(collection(db, "inventory"));
      const regularInv = invSnap.docs.map(doc => ({ id: doc.id, type: "REGULAR", ...doc.data() }));

      const jastipSnap = await getDocs(collection(db, "jastip_inventory"));
      const jastipInv = jastipSnap.docs.map(doc => ({ id: doc.id, type: "FULFILLMENT", ...doc.data() }));

      setAllInventory([...regularInv, ...jastipInv]); // Gabungkan Keduanya!

      // 3. Ambil SEMUA Logs (Dibatasi 100 terakhir agar browser tidak berat)
      const logSnap = await getDocs(collection(db, "logs"));
      const logsData = logSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      logsData.sort((a, b) => (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0));
      setAllLogs(logsData.slice(0, 100));

      // 4. Ambil Master Cabang
      const branchSnap = await getDocs(collection(db, "master_branches"));
      setMasterBranches(branchSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      // 5. Ambil System Settings (Maintenance Mode)
      const sysRef = doc(db, "settings", "system");
      const sysSnap = await getDoc(sysRef);
      if (sysSnap.exists()) {
        setMaintenanceMode(sysSnap.data().maintenance || false);
      }

    } catch (error) {
      console.error(error);
      alert("Gagal menarik data global!");
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // MANAJEMEN PENGGUNA (USERS)
  // ==========================================
  const handleUpdateRole = async (userId, userEmailRef, newRole) => {
    if (!confirm(`Ubah hak akses ${userEmailRef} menjadi ${newRole}?`)) return;
    try {
      await updateDoc(doc(db, "users", userId), { role: newRole });
      alert("Role berhasil diubah!");
      fetchAllData();
    } catch (e) { alert("Gagal mengubah role."); }
  };

  const handleDeleteUserDoc = async (userId, email) => {
    if (!confirm(`⚠️ BAHAYA! Hapus permanen data user ${email} dari database? (User tetap bisa login jika belum dihapus dari Firebase Auth)`)) return;
    try {
      await deleteDoc(doc(db, "users", userId));
      alert("Data User dihapus!");
      fetchAllData();
    } catch (e) { alert("Gagal menghapus user."); }
  };

  // ==========================================
  // GLOBAL MASTER DATA (INVENTORY)
  // ==========================================
  const handleOpenEditModal = (item) => {
    setEditingItem(item);
    setEditForm({
      packageId: item.packageId || "", 
      recipientName: item.recipientName || item.namaPaket || "", // Support namaPaket Fulfillment
      tenantId: item.tenantId || item.branchLocation || "", // Support cabang Fulfillment
      status: item.status || "", 
      sackNumber: item.sackNumber || item.rakId || "", // Support rakId Fulfillment
    });
  };

  const handleSaveEditItem = async (e) => {
    e.preventDefault();
    if (!confirm("Simpan perubahan paksa pada data ini?")) return;
    try {
      const collectionName = editingItem.type === "FULFILLMENT" ? "jastip_inventory" : "inventory";
      
      // Sesuaikan nama field berdasarkan tipe gudangnya
      let updatePayload = { status: editForm.status, packageId: editForm.packageId };
      if (editingItem.type === "FULFILLMENT") {
        updatePayload.branchLocation = editForm.tenantId;
        updatePayload.namaPaket = editForm.recipientName;
        updatePayload.rakId = editForm.sackNumber;
      } else {
        updatePayload.tenantId = editForm.tenantId;
        updatePayload.recipientName = editForm.recipientName;
        updatePayload.sackNumber = editForm.sackNumber;
      }

      await updateDoc(doc(db, collectionName, editingItem.id), updatePayload);
      alert("Data berhasil diupdate paksa!"); setEditingItem(null); fetchAllData();
    } catch (error) { alert("Gagal update data: " + error.message); }
  };

  const handleForceDelete = async (itemId, packageId, type) => {
    if (!confirm(`⚠️ BAHAYA! Hapus permanen barang ${packageId}?`)) return;
    try {
      const collectionName = type === "FULFILLMENT" ? "jastip_inventory" : "inventory";
      await deleteDoc(doc(db, collectionName, itemId));
      alert("Barang dimusnahkan!"); fetchAllData();
    } catch (error) { alert("Gagal menghapus."); }
  };

  // ==========================================
  // FUNGSI TAMBAHAN SUPER ADMIN
  // ==========================================

  // Logika Analitik
  const totalInventory = allInventory.length;
  const totalShipped = allInventory.filter(i => i.status === "SHIPPED").length;
  const tenantCounts = allInventory.reduce((acc, item) => {
    const tenant = item.tenantId || 'Unknown';
    acc[tenant] = (acc[tenant] || 0) + 1;
    return acc;
  }, {});
  const topTenants = Object.entries(tenantCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Fitur Backup
  const handleGlobalBackup = () => {
    if(!confirm("Unduh seluruh data database ke Excel?")) return;
    const wb = XLSX.utils.book_new();
    const wsUsers = XLSX.utils.json_to_sheet(allUsers);
    XLSX.utils.book_append_sheet(wb, wsUsers, "Users");
    const wsInv = XLSX.utils.json_to_sheet(allInventory.map(i => ({...i, createdAt: i.createdAt ? i.createdAt.toDate().toLocaleString('id-ID') : '-'})));
    XLSX.utils.book_append_sheet(wb, wsInv, "Inventory");
    const wsLogs = XLSX.utils.json_to_sheet(allLogs.map(l => ({...l, timestamp: l.timestamp ? l.timestamp.toDate().toLocaleString('id-ID') : '-'})));
    XLSX.utils.book_append_sheet(wb, wsLogs, "Logs");
    XLSX.writeFile(wb, `SuperAdmin_Backup_${new Date().toLocaleDateString('id-ID')}.xlsx`);
  };

  // Fitur Maintenance
  const handleToggleMaintenance = async () => {
    const newState = !maintenanceMode;
    if(!confirm(newState ? "Aktifkan Maintenance? Semua user akan ditendang." : "Matikan Maintenance? Sistem online kembali.")) return;
    try {
      await setDoc(doc(db, "settings", "system"), { maintenance: newState }, { merge: true });
      setMaintenanceMode(newState);
      alert(`Sistem: ${newState ? "MAINTENANCE (OFFLINE)" : "ONLINE"}`);
    } catch (e) { alert("Gagal mengubah status sistem"); }
  };

  // Fitur Cabang
  const handleAddBranch = async (e) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, "master_branches"), { ...newBranch, createdAt: serverTimestamp() });
      alert("Cabang baru berhasil didaftarkan!"); setNewBranch({ code: "", name: "", location: "" }); fetchAllData();
    } catch (e) { alert("Gagal menambah cabang"); }
  };
  
  const handleDeleteBranch = async (id) => {
    if(!confirm(`Hapus cabang ini?`)) return;
    await deleteDoc(doc(db, "master_branches", id)); fetchAllData();
  };

  // ==========================================
  // LOGOUT
  // ==========================================
  const handleLogout = async () => {
    if (confirm("Keluar dari Super Admin?")) {
      await signOut(auth);
      router.push('/login');
    }
  };

  const filteredUsers = allUsers.filter(u => u.email?.toLowerCase().includes(searchTerm.toLowerCase()) || u.role?.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredInventory = allInventory.filter(i => {
    const matchSearch = i.packageId?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        i.tenantId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        i.branchLocation?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchType = filterType === "ALL" || i.type === filterType;
    
    return matchSearch && matchType;
  });

  return (
    <AuthGuard requiredRole="SUPER_ADMIN">
      <div className="min-h-screen bg-slate-950 text-slate-300 font-sans flex">
        
        {/* MODAL EDIT DATA DEWA */}
        {editingItem && (
          <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-red-500/50 rounded-2xl w-full max-w-lg p-6 shadow-2xl shadow-red-900/20">
              <div className="flex justify-between items-center mb-6 border-b border-slate-700 pb-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Edit className="text-red-500" /> Force Edit Data
                </h2>
                <button onClick={() => setEditingItem(null)} className="text-slate-400 hover:text-white"><X /></button>
              </div>
              <form onSubmit={handleSaveEditItem} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Package ID</label>
                  <input type="text" value={editForm.packageId} onChange={e => setEditForm({...editForm, packageId: e.target.value})} className="w-full bg-slate-800 border border-slate-700 p-3 rounded-lg text-white" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Pemilik (Tenant ID)</label>
                  <input type="text" value={editForm.tenantId} onChange={e => setEditForm({...editForm, tenantId: e.target.value})} className="w-full bg-slate-800 border border-slate-700 p-3 rounded-lg text-white" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Nama Penerima</label>
                  <input type="text" value={editForm.recipientName} onChange={e => setEditForm({...editForm, recipientName: e.target.value})} className="w-full bg-slate-800 border border-slate-700 p-3 rounded-lg text-white" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">Status</label>
                    <select value={editForm.status} onChange={e => setEditForm({...editForm, status: e.target.value})} className="w-full bg-slate-800 border border-slate-700 p-3 rounded-lg text-white">
                      <option value="IN_WAREHOUSE">IN_WAREHOUSE</option>
                      <option value="REQUESTED">REQUESTED</option>
                      <option value="SHIPPED">SHIPPED</option>
                      <option value="HOLD_KARANTINA">HOLD_KARANTINA</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">No Rak</label>
                    <input type="text" value={editForm.sackNumber} onChange={e => setEditForm({...editForm, sackNumber: e.target.value})} className="w-full bg-slate-800 border border-slate-700 p-3 rounded-lg text-white" />
                  </div>
                </div>
                <div className="pt-4 flex gap-3">
                  <button type="button" onClick={() => setEditingItem(null)} className="flex-1 py-3 bg-slate-800 rounded-lg font-bold">Batal</button>
                  <button type="submit" className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold flex items-center justify-center gap-2">
                    <Save className="w-4 h-4" /> Save Force
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* SIDEBAR SUPER ADMIN (TEMA MERAH GELAP) */}
        <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col h-screen sticky top-0">
          <div className="p-6 border-b border-slate-800">
            <div className="flex items-center gap-3 text-red-500 mb-2">
              <ShieldAlert className="w-8 h-8 animate-pulse" />
              <div>
                <h1 className="font-black text-xl tracking-wider text-white">ROOT</h1>
                <p className="text-[10px] font-bold tracking-widest uppercase">Super Admin</p>
              </div>
            </div>
          </div>
          <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            <button onClick={() => setActiveTab("USERS")} className={`w-full flex items-center gap-3 p-3 rounded-xl font-medium transition ${activeTab === "USERS" ? "bg-red-500/10 text-red-400 border border-red-500/20" : "hover:bg-slate-800"}`}>
              <Users className="w-5 h-5" /> Manajemen Akun
            </button>
            <button onClick={() => setActiveTab("DATA")} className={`w-full flex items-center gap-3 p-3 rounded-xl font-medium transition ${activeTab === "DATA" ? "bg-red-500/10 text-red-400 border border-red-500/20" : "hover:bg-slate-800"}`}>
              <Database className="w-5 h-5" /> Global Inventory
            </button>
            <button onClick={() => setActiveTab("LOGS")} className={`w-full flex items-center gap-3 p-3 rounded-xl font-medium transition ${activeTab === "LOGS" ? "bg-red-500/10 text-red-400 border border-red-500/20" : "hover:bg-slate-800"}`}>
              <Server className="w-5 h-5" /> System Logs
            </button>
            {/* MENU SIDEBAR BARU */}
            <div className="my-3 border-t border-slate-800"></div>
            <button onClick={() => setActiveTab("ANALYTICS")} className={`w-full flex items-center gap-3 p-3 rounded-xl font-medium transition ${activeTab === "ANALYTICS" ? "bg-red-500/10 text-red-400 border border-red-500/20" : "hover:bg-slate-800"}`}>
              <BarChart3 className="w-5 h-5" /> Analytics
            </button>
            <button onClick={() => setActiveTab("BRANCHES")} className={`w-full flex items-center gap-3 p-3 rounded-xl font-medium transition ${activeTab === "BRANCHES" ? "bg-red-500/10 text-red-400 border border-red-500/20" : "hover:bg-slate-800"}`}>
              <Building2 className="w-5 h-5" /> Master Cabang
            </button>
            <button onClick={() => setActiveTab("SETTINGS")} className={`w-full flex items-center gap-3 p-3 rounded-xl font-medium transition ${activeTab === "SETTINGS" ? "bg-red-500/10 text-red-400 border border-red-500/20" : "hover:bg-slate-800"}`}>
              <Settings className="w-5 h-5" /> System Settings
            </button>
          </nav>
          <div className="p-4 border-t border-slate-800">
            <button onClick={handleLogout} className="w-full py-3 bg-slate-800 hover:bg-slate-700 rounded-xl font-bold flex items-center justify-center gap-2 text-white">
              <LogOut className="w-4 h-4" /> Exit Root
            </button>
          </div>
        </aside>

        {/* MAIN CONTENT */}
        <main className="flex-1 p-8 overflow-y-auto h-screen">
          <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800 pb-6">
            <div>
              <h2 className="text-3xl font-black text-white">
                {activeTab === "USERS" ? "Manajemen Hak Akses" : activeTab === "DATA" ? "Global Master Data" : "Log Sistem Keseluruhan"}
              </h2>
              <p className="text-slate-500 text-sm mt-1">Akses dewa. Segala perubahan di sini bersifat permanen dan mempengaruhi seluruh sistem.</p>
            </div>
            
            {activeTab !== "LOGS" && (
              <div className="flex flex-wrap gap-3 w-full md:w-auto">
                {/* DROPDOWN FILTER MUNCUL KHUSUS DI TAB DATA */}
                {activeTab === "DATA" && (
                  <select 
                    value={filterType} 
                    onChange={(e) => setFilterType(e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded-xl py-2 px-4 text-white focus:border-red-500 outline-none font-medium text-sm cursor-pointer"
                  >
                    <option value="ALL">📦 Semua Tipe Gudang</option>
                    <option value="REGULAR">🔵 Regular (Customer)</option>
                    <option value="FULFILLMENT">🟠 Fulfillment (Jastip)</option>
                  </select>
                )}

                <div className="relative flex-1 md:w-72">
                  <Search className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                  <input 
                    type="text" 
                    placeholder="Pencarian global..." 
                    value={searchTerm} 
                    onChange={e => setSearchTerm(e.target.value)} 
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2 pl-10 pr-4 text-white text-sm focus:border-red-500 outline-none" 
                  />
                </div>
              </div>
            )}
          </header>

          {loading ? (
            <div className="flex justify-center p-20"><Activity className="w-10 h-10 text-red-500 animate-spin" /></div>
          ) : (
            <>
              {/* TAB ANALYTICS */}
              {activeTab === "ANALYTICS" && (
                <div className="space-y-6">
                  <div className="grid grid-cols-3 gap-6">
                    <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
                      <h3 className="text-slate-400 font-bold mb-2">Total Barang Sistem</h3>
                      <p className="text-4xl font-black text-white">{totalInventory}</p>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
                      <h3 className="text-slate-400 font-bold mb-2">Total Terkirim (Sukses)</h3>
                      <p className="text-4xl font-black text-green-500">{totalShipped}</p>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
                      <h3 className="text-slate-400 font-bold mb-2">Total Users Terdaftar</h3>
                      <p className="text-4xl font-black text-blue-500">{allUsers.length}</p>
                    </div>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl w-1/2">
                    <h3 className="text-white font-bold mb-4">Top 5 Tenant Paling Aktif</h3>
                    <div className="space-y-3">
                      {topTenants.map(([tenant, count], idx) => (
                        <div key={tenant} className="flex justify-between items-center border-b border-slate-800 pb-2">
                          <span className="text-slate-300 font-bold uppercase">{idx + 1}. {tenant}</span>
                          <span className="bg-red-500/20 text-red-400 px-3 py-1 rounded-full text-xs font-bold">{count} Barang</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB BRANCHES */}
              {activeTab === "BRANCHES" && (
                <div className="grid grid-cols-3 gap-6">
                  <div className="col-span-1 bg-slate-900 border border-slate-800 p-6 rounded-2xl h-fit">
                    <h3 className="text-white font-bold mb-4">Tambah Cabang Baru</h3>
                    <form onSubmit={handleAddBranch} className="space-y-4">
                      <input type="text" placeholder="Kode (Cth: JKT-01)" value={newBranch.code} onChange={e => setNewBranch({...newBranch, code: e.target.value})} className="w-full bg-slate-950 border border-slate-800 p-3 rounded-lg text-white" required />
                      <input type="text" placeholder="Nama Cabang" value={newBranch.name} onChange={e => setNewBranch({...newBranch, name: e.target.value})} className="w-full bg-slate-950 border border-slate-800 p-3 rounded-lg text-white" required />
                      <input type="text" placeholder="Lokasi Kota" value={newBranch.location} onChange={e => setNewBranch({...newBranch, location: e.target.value})} className="w-full bg-slate-950 border border-slate-800 p-3 rounded-lg text-white" required />
                      <button type="submit" className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-lg">Simpan Cabang</button>
                    </form>
                  </div>
                  <div className="col-span-2 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-950/50 text-slate-400 border-b border-slate-800">
                        <tr><th className="p-4">Kode</th><th className="p-4">Nama</th><th className="p-4">Lokasi</th><th className="p-4 text-center">Aksi</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/50">
                        {masterBranches.map(b => (
                          <tr key={b.id}>
                            <td className="p-4 font-bold text-white">{b.code}</td>
                            <td className="p-4 text-slate-300">{b.name}</td>
                            <td className="p-4 text-slate-400">{b.location}</td>
                            <td className="p-4 text-center">
                              <button onClick={() => handleDeleteBranch(b.id)} className="text-red-500 hover:bg-red-500/20 p-2 rounded"><Trash2 className="w-4 h-4"/></button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB SETTINGS */}
              {activeTab === "SETTINGS" && (
                <div className="space-y-6 max-w-3xl">
                  <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex items-center justify-between">
                    <div>
                      <h3 className="text-white font-bold text-lg flex items-center gap-2"><DownloadCloud className="text-blue-500"/> Global Database Backup</h3>
                      <p className="text-slate-500 text-sm mt-1">Unduh seluruh tabel Users, Inventory, dan Logs dalam 1 file Excel.</p>
                    </div>
                    <button onClick={handleGlobalBackup} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold">Download Excel</button>
                  </div>
                  
                  <div className="bg-slate-900 border border-red-900/50 p-6 rounded-2xl flex items-center justify-between">
                    <div>
                      <h3 className="text-white font-bold text-lg flex items-center gap-2"><Power className={maintenanceMode ? "text-red-500" : "text-green-500"}/> Maintenance Mode</h3>
                      <p className="text-slate-500 text-sm mt-1">Status saat ini: <span className={maintenanceMode ? "text-red-500 font-bold" : "text-green-500 font-bold"}>{maintenanceMode ? "OFFLINE (MAINTENANCE)" : "ONLINE"}</span></p>
                    </div>
                    <button onClick={handleToggleMaintenance} className={`${maintenanceMode ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"} text-white px-6 py-3 rounded-xl font-bold`}>
                      {maintenanceMode ? "Nyalakan Sistem" : "Matikan Sistem"}
                    </button>
                  </div>
                </div>
              )}

              {/* TAB USERS */}
              {activeTab === "USERS" && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-950/50 text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="p-4">Email User</th>
                        <th className="p-4">Tenant / Branch</th>
                        <th className="p-4 text-center">Hak Akses (Role)</th>
                        <th className="p-4 text-center">Tindakan Hapus</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {filteredUsers.map(u => (
                        <tr key={u.id} className="hover:bg-slate-800/50 transition">
                          <td className="p-4 font-medium text-white">{u.email}</td>
                          <td className="p-4 text-slate-400">{u.tenantId || u.branchLocation || "-"}</td>
                          <td className="p-4 text-center">
                            <select 
                              value={u.role || "CUSTOMER"} 
                              onChange={(e) => handleUpdateRole(u.id, u.email, e.target.value)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold outline-none border ${
                                u.role === 'SUPER_ADMIN' ? 'bg-red-500/10 text-red-500 border-red-500/30' :
                                u.role === 'ADMIN' ? 'bg-blue-500/10 text-blue-500 border-blue-500/30' :
                                u.role === 'FULFILLMENT_MANAGER' ? 'bg-purple-500/10 text-purple-500 border-purple-500/30' :
                                'bg-green-500/10 text-green-500 border-green-500/30'
                              }`}
                            >
                              <option className="bg-slate-900 text-white" value="CUSTOMER">CUSTOMER</option>
                              <option className="bg-slate-900 text-white" value="ADMIN">ADMIN GUDANG</option>
                              <option className="bg-slate-900 text-white" value="FULFILLMENT_MANAGER">MANAGER</option>
                              <option className="bg-slate-900 text-white" value="SUPER_ADMIN">SUPER ADMIN</option>
                            </select>
                          </td>
                          <td className="p-4 text-center">
                            <button onClick={() => handleDeleteUserDoc(u.id, u.email)} className="p-2 text-slate-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition" title="Hapus Dokumen User">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* TAB MASTER DATA (ALL) */}
              {activeTab === "DATA" && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-950/50 text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="p-4">Package ID</th>
                        <th className="p-4">Tenant Pemilik</th>
                        <th className="p-4">Nama Barang</th>
                        <th className="p-4 text-center">Status</th>
                        <th className="p-4 text-center">Aksi Dewa</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {filteredInventory.map(item => (
                        <tr key={item.id} className="hover:bg-slate-800/50 transition">
                          <td className="p-4 font-mono font-bold text-white">
                            {item.packageId}
                            <span className={`ml-2 px-2 py-0.5 text-[8px] rounded uppercase font-bold ${item.type === 'FULFILLMENT' ? 'bg-orange-500/20 text-orange-400' : 'bg-blue-500/20 text-blue-400'}`}>
                              {item.type}
                            </span>
                          </td>
                          <td className="p-4 text-purple-400 uppercase font-bold text-xs">
                            {item.type === "FULFILLMENT" ? `Cabang: ${item.branchLocation}` : `Tenant: ${item.tenantId}`}
                          </td>
                          <td className="p-4 text-slate-300">{item.recipientName || item.namaPaket}</td>
                          <td className="p-4 text-center">
                            <span className="text-[10px] px-2 py-1 bg-slate-800 text-slate-300 rounded border border-slate-700">{item.status}</span>
                          </td>
                          <td className="p-4 text-center">
                            <div className="flex justify-center gap-2">
                              <button onClick={() => handleOpenEditModal(item)} className="p-2 bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 rounded-lg" title="Edit Paksa">
                                <Edit className="w-4 h-4" />
                              </button>
                              {/* Tambahkan parameter type saat menghapus */}
                              <button onClick={() => handleForceDelete(item.id, item.packageId, item.type)} className="p-2 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-lg" title="Hapus Permanen">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* TAB LOGS (ALL) */}
              {activeTab === "LOGS" && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                  <h3 className="text-white font-bold mb-4">100 Aktivitas Sistem Terakhir</h3>
                  <div className="space-y-2">
                    {allLogs.map(log => (
                      <div key={log.id} className="flex items-start gap-4 p-3 bg-slate-950/50 border border-slate-800/50 rounded-lg text-sm">
                        <div className="text-slate-500 w-32 shrink-0">{log.timestamp?.toDate().toLocaleString('id-ID')}</div>
                        <div className="font-bold text-yellow-500 w-24 shrink-0 truncate" title={log.userEmail}>{log.userEmail?.split('@')[0]}</div>
                        <div className="font-mono text-xs text-slate-400 w-24 shrink-0">{log.action}</div>
                        <div className="text-slate-300 flex-1">{log.details}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </AuthGuard>
  );
}