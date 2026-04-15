"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import { signOut } from 'firebase/auth';
import { collection, addDoc, serverTimestamp, query, where, getDocs, updateDoc, doc, getDoc, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import AuthGuard from '../../components/AuthGuard';
import { 
  Package, 
  Truck, 
  ClipboardList, 
  Database, 
  LogOut, 
  Plus, 
  Search, 
  Trash2, 
  Send, 
  Download, 
  AlertCircle,
  ChevronRight,
  X,
  Upload,
  CheckCircle,
  Clock,
  Box,
  Users,
  Activity,
  Home,
  Bell,
  User,
  Settings,
  Menu,
  ChevronLeft,
  Eye,
  Filter,
  Calendar,
  TrendingUp,
  Archive,
  RefreshCw
} from 'lucide-react';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("input");
  const [tenantList, setTenantList] = useState([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
      setFormData({ tenantId: '', packageId: '', recipientName: '', sackNumber: '' });
      setImageFile(null); setImagePreview("");
      fetchMasterData();
    } catch (error) { alert("Error: " + error.message); } finally { setIsSubmitting(false); }
  };

  // ==========================================
  // TAB 2: REQUESTS
  // ==========================================
  const [requests, setRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);

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

  const handleMarkAsShipped = async (requestId, inventoryId) => {
    if(!confirm("Proses kirim barang ini?")) return;
    try {
      const reqDetail = requests.find(r => r.requestId === requestId);
      await updateDoc(doc(db, "inventory", inventoryId), { status: "SHIPPED" });
      await updateDoc(doc(db, "shippingRequests", requestId), { status: "PROCESSED" });

      await addDoc(collection(db, "logs"), {
        tenantId: reqDetail.tenantId,
        userEmail: "ADMIN PUSAT",
        action: "BARANG DIKIRIM",
        details: `Barang ${reqDetail.packageId} telah diproses kirim.`,
        timestamp: serverTimestamp()
      });
      alert("Barang TERKIRIM!");
      fetchPendingRequests(); 
      fetchMasterData();
    } catch (error) { alert("Gagal memproses."); }
  };

  const handleDownloadPickList = () => {
    const dataToExport = requests.map(req => ({
      'Tenant': req.tenantId,
      'Package ID': req.packageId,
      'Recipient': req.recipientName,
      'Sack Number': req.sackNumber,
    }));
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "PickList");
    XLSX.writeFile(workbook, "PickList_Gudang.xlsx");
  };

  // ==========================================
  // TAB 3: MASTER DATA & FILTERS
  // ==========================================
  const [masterData, setMasterData] = useState([]);
  const [loadingMaster, setLoadingMaster] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterTenant, setFilterTenant] = useState(""); 

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
    const matchSearch = 
      item.recipientName?.toLowerCase().includes(searchLower) ||
      item.packageId?.toLowerCase().includes(searchLower) ||
      item.sackNumber?.toLowerCase().includes(searchLower);
    const matchTenant = filterTenant === "" || item.tenantId === filterTenant;
    return matchSearch && matchTenant;
  });

  // ==========================================
  // TAB 4: LOGS
  // ==========================================
  const [adminLogs, setAdminLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const fetchAdminLogs = async () => {
    setLoadingLogs(true);
    try {
      const q = query(collection(db, "logs"));
      const snapshot = await getDocs(q);
      const logsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      logsData.sort((a, b) => (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0));
      setAdminLogs(logsData);
    } catch (error) { console.error(error); } finally { setLoadingLogs(false); }
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
    pendingRequests: requests.length
  };

  const menuItems = [
    { id: "input", label: "Input Barang", icon: Plus, color: "purple" },
    { id: "requests", label: "Permintaan Kirim", icon: Truck, color: "orange", badge: requests.length },
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
        
        /* Custom scrollbar */
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

      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex">
        
        {/* Mobile Menu Overlay */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setMobileMenuOpen(false)} />
        )}

        {/* SIDEBAR */}
        <aside className={`
          fixed md:relative z-50 h-full transition-all duration-300 flex flex-col
          ${sidebarCollapsed ? 'w-20' : 'w-72'}
          ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}>
          <div className="flex-1 bg-gradient-to-b from-black/60 to-black/40 backdrop-blur-xl border-r border-white/10 flex flex-col h-full">
            
            {/* Logo Area */}
            <div className={`p-5 border-b border-white/10 flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
              {!sidebarCollapsed && (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl flex items-center justify-center">
                    <Package className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">Admin Panel</h2>
                    <p className="text-xs text-gray-400">Fulfillment Inventory</p>
                  </div>
                </div>
              )}
              {sidebarCollapsed && (
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl flex items-center justify-center mx-auto">
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

            {/* Navigation Menu */}
            <nav className="flex-1 px-3 py-6 space-y-1.5">
              {menuItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => { setActiveTab(item.id); setMobileMenuOpen(false); }}
                  className={`
                    w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group
                    ${activeTab === item.id 
                      ? 'bg-gradient-to-r from-purple-600/40 to-blue-600/40 border border-purple-500/30 text-white' 
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

            {/* Logout Button */}
            <div className="p-4 border-t border-white/10">
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

        {/* MAIN CONTENT */}
        <main className="flex-1 overflow-x-auto">
          {/* Top Bar */}
          <div className="sticky top-0 z-30 bg-black/30 backdrop-blur-md border-b border-white/10 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setMobileMenuOpen(true)}
                className="md:hidden text-white p-2 rounded-lg bg-white/10"
              >
                <Menu className="w-5 h-5" />
              </button>
              <h1 className="text-xl font-bold text-white">
                {menuItems.find(m => m.id === activeTab)?.label || 'Dashboard'}
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                <User className="w-4 h-4 text-white" />
              </div>
              <span className="text-white text-sm hidden sm:block">Admin Pusat</span>
            </div>
          </div>

          <div className="p-6">
            
            {/* TAB 1: INPUT BARANG */}
            {activeTab === "input" && (
              <div className="animate-fade-in-up max-w-5xl mx-auto">
                
                {/* Notification Banner */}
                {requests.length > 0 && (
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
                          <p className="text-orange-400 font-bold text-lg">{requests.length} Permintaan Pengiriman Baru!</p>
                          <p className="text-orange-300/80 text-sm">Klik untuk memproses pengiriman</p>
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
                      <Box className="w-8 h-8 text-blue-400 opacity-60" />
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
                        <p className="text-gray-400 text-xs">Pending</p>
                        <p className="text-2xl font-bold text-white">{stats.pendingRequests}</p>
                      </div>
                      <Clock className="w-8 h-8 text-orange-400 opacity-60" />
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
                          <button type="button" onClick={() => { setImageFile(null); setImagePreview(""); }} className="absolute -top-2 -right-2 bg-red-500 rounded-full p-0.5">
                            <X className="w-3 h-3 text-white" />
                          </button>
                        </div>
                      )}
                      <label className="flex items-center gap-2 px-4 py-2.5 bg-white/10 border border-white/20 rounded-lg cursor-pointer hover:bg-white/15 transition-all w-fit">
                        <Upload className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-400 text-sm">Upload foto</span>
                        <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
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
              <div className="animate-fade-in-up">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                  <h2 className="text-xl font-bold text-white">Permintaan Pengiriman</h2>
                  <button 
                    onClick={handleDownloadPickList} 
                    disabled={requests.length === 0}
                    className="flex items-center gap-2 bg-green-600/80 text-white px-4 py-2 rounded-lg font-semibold text-sm hover:bg-green-600 transition-all disabled:opacity-50"
                  >
                    <Download className="w-4 h-4" />
                    Download Pick List
                  </button>
                </div>

                {requests.length === 0 ? (
                  <div className="bg-white/5 rounded-xl border border-white/10 p-12 text-center">
                    <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
                    <p className="text-gray-400">Tidak ada permintaan pengiriman</p>
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {requests.map((req) => (
                      <div key={req.requestId} className="bg-white/5 rounded-xl border border-white/10 p-4 hover:bg-white/10 transition-all">
                        <div className="flex flex-wrap justify-between items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded text-xs font-bold">{req.tenantId}</span>
                              <span className="px-2 py-0.5 bg-orange-500/20 text-orange-400 rounded text-xs">PENDING</span>
                            </div>
                            <p className="text-white font-semibold">{req.packageId}</p>
                            <p className="text-gray-400 text-sm">Penerima: {req.recipientName}</p>
                            <p className="text-gray-500 text-xs mt-1">Rak: {req.sackNumber}</p>
                          </div>
                          <button 
                            onClick={() => handleMarkAsShipped(req.requestId, req.inventoryId)}
                            className="bg-green-600 text-white px-5 py-2 rounded-lg font-semibold text-sm hover:bg-green-700 transition-all flex items-center gap-2 whitespace-nowrap"
                          >
                            <Send className="w-3 h-3" />
                            Kirim
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: MASTER DATA */}
            {activeTab === "master" && (
              <div className="animate-fade-in-up">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                  <h2 className="text-xl font-bold text-white">Master Data & Stok Gudang</h2>
                  
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
                              {item.status}
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
              <div className="animate-fade-in-up">
                <h2 className="text-xl font-bold text-white mb-6">Log Aktivitas</h2>
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