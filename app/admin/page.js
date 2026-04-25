"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import { signOut } from 'firebase/auth';
import { collection, addDoc, serverTimestamp, query, where, getDocs, updateDoc, doc, getDoc, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import AuthGuard from '../../components/AuthGuard';
import Barcode from 'react-barcode';
import { 
  Package, Truck, ClipboardList, Database, LogOut, Plus, Search, 
  Trash2, Send, Download, AlertCircle, ChevronRight, X, Upload,
  CheckCircle, Clock, Box, Users, Activity, User,
  Menu, ChevronLeft, Printer, Barcode as BarcodeIcon, 
  Warehouse, Layers
} from 'lucide-react';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("input");
  const [tenantList, setTenantList] = useState([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scanValue, setScanValue] = useState("");

  useEffect(() => {
    const fetchTenants = async () => {
      const q = query(collection(db, "users"), where("role", "==", "CUSTOMER"));
      const snap = await getDocs(q);
      const data = snap.docs.map(doc => doc.data());
      setTenantList(data);
    };
    fetchTenants();
  }, []);
  
  const router = useRouter();

  const handleLogout = async () => {
    if (confirm("Apakah Anda yakin ingin keluar?")) {
      try {
        await signOut(auth);
        router.push('/login');
      } catch (error) {
        console.error("Error logging out:", error);
      }
    }
  };

  const [selectedImage, setSelectedImage] = useState(null);

  // ==========================================
  // TAB 1: INPUT BARANG
  // ==========================================
  const [formData, setFormData] = useState({ tenantId: '', packageId: '', recipientName: '', sackNumber: '' });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) { setImageFile(file); setImagePreview(URL.createObjectURL(file)); }
  };

  const handleSubmitInput = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      let uploadedPhotoUrl = "";
      if (imageFile) {
        const cloudData = new FormData();
        cloudData.append("file", imageFile);
        cloudData.append("upload_preset", "inventory_preset"); 
        const cloudinaryResponse = await fetch("https://api.cloudinary.com/v1_1/dazzpveus/image/upload", { method: "POST", body: cloudData });
        const cloudResult = await cloudinaryResponse.json();
        if (cloudResult.secure_url) uploadedPhotoUrl = cloudResult.secure_url;
      }

      await addDoc(collection(db, "inventory"), {
        ...formData,
        photoUrl: uploadedPhotoUrl,
        status: "IN_WAREHOUSE",
        createdAt: serverTimestamp()
      });

      await addDoc(collection(db, "logs"), {
        tenantId: formData.tenantId,
        userEmail: "ADMIN PUSAT",
        action: "INPUT BARANG",
        details: `Barang ${formData.packageId} (${formData.recipientName}) masuk ke Rak ${formData.sackNumber}.`,
        timestamp: serverTimestamp()
      });

      alert("Sukses! Barang masuk gudang!");
      
      setFormData({ 
        tenantId: formData.tenantId, 
        packageId: '', 
        recipientName: '', 
        sackNumber: formData.sackNumber 
      });
      setImageFile(null); setImagePreview("");
      fetchMasterData(); 
    } catch (error) { alert("Error: " + error.message); } finally { setIsSubmitting(false); }
  };

  // ==========================================
  // TAB 2: REQUESTS
  // ==========================================
  const [requests, setRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [selectedRequestGroup, setSelectedRequestGroup] = useState(null);

  const fetchPendingRequests = async () => {
    setLoadingRequests(true);
    try {
      const q = query(collection(db, "shippingRequests"), where("status", "==", "PENDING"));
      const snapshot = await getDocs(q);
      const reqData = [];
      for (const document of snapshot.docs) {
        const data = document.data();
        const inventorySnap = await getDoc(doc(db, "inventory", data.inventoryId));
        if (inventorySnap.exists()) {
          reqData.push({ requestId: document.id, inventoryId: data.inventoryId, ...data, ...inventorySnap.data() });
        }
      }
      setRequests(reqData);
    } catch (error) { console.error(error); } finally { setLoadingRequests(false); }
  };

  const groupedRequests = requests.reduce((acc, req) => {
    const dateStr = req.requestedAt ? req.requestedAt.toDate().toLocaleDateString('id-ID') : 'NoDate';
    const rawKey = `${req.tenantId}_${dateStr}_${req.customerNotes || 'TanpaCatatan'}`;
    const batchId = rawKey.replace(/[^a-zA-Z0-9]/g, '').substring(0, 15).toUpperCase();

    if (!acc[batchId]) {
      acc[batchId] = {
        groupId: batchId,
        tenantId: req.tenantId,
        date: dateStr,
        customerNotes: req.customerNotes || 'Tidak ada instruksi khusus.',
        items: []
      };
    }
    acc[batchId].items.push(req);
    return acc;
  }, {});
  
  const requestGroupsArray = Object.values(groupedRequests);

  const handleProcessBatch = async (group, isScanned = false) => {
    if(!isScanned && !confirm(`Proses kirim ${group.items.length} barang sekaligus untuk ${group.tenantId}?`)) return;
    try {
      for (const item of group.items) {
        await updateDoc(doc(db, "inventory", item.inventoryId), { status: "SHIPPED" });
        await updateDoc(doc(db, "shippingRequests", item.requestId), { status: "PROCESSED" });
      }

      await addDoc(collection(db, "logs"), {
        tenantId: group.tenantId,
        userEmail: "ADMIN PUSAT",
        action: isScanned ? "BARANG DIKIRIM (SCAN)" : "BARANG DIKIRIM (MANUAL)",
        details: `Memproses ${group.items.length} barang. Note CS: ${group.customerNotes}`,
        timestamp: serverTimestamp()
      });

      if (isScanned) {
        alert(`BEEP! Barcode ${group.groupId} sukses di-scan. Barang Terkirim!`);
      } else {
        alert("Semua barang dalam permintaan berhasil diproses!");
      }

      setSelectedRequestGroup(null);
      fetchPendingRequests(); 
      fetchMasterData(); 
    } catch (error) { alert("Gagal memproses batch."); }
  };

  const handleDownloadPickList = () => {
    const groupedBySack = requests.reduce((acc, req) => {
      const sack = req.sackNumber || "Tanpa Nomor";
      if (!acc[sack]) acc[sack] = [];
      acc[sack].push(req);
      return acc;
    }, {});

    const dataToExport = Object.keys(groupedBySack).map(sack => {
      const items = groupedBySack[sack];
      const detailBarang = items.map(item => `${item.recipientName?.toUpperCase()}(${item.packageId})`).join(", ");
      return { 'Karung': sack, 'Total Barang': items.length, 'ID / Detail Barang': detailBarang };
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    worksheet['!cols'] = [{ wch: 15 }, { wch: 15 }, { wch: 80 }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "PickList_Per_Karung");
    XLSX.writeFile(workbook, `PickList_Gudang_${new Date().toLocaleDateString('id-ID')}.xlsx`);
  };

  // ==========================================
  // TAB 3: MASTER DATA
  // ==========================================
  const [masterData, setMasterData] = useState([]);
  const [loadingMaster, setLoadingMaster] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterTenant, setFilterTenant] = useState(""); 
  const [filterStatus, setFilterStatus] = useState("");

  const fetchMasterData = async () => {
    setLoadingMaster(true);
    try {
      const q = query(collection(db, "inventory"));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMasterData(data);
    } catch (error) { console.error(error); } finally { setLoadingMaster(false); }
  };

  const handleDeleteItem = async (id, packageId) => {
    if (!confirm(`HAPUS PERMANEN barang ${packageId}? Tindakan ini tidak bisa dibatalkan.`)) return;
    try {
      await deleteDoc(doc(db, "inventory", id));
      alert("Barang berhasil dihapus!");
      fetchMasterData();
    } catch (error) { alert("Gagal menghapus."); }
  };

  const handleManualOut = async (id, packageId, tenantId) => {
    if (!confirm(`Keluarkan barang ${packageId} secara MANUAL (Tanpa request)?`)) return;
    try {
      await updateDoc(doc(db, "inventory", id), { status: "SHIPPED" });
      await addDoc(collection(db, "logs"), {
        tenantId: tenantId,
        userEmail: "ADMIN PUSAT",
        action: "OUT MANUAL",
        details: `Barang ${packageId} dikeluarkan secara manual oleh Admin.`,
        timestamp: serverTimestamp()
      });
      alert("Status berhasil diubah menjadi SHIPPED.");
      fetchMasterData();
    } catch (error) { alert("Gagal update."); }
  };

  const filteredMasterData = masterData.filter((item) => {
    const searchLower = searchTerm.toLowerCase();
    const matchSearch = item.recipientName?.toLowerCase().includes(searchLower) || 
                       item.packageId?.toLowerCase().includes(searchLower) || 
                       item.sackNumber?.toLowerCase().includes(searchLower);
    const matchTenant = filterTenant === "" || item.tenantId === filterTenant;
    const matchStatus = filterStatus === "" || item.status === filterStatus;
    return matchSearch && matchTenant && matchStatus;
  });

  // Fungsi untuk download Master Data ke Excel
  const handleDownloadMasterData = () => {
    if (filteredMasterData.length === 0) return alert("Tidak ada data untuk ditarik!");
    
    // Mapping data agar rapi saat masuk ke Excel
    const dataToExport = filteredMasterData.map((item, index) => ({
      'No': index + 1,
      'Tgl Masuk': item.createdAt ? item.createdAt.toDate().toLocaleString('id-ID') : '-',
      'Tenant': item.tenantId ? item.tenantId.toUpperCase() : '-',
      'Package ID': item.packageId,
      'Nama Penerima / Paket': item.recipientName,
      'Nomor Rak / Karung': item.sackNumber,
      'Status': item.status === 'IN_WAREHOUSE' ? 'Di Gudang' : 
                item.status === 'REQUESTED' ? 'Request' : 'Terkirim'
    }));

    // Proses pembuatan file Excel
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    
    // Atur lebar kolom agar tidak terpotong
    worksheet['!cols'] = [
      { wch: 5 },  // No
      { wch: 20 }, // Tgl
      { wch: 15 }, // Tenant
      { wch: 20 }, // Package ID
      { wch: 30 }, // Nama
      { wch: 20 }, // Rak
      { wch: 15 }  // Status
    ];
    
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Master_Data_Stok");
    XLSX.writeFile(workbook, `Master_Data_Stok_${new Date().toLocaleDateString('id-ID')}.xlsx`);
  };

  // ==========================================
  // TAB 4: LOGS
  // ==========================================
  const [adminLogs, setAdminLogs] = useState([]);

  const fetchAdminLogs = async () => {
    try {
      const q = query(collection(db, "logs"));
      const snapshot = await getDocs(q);
      const logsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      logsData.sort((a, b) => (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0));
      setAdminLogs(logsData);
    } catch (error) { console.error(error); } 
  };

  useEffect(() => {
    fetchPendingRequests();
    fetchMasterData();
    if (activeTab === "logs") fetchAdminLogs();
  }, [activeTab]);

  const stats = {
    inWarehouse: masterData.filter(i => i.status === 'IN_WAREHOUSE').length,
    shipped: masterData.filter(i => i.status === 'SHIPPED').length,
    totalTenants: tenantList.length,
    pendingRequests: requests.length,
    pendingGroups: requestGroupsArray.length
  };

  const menuItems = [
    { id: "input", label: "Input Barang", icon: Plus, color: "purple" },
    { id: "requests", label: "Permintaan Kirim", icon: Truck, color: "orange", badge: stats.pendingGroups },
    { id: "master", label: "Master Data & Stok", icon: Database, color: "blue" },
    { id: "logs", label: "Log Aktivitas", icon: ClipboardList, color: "green" },
  ];

  return (
    <AuthGuard requiredRole="ADMIN">
      <style jsx global>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(-10px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.05); }
        }
        .animate-fade-in-up { animation: fadeInUp 0.4s ease-out forwards; }
        .animate-slide-in { animation: slideIn 0.3s ease-out forwards; }
        .animate-pulse { animation: pulse 1.5s ease-in-out infinite; }
        
        @media print {
          .print-hidden { display: none !important; }
          .print-block { display: block !important; }
          body { background: white; }
        }
        
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: rgba(255,255,255,0.05); border-radius: 10px; }
        ::-webkit-scrollbar-thumb { background: rgba(139,92,246,0.5); border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(139,92,246,0.8); }
      `}</style>

      {/* Modal Foto */}
      {selectedImage && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={() => setSelectedImage(null)}>
          <div className="relative max-w-4xl w-full animate-fade-in-up">
            <button className="absolute -top-12 right-0 text-white text-2xl hover:text-gray-300">✕ Close</button>
            <img src={selectedImage} className="w-full rounded-2xl shadow-2xl" alt="Zoom" />
          </div>
        </div>
      )}

      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        
        {/* Mobile Menu Overlay */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setMobileMenuOpen(false)} />
        )}

        {/* SIDEBAR - FIXED POSITION & FULL HEIGHT */}
        <aside className={`
          fixed top-0 left-0 h-screen z-40 transition-all duration-300 flex flex-col print-hidden
          ${sidebarCollapsed ? 'w-20' : 'w-72'}
          ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}>
          <div className="flex-1 bg-gradient-to-b from-black/80 via-black/60 to-black/80 backdrop-blur-xl border-r border-white/10 flex flex-col h-full overflow-y-auto">
            
            {/* Logo Area - Fixed di atas */}
            <div className={`p-5 border-b border-white/10 flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between'} sticky top-0 bg-black/40 backdrop-blur-sm z-10`}>
              {!sidebarCollapsed && (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl flex items-center justify-center shadow-lg">
                    <Package className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">Admin Panel</h2>
                    <p className="text-xs text-gray-400">Fulfillment Inventory</p>
                  </div>
                </div>
              )}
              {sidebarCollapsed && (
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl flex items-center justify-center mx-auto shadow-lg">
                  <Package className="w-5 h-5 text-white" />
                </div>
              )}
              <button 
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="hidden md:block text-gray-400 hover:text-white transition-colors"
              >
                {sidebarCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
              </button>
            </div>

            {/* Navigation Menu - Flex grow untuk mendorong logout ke bawah */}
            <nav className="flex-1 px-3 py-6 space-y-1.5 overflow-y-auto">
              {menuItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => { setActiveTab(item.id); setMobileMenuOpen(false); setSelectedRequestGroup(null); }}
                  className={`
                    w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group relative
                    ${activeTab === item.id 
                      ? 'bg-gradient-to-r from-purple-600/40 to-blue-600/40 border border-purple-500/30 text-white shadow-lg' 
                      : 'text-gray-400 hover:bg-white/5 hover:text-white'
                    }
                    ${sidebarCollapsed ? 'justify-center' : 'justify-between'}
                  `}
                >
                  <div className={`flex items-center gap-3 ${sidebarCollapsed ? 'justify-center w-full' : ''}`}>
                    <item.icon className={`w-5 h-5 ${activeTab === item.id ? 'text-purple-400' : 'text-gray-400 group-hover:text-purple-400'}`} />
                    {!sidebarCollapsed && <span className="font-medium text-sm">{item.label}</span>}
                  </div>
                  {!sidebarCollapsed && item.badge > 0 && (
                    <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full animate-pulse">
                      {item.badge}
                    </span>
                  )}
                  {sidebarCollapsed && item.badge > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center animate-pulse">
                      {item.badge}
                    </span>
                  )}
                </button>
              ))}

              <div className={`pt-4 mt-4 border-t border-white/10 ${sidebarCollapsed ? 'px-0' : ''}`}>
                <Link 
                  href="/register" 
                  target="_blank"
                  className={`
                    flex items-center gap-3 px-3 py-3 rounded-xl text-orange-400 hover:bg-white/5 transition-all duration-200
                    ${sidebarCollapsed ? 'justify-center' : ''}
                  `}
                >
                  <Users className="w-5 h-5" />
                  {!sidebarCollapsed && <span className="font-medium text-sm">Daftar Klien Baru</span>}
                </Link>
              </div>
            </nav>

            {/* Logout Button - Paling Bawah (mt-auto) */}
            <div className="p-4 border-t border-white/10 mt-auto">
              <button 
                onClick={handleLogout}
                className={`
                  w-full flex items-center gap-3 px-3 py-3 rounded-xl text-red-400 hover:bg-red-500/10 transition-all duration-200
                  ${sidebarCollapsed ? 'justify-center' : ''}
                `}
              >
                <LogOut className="w-5 h-5" />
                {!sidebarCollapsed && <span className="font-medium text-sm">Keluar</span>}
              </button>
            </div>
          </div>
        </aside>

        {/* MAIN CONTENT - dengan margin left sesuai sidebar */}
        <main className={`transition-all duration-300 min-h-screen ${sidebarCollapsed ? 'md:ml-20' : 'md:ml-72'}`}>
          {/* Top Bar - Sticky */}
          <div className="sticky top-0 z-30 bg-black/30 backdrop-blur-md border-b border-white/10 px-6 py-4 flex items-center justify-between print-hidden">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setMobileMenuOpen(true)}
                className="md:hidden text-white p-2 rounded-lg bg-white/10"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-white">
                  {menuItems.find(m => m.id === activeTab)?.label || 'Dashboard'}
                </h1>
                <p className="text-xs text-gray-400 mt-0.5">
                  {activeTab === "input" && "Input barang baru ke gudang"}
                  {activeTab === "requests" && `Ada ${stats.pendingGroups} sesi permintaan pending`}
                  {activeTab === "master" && `Total ${masterData.length} item dalam database`}
                  {activeTab === "logs" && "Riwayat aktivitas sistem"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                <User className="w-4 h-4 text-white" />
              </div>
              <span className="text-white text-sm hidden sm:block">Admin Pusat</span>
            </div>
          </div>

          {/* Content Area - dengan padding dan background penuh sampai bawah */}
          <div className="p-6 print:p-0 min-h-[calc(100vh-73px)]">
            
            {/* TAB 1: INPUT BARANG */}
            {activeTab === "input" && (
              <div className="animate-fade-in-up max-w-5xl mx-auto print-hidden">
                
                {/* Notification Banner */}
                {stats.pendingGroups > 0 && (
                  <div 
                    onClick={() => setActiveTab("requests")}
                    className="mb-6 bg-gradient-to-r from-orange-500/20 to-red-500/20 border border-orange-500/30 rounded-xl p-5 cursor-pointer hover:scale-[1.01] transition-transform"
                  >
                    <div className="flex items-center justify-between flex-wrap gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-orange-500/20 rounded-xl flex items-center justify-center">
                          <AlertCircle className="w-6 h-6 text-orange-400" />
                        </div>
                        <div>
                          <p className="text-orange-400 font-bold text-lg">{stats.pendingGroups} Sesi Permintaan Pengiriman Baru!</p>
                          <p className="text-orange-300/80 text-sm">Total {stats.pendingRequests} barang menunggu dikirim</p>
                        </div>
                      </div>
                      <button className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-5 py-2 rounded-lg font-semibold text-sm">
                        Proses <ChevronRight className="w-4 h-4 inline" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Stats Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-gray-400 text-xs">Di Gudang</p>
                        <p className="text-2xl font-bold text-white">{stats.inWarehouse}</p>
                      </div>
                      <Warehouse className="w-8 h-8 text-blue-400 opacity-60" />
                    </div>
                  </div>
                  <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-gray-400 text-xs">Terkirim</p>
                        <p className="text-2xl font-bold text-white">{stats.shipped}</p>
                      </div>
                      <CheckCircle className="w-8 h-8 text-green-400 opacity-60" />
                    </div>
                  </div>
                  <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-gray-400 text-xs">Tenant Aktif</p>
                        <p className="text-2xl font-bold text-white">{stats.totalTenants}</p>
                      </div>
                      <Users className="w-8 h-8 text-purple-400 opacity-60" />
                    </div>
                  </div>
                  <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-gray-400 text-xs">Sesi Pending</p>
                        <p className="text-2xl font-bold text-white">{stats.pendingGroups}</p>
                      </div>
                      <Layers className="w-8 h-8 text-orange-400 opacity-60" />
                    </div>
                  </div>
                </div>

                {/* Form Card */}
                <div className="bg-white/5 rounded-xl border border-white/10 p-6">
                  <h2 className="text-xl font-bold text-white mb-1">Form Kedatangan Barang</h2>
                  <p className="text-gray-400 text-sm mb-6">Input data barang yang masuk ke gudang</p>
                  
                  <form onSubmit={handleSubmitInput} className="space-y-5">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Pemilik Barang (Tenant)</label>
                      <select 
                        name="tenantId" 
                        value={formData.tenantId} 
                        onChange={handleInputChange} 
                        required 
                        className="w-full px-4 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-purple-500 transition-all"
                      >
                        <option value="" className="bg-slate-800">-- Pilih Tenant --</option>
                        {tenantList.map((tenant, index) => (
                          <option key={index} value={tenant.tenantId} className="bg-slate-800">
                            {tenant.tenantId.toUpperCase()}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Package ID</label>
                        <input 
                          type="text" 
                          name="packageId" 
                          value={formData.packageId} 
                          onChange={handleInputChange} 
                          required 
                          className="w-full px-4 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                          placeholder="PKG-001"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Nama Penerima</label>
                        <input 
                          type="text" 
                          name="recipientName" 
                          value={formData.recipientName} 
                          onChange={handleInputChange} 
                          required 
                          className="w-full px-4 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                          placeholder="Nama lengkap"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Nomor Rak / Karung</label>
                      <input 
                        type="text" 
                        name="sackNumber" 
                        value={formData.sackNumber} 
                        onChange={handleInputChange} 
                        required 
                        className="w-full px-4 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                        placeholder="RAK-A01 / KARUNG-001"
                      />
                    </div>

                  <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Bukti Foto <span className="text-gray-500">(Opsional)</span></label>
                      {imagePreview && (
                        <div className="mb-3 relative inline-block">
                          <img src={imagePreview} alt="Preview" className="h-20 w-20 object-cover rounded-lg border border-white/20" />
                          <button type="button" onClick={() => { setImageFile(null); setImagePreview(""); }} className="absolute -top-2 -right-2 bg-red-500 rounded-full p-0.5 hover:scale-110 transition">
                            <X className="w-3 h-3 text-white" />
                          </button>
                        </div>
                      )}
                      
                      <label className="flex items-center gap-2 px-4 py-2.5 bg-white/10 border border-white/20 rounded-lg cursor-pointer hover:bg-white/15 transition-all w-fit">
                        {/* Kamu bisa mengganti ikon <Upload /> dengan ikon kamera (<Camera />) jika mau */}
                        <Upload className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-400 text-sm">Ambil / Upload foto</span>
                        
                        {/* Atribut ajaib capture="environment" ditambahkan di sini */}
                        <input 
                          type="file" 
                          accept="image/*" 
                          capture="environment" 
                          onChange={handleImageChange} 
                          className="hidden" 
                        />
                      </label>
                    </div>

                    <button 
                      type="submit" 
                      disabled={isSubmitting}
                      className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold py-2.5 rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all duration-300 disabled:opacity-50"
                    >
                      {isSubmitting ? "Menyimpan..." : "Simpan Data Masuk Gudang"}
                    </button>
                  </form>
                </div>
              </div>
            )}

            {/* TAB 2: REQUESTS */}
            {activeTab === "requests" && (
              <div className="animate-fade-in-up print:block">
                
                {!selectedRequestGroup ? (
                  <>
                    {/* Scanner Section */}
                    <div className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-500/30 rounded-xl p-6 mb-8 print-hidden">
                      <div className="text-center">
                        <div className="inline-flex items-center gap-2 bg-blue-500/30 rounded-full px-4 py-1 mb-4">
                          <BarcodeIcon className="w-4 h-4 text-blue-400" />
                          <span className="text-blue-300 text-sm">Scanner Ready</span>
                        </div>
                        <p className="text-white font-bold text-lg mb-2">🎯 Siap Proses Cepat!</p>
                        <p className="text-blue-300 text-sm mb-4">Arahkan kursor ke kotak di bawah, lalu tembak stiker barcode menggunakan Scanner</p>
                        <input 
                          autoFocus
                          type="text" 
                          placeholder="||||| TEMBAK BARCODE DI SINI |||||"
                          className="w-full max-w-lg mx-auto block p-4 text-center text-xl font-mono uppercase border-2 border-blue-500 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500 bg-white/10 text-white placeholder-gray-400"
                          value={scanValue}
                          onChange={(e) => setScanValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              const scannedId = scanValue.toUpperCase().trim();
                              const foundGroup = requestGroupsArray.find(g => g.groupId === scannedId);
                              if (foundGroup) {
                                handleProcessBatch(foundGroup, true);
                              } else {
                                alert("❌ Barcode tidak ditemukan atau barang sudah dikirim!");
                              }
                              setScanValue("");
                            }
                          }}
                        />
                      </div>
                    </div>

                    {/* Header */}
                    <div className="flex justify-between items-center mb-6 print-hidden">
                      <div>
                        <h1 className="text-2xl font-bold text-white">Daftar Sesi Permintaan</h1>
                        <p className="text-gray-400 text-sm mt-1">{requestGroupsArray.length} sesi aktif</p>
                      </div>
                      <button 
                        onClick={handleDownloadPickList} 
                        disabled={requests.length === 0} 
                        className="flex items-center gap-2 bg-green-600/80 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-green-600 transition disabled:opacity-50"
                      >
                        <Download className="w-4 h-4" />
                        Download Pick List
                      </button>
                    </div>
                    
                    {requestGroupsArray.length === 0 ? (
                      <div className="bg-white/5 rounded-xl p-12 text-center border border-white/10 print-hidden">
                        <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
                        <p className="text-gray-400">Belum ada permintaan pengiriman</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-4 print-hidden">
                        {requestGroupsArray.map((group) => (
                          <div key={group.groupId} className="bg-white/5 rounded-xl border border-white/10 p-5 hover:bg-white/10 transition-all">
                            <div className="flex flex-wrap justify-between items-start gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-3 flex-wrap">
                                  <span className="px-3 py-1 bg-purple-500/20 text-purple-400 rounded-lg text-sm font-bold uppercase">{group.tenantId}</span>
                                  <span className="text-gray-400 text-sm">{group.date}</span>
                                  <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-xs">{group.items.length} barang</span>
                                </div>
                                <div className="bg-orange-500/10 border-l-4 border-orange-500 p-3 rounded-r-lg">
                                  <p className="text-xs text-orange-400 font-bold">Catatan CS:</p>
                                  <p className="text-sm text-orange-300 italic">"{group.customerNotes}"</p>
                                </div>
                              </div>
                              <button 
                                onClick={() => setSelectedRequestGroup(group)} 
                                className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-2.5 rounded-lg font-semibold hover:shadow-lg transition-all whitespace-nowrap"
                              >
                                Lihat & Proses →
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  /* Print View for Selected Group */
                  <div className="max-w-4xl mx-auto">
                    <div className="flex justify-between items-center mb-6 print-hidden">
                      <button onClick={() => setSelectedRequestGroup(null)} className="flex items-center gap-2 text-purple-400 hover:text-purple-300 transition">
                        ← Kembali ke Daftar
                      </button>
                      <div className="flex gap-3">
                        <button onClick={() => window.print()} className="flex items-center gap-2 bg-gray-700 text-white px-5 py-2 rounded-lg font-semibold hover:bg-gray-800 transition">
                          <Printer className="w-4 h-4" />
                          Cetak Resi
                        </button>
                        <button onClick={() => handleProcessBatch(selectedRequestGroup, false)} className="flex items-center gap-2 bg-green-600 text-white px-5 py-2 rounded-lg font-semibold hover:bg-green-700 transition">
                          <Send className="w-4 h-4" />
                          Out Manual
                        </button>
                      </div>
                    </div>
                    
                    {/* Printable Receipt */}
                    <div className="bg-white rounded-xl shadow-lg overflow-hidden print:shadow-none">
                      <div className="p-6 print:p-4">
                        <div className="text-center border-b-2 border-dashed border-gray-300 pb-6 mb-6">
                          <div className="inline-flex items-center gap-2 bg-gray-100 px-4 py-2 rounded-full mb-4">
                            <Package className="w-5 h-5 text-purple-600" />
                            <span className="font-bold text-gray-800">FULFILLMENT INVENTORY</span>
                          </div>
                          <h2 className="text-3xl font-black text-gray-900 uppercase tracking-wider">{selectedRequestGroup.tenantId}</h2>
                          <p className="text-gray-600 font-bold text-lg mt-2">TOTAL: {selectedRequestGroup.items.length} BARANG</p>
                          <div className="mt-4 flex justify-center">
                            <Barcode value={selectedRequestGroup.groupId} width={2} height={50} fontSize={14} displayValue={true} />
                          </div>
                        </div>

                        <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded-r-lg mb-6">
                          <p className="font-bold text-gray-800 text-sm uppercase">Instruksi CS:</p>
                          <p className="text-gray-900 text-base font-medium">"{selectedRequestGroup.customerNotes}"</p>
                        </div>

                        <p className="font-bold text-gray-800 mb-3">📦 DAFTAR ISI BARANG:</p>
                        <table className="w-full border-collapse border border-gray-300 text-sm">
                          <thead>
                            <tr className="bg-gray-100">
                              <th className="p-3 border border-gray-300 text-left">Penerima</th>
                              <th className="p-3 border border-gray-300 text-left">Package ID</th>
                              <th className="p-3 border border-gray-300 text-center">Rak Asal</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedRequestGroup.items.map((item, idx) => (
                              <tr key={item.requestId} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                <td className="p-3 border border-gray-300 font-medium text-gray-800">{item.recipientName}</td>
                                <td className="p-3 border border-gray-300 text-gray-700">{item.packageId}</td>
                                <td className="p-3 border border-gray-300 text-center font-mono text-gray-700">{item.sackNumber}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>

                        <div className="mt-6 pt-4 border-t border-gray-200 text-center text-xs text-gray-400">
                          Dicetak pada: {new Date().toLocaleString('id-ID')}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: MASTER DATA */}
            {activeTab === "master" && (
              <div className="animate-fade-in-up print-hidden">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                  <div>
                    <h1 className="text-2xl font-bold text-white">Master Data & Stok Gudang</h1>
                    <p className="text-gray-400 text-sm mt-1">{filteredMasterData.length} dari {masterData.length} item</p>
                  </div>
                  
                  <div className="flex flex-wrap gap-3">
                    <select 
                      className="bg-white/10 border border-white/20 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-purple-500"
                      value={filterTenant}
                      onChange={(e) => setFilterTenant(e.target.value)}
                    >
                      <option value="" className="bg-slate-800">Semua Tenant</option>
                      {tenantList.map((tenant, index) => (
                        <option key={index} value={tenant.tenantId} className="bg-slate-800">{tenant.tenantId.toUpperCase()}</option>
                      ))}
                    </select>

                    <select 
                      className="bg-white/10 border border-white/20 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-purple-500"
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                    >
                      <option value="" className="bg-slate-800">Semua Status</option>
                      <option value="IN_WAREHOUSE" className="bg-slate-800">📦 Di Gudang</option>
                      <option value="REQUESTED" className="bg-slate-800">⏳ Request</option>
                      <option value="SHIPPED" className="bg-slate-800">✅ Terkirim</option>
                    </select>

                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                      <input 
                        type="text" 
                        placeholder="Cari..." 
                        value={searchTerm} 
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9 pr-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:border-purple-500 w-48"
                      />
                    </div>

                    <button 
                      onClick={handleDownloadMasterData}
                      disabled={filteredMasterData.length === 0}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600/80 hover:bg-green-600 text-white rounded-lg text-sm font-semibold transition disabled:opacity-50"
                      title="Tarik Data Excel"
                    >
                      <Download className="w-4 h-4" />
                      <span className="hidden sm:inline">Export Excel</span>
                    </button>
                  </div>
                </div>

                <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10 bg-white/5">
                        <th className="px-4 py-3 text-left text-gray-400 font-medium">Tgl Masuk</th>
                        <th className="px-4 py-3 text-left text-gray-400 font-medium">Tenant</th>
                        <th className="px-4 py-3 text-left text-gray-400 font-medium">Package / Nama</th>
                        <th className="px-4 py-3 text-left text-gray-400 font-medium">No. Rak</th>
                        <th className="px-4 py-3 text-left text-gray-400 font-medium">Status</th>
                        <th className="px-4 py-3 text-center text-gray-400 font-medium">Foto</th>
                        <th className="px-4 py-3 text-center text-gray-400 font-medium">Aksi</th>
                       </tr>
                    </thead>
                    <tbody>
                      {filteredMasterData.map((item) => (
                        <tr key={item.id} className="border-b border-white/10 hover:bg-white/5 transition-colors">
                          <td className="px-4 py-3 text-gray-400 text-xs">
                            {item.createdAt ? item.createdAt.toDate().toLocaleDateString('id-ID') : '-'}
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded text-xs font-bold">{item.tenantId}</span>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-white font-medium text-sm">{item.packageId}</p>
                            <p className="text-gray-500 text-xs">{item.recipientName}</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-xs font-mono">{item.sackNumber}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                              item.status === 'IN_WAREHOUSE' ? 'bg-blue-500/20 text-blue-400' : 
                              item.status === 'REQUESTED' ? 'bg-orange-500/20 text-orange-400' : 
                              'bg-green-500/20 text-green-400'
                            }`}>
                              {item.status === 'IN_WAREHOUSE' ? '📦 Di Gudang' : item.status === 'REQUESTED' ? '⏳ Request' : '✅ Terkirim'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {item.photoUrl ? (
                              <button onClick={() => setSelectedImage(item.photoUrl)}>
                                <img src={item.photoUrl} alt="Barang" className="w-8 h-8 object-cover rounded border border-white/20 hover:scale-110 transition-transform" />
                              </button>
                            ) : (
                              <span className="text-gray-600 text-xs">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex justify-center gap-2">
                              {item.status !== "SHIPPED" && (
                                <button onClick={() => handleManualOut(item.id, item.packageId, item.tenantId)} className="p-1.5 bg-blue-500/20 rounded hover:bg-blue-500/30 transition" title="Out Manual">
                                  <Send className="w-3.5 h-3.5 text-blue-400" />
                                </button>
                              )}
                              <button onClick={() => handleDeleteItem(item.id, item.packageId)} className="p-1.5 bg-red-500/20 rounded hover:bg-red-500/30 transition" title="Hapus">
                                <Trash2 className="w-3.5 h-3.5 text-red-400" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 4: LOGS */}
            {activeTab === "logs" && (
              <div className="animate-fade-in-up print-hidden">
                <h1 className="text-2xl font-bold text-white mb-6">Log Aktivitas</h1>
                <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
                  {adminLogs.length === 0 ? (
                    <div className="p-12 text-center text-gray-400">Belum ada aktivitas</div>
                  ) : (
                    <div className="divide-y divide-white/10">
                      {adminLogs.map((log) => (
                        <div key={log.id} className="p-4 hover:bg-white/5 transition-colors">
                          <div className="flex flex-wrap justify-between items-start gap-2 mb-1">
                            <div className="flex items-center gap-2">
                              <Activity className="w-4 h-4 text-purple-400" />
                              <span className="font-semibold text-white text-sm">{log.action}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-gray-500">{log.timestamp?.toDate().toLocaleString('id-ID')}</span>
                              <span className="px-2 py-0.5 bg-white/10 rounded text-gray-400">{log.tenantId || 'SYSTEM'}</span>
                            </div>
                          </div>
                          <p className="text-gray-400 text-sm ml-6">{log.details}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>
        </main>
      </div>
    </AuthGuard>
  );
}