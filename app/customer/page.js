"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, where, getDocs, updateDoc, doc, addDoc, serverTimestamp } from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, db } from '../../lib/firebase';
import AuthGuard from '../../components/AuthGuard';
import { 
  Package, Truck, ClipboardList, LogOut, Search, 
  CheckCircle, Clock, Box, User, Menu, X,
  ChevronLeft, ChevronRight, Eye, Send, FileText,
  AlertCircle, ShoppingBag, Archive, Home, Bell,
  Layers, Plus, Filter, Calendar, Activity
} from 'lucide-react';

export default function CustomerDashboard() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Tab & Loading States
  const [activeTab, setActiveTab] = useState("STOK"); 
  const [statusTab, setStatusTab] = useState("IN_WAREHOUSE"); 
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

  // State untuk Buku Alamat
  const [addresses, setAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [isAddingAddress, setIsAddingAddress] = useState(false);
  const [newAddress, setNewAddress] = useState({ label: "", recipientName: "", phone: "", fullAddress: "" });

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

      const invQuery = query(collection(db, "inventory"), where("tenantId", "==", currentTenantId));
      const invSnapshot = await getDocs(invQuery);
      setInventory(invSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      const logQuery = query(collection(db, "logs"), where("tenantId", "==", currentTenantId));
      const logSnapshot = await getDocs(logQuery);
      const logsData = logSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      logsData.sort((a, b) => (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0));
      setLogs(logsData);

      // Tarik Data Buku Alamat
      const addrQuery = query(collection(db, "addresses"), where("tenantId", "==", currentTenantId));
      const addrSnapshot = await getDocs(addrQuery);
      setAddresses(addrSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  const filteredInventory = inventory.filter(item => {
    const matchStatus = item.status === statusTab;
    const matchSearch = item.packageId?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        item.recipientName?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchStatus && matchSearch;
  });

  const countInWarehouse = inventory.filter(i => i.status === "IN_WAREHOUSE").length;
  const countShipped = inventory.filter(i => i.status === "SHIPPED").length;
  const countRequested = inventory.filter(i => i.status === "REQUESTED").length;

  const handleCheckboxChange = (id) => {
    setSelectedItems(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  };

  const handleSaveAddress = async () => {
    if(!newAddress.label || !newAddress.fullAddress) return alert("Label dan Alamat Lengkap wajib diisi!");
    try {
      const docRef = await addDoc(collection(db, "addresses"), {
        tenantId,
        ...newAddress,
        createdAt: serverTimestamp()
      });
      // Masukkan langsung ke list dropdown tanpa harus refresh
      setAddresses([...addresses, { id: docRef.id, ...newAddress }]);
      setSelectedAddressId(docRef.id);
      setIsAddingAddress(false);
      setNewAddress({ label: "", recipientName: "", phone: "", fullAddress: "" });
    } catch(e) { alert("Gagal menyimpan alamat"); }
  };

  const handleRequestShipment = async () => {
    if (!selectedAddressId) return alert("Pilih alamat pengiriman terlebih dahulu!");
    
    // Ambil data detail alamat yang dipilih
    const selectedAddressData = addresses.find(a => a.id === selectedAddressId);
    
    setIsRequesting(true);
    try {
      for (const itemId of selectedItems) {
        await updateDoc(doc(db, "inventory", itemId), { status: "REQUESTED" });
        await addDoc(collection(db, "shippingRequests"), {
          inventoryId: itemId, tenantId, requestedBy: userEmail,
          customerNotes: requestNote, status: "PENDING", requestedAt: serverTimestamp(),
          // Data alamat ditambahkan ke sini:
          destinationAddress: selectedAddressData 
        });
      }

      await addDoc(collection(db, "logs"), {
        tenantId, userEmail, action: "MINTA KIRIM",
        details: `Meminta kirim ${selectedItems.length} barang ke ${selectedAddressData.label}. Note: ${requestNote || "-"}`,
        timestamp: serverTimestamp()
      });

      alert("Permintaan pengiriman berhasil dikirim!");
      setShowNoteModal(false);
      setSelectedItems([]);
      setRequestNote("");
      setSelectedAddressId(""); // Reset alamat
      await fetchData(userEmail);
    } catch (error) { alert("Gagal."); } finally { setIsRequesting(false); }
  };

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

  const menuItems = [
    { id: "STOK", label: "Stok & Barang", icon: Package, color: "purple" },
    { id: "LOG", label: "Riwayat Aktivitas", icon: ClipboardList, color: "green" },
  ];

  const statusTabs = [
    { id: "IN_WAREHOUSE", label: "Di Gudang", icon: Archive, color: "blue", count: countInWarehouse },
    { id: "REQUESTED", label: "Proses Kirim", icon: Clock, color: "orange", count: countRequested },
    { id: "SHIPPED", label: "Terkirim", icon: CheckCircle, color: "green", count: countShipped },
  ];

  return (
    <AuthGuard requiredRole="CUSTOMER">
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

      {/* Modal Note Shipping & Buku Alamat */}
      {showNoteModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 animate-fade-in-up">
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 w-full max-w-md shadow-2xl border border-white/10 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-orange-500/20 rounded-xl flex items-center justify-center">
                <Send className="w-5 h-5 text-orange-400" />
              </div>
              <h3 className="text-xl font-bold text-white">Detail Pengiriman</h3>
            </div>
            
            <p className="text-sm text-gray-400 mb-6 border-b border-white/10 pb-4">
              Anda memilih <span className="font-bold text-orange-400">{selectedItems.length} barang</span> untuk dikirim.
            </p>

            {/* DROPDOWN ALAMAT */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">Tujuan Pengiriman</label>
              <select 
                value={selectedAddressId}
                onChange={(e) => {
                  if(e.target.value === "NEW") { setIsAddingAddress(true); setSelectedAddressId(""); }
                  else { setSelectedAddressId(e.target.value); setIsAddingAddress(false); }
                }}
                className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white focus:outline-none focus:border-orange-500 transition-all"
              >
                <option value="" className="bg-slate-800">-- Pilih Alamat Tersimpan --</option>
                {addresses.map(a => (
                  <option key={a.id} value={a.id} className="bg-slate-800">
                    {a.label} ({a.recipientName})
                  </option>
                ))}
                <option value="NEW" className="bg-orange-900 font-bold text-orange-200">+ Tambah Alamat Baru</option>
              </select>
            </div>

            {/* FORM TAMBAH ALAMAT BARU */}
            {isAddingAddress && (
              <div className="bg-black/20 p-4 rounded-xl border border-white/10 mb-4 space-y-3 animate-slide-in">
                <input type="text" placeholder="Label (Cth: Rumah Customer A)" value={newAddress.label} onChange={e => setNewAddress({...newAddress, label: e.target.value})} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:border-orange-500 outline-none" />
                <input type="text" placeholder="Nama Penerima" value={newAddress.recipientName} onChange={e => setNewAddress({...newAddress, recipientName: e.target.value})} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:border-orange-500 outline-none" />
                <input type="text" placeholder="Nomor Telepon/WA" value={newAddress.phone} onChange={e => setNewAddress({...newAddress, phone: e.target.value})} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:border-orange-500 outline-none" />
                <textarea placeholder="Alamat Lengkap & Kode Pos" value={newAddress.fullAddress} onChange={e => setNewAddress({...newAddress, fullAddress: e.target.value})} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:border-orange-500 outline-none h-20" />
                
                <div className="flex gap-2 pt-2">
                  <button onClick={() => setIsAddingAddress(false)} className="flex-1 py-2 text-xs font-bold text-gray-400 bg-white/5 rounded-lg hover:bg-white/10">Batal</button>
                  <button onClick={handleSaveAddress} className="flex-1 py-2 text-xs font-bold text-white bg-green-600 rounded-lg hover:bg-green-700">Simpan Alamat</button>
                </div>
              </div>
            )}

            {/* CATATAN TAMBAHAN */}
            {!isAddingAddress && (
              <div className="mb-2">
                <label className="block text-sm font-medium text-gray-300 mb-2">Instruksi Ekstra (Opsional)</label>
                <textarea 
                  className="w-full p-4 bg-white/5 border border-white/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 transition-all h-24 text-sm"
                  placeholder="Contoh: Packing kayu, pakai J&T Cargo..."
                  value={requestNote}
                  onChange={(e) => setRequestNote(e.target.value)}
                />
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <button onClick={() => {setShowNoteModal(false); setIsAddingAddress(false);}} className="flex-1 py-3 font-semibold text-gray-400 hover:bg-white/5 rounded-xl transition">
                Batal
              </button>
              <button 
                onClick={handleRequestShipment} 
                disabled={isRequesting || isAddingAddress}
                className="flex-1 py-3 font-semibold bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl hover:shadow-lg transition-all disabled:opacity-50"
              >
                {isRequesting ? "Memproses..." : "Ajukan Pengiriman"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        
        {/* Mobile Menu Overlay */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setMobileMenuOpen(false)} />
        )}

        {/* SIDEBAR - FIXED POSITION & FULL HEIGHT (SAMA DENGAN ADMIN) */}
        <aside className={`
          fixed top-0 left-0 h-screen z-40 transition-all duration-300 flex flex-col
          ${sidebarCollapsed ? 'w-20' : 'w-72'}
          ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}>
          <div className="flex-1 bg-gradient-to-b from-black/80 via-black/60 to-black/80 backdrop-blur-xl border-r border-white/10 flex flex-col h-full overflow-y-auto">
            
            {/* Logo Area */}
            <div className={`p-5 border-b border-white/10 flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between'} sticky top-0 bg-black/40 backdrop-blur-sm z-10`}>
              {!sidebarCollapsed && (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl flex items-center justify-center shadow-lg">
                    <ShoppingBag className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">Client Portal</h2>
                    <p className="text-xs text-gray-400 truncate max-w-[150px]">{userEmail}</p>
                  </div>
                </div>
              )}
              {sidebarCollapsed && (
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl flex items-center justify-center mx-auto shadow-lg">
                  <ShoppingBag className="w-5 h-5 text-white" />
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
                      ? 'bg-gradient-to-r from-purple-600/40 to-blue-600/40 border border-purple-500/30 text-white shadow-lg' 
                      : 'text-gray-400 hover:bg-white/5 hover:text-white'
                    }
                    ${sidebarCollapsed ? 'justify-center' : ''}
                  `}
                >
                  <item.icon className={`w-5 h-5 ${activeTab === item.id ? 'text-purple-400' : 'text-gray-400 group-hover:text-purple-400'}`} />
                  {!sidebarCollapsed && <span className="font-medium text-sm">{item.label}</span>}
                </button>
              ))}
            </nav>

            {/* Logout Button - Paling Bawah */}
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

        {/* MAIN CONTENT */}
        <main className={`transition-all duration-300 min-h-screen ${sidebarCollapsed ? 'md:ml-20' : 'md:ml-72'}`}>
          {/* Top Bar */}
          <div className="sticky top-0 z-30 bg-black/30 backdrop-blur-md border-b border-white/10 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setMobileMenuOpen(true)}
                className="md:hidden text-white p-2 rounded-lg bg-white/10"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-white">
                  {activeTab === "STOK" ? "Stok & Barang" : "Riwayat Aktivitas"}
                </h1>
                <p className="text-xs text-gray-400 mt-0.5">
                  {activeTab === "STOK" && `Tenant: ${tenantId || 'Memuat...'}`}
                  {activeTab === "LOG" && `${logs.length} aktivitas tercatat`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                <User className="w-4 h-4 text-white" />
              </div>
              <span className="text-white text-sm hidden sm:block truncate max-w-[150px]">{tenantId || 'Customer'}</span>
            </div>
          </div>

          <div className="p-6">
            
            {/* TAB STOK & BARANG */}
            {activeTab === "STOK" && (
              <div className="animate-fade-in-up">
                
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
                  <div className="bg-white/5 rounded-xl p-5 border border-white/10">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-gray-400 text-sm">Di Gudang</p>
                        <p className="text-3xl font-bold text-white mt-1">{countInWarehouse}</p>
                      </div>
                      <Archive className="w-10 h-10 text-blue-400 opacity-60" />
                    </div>
                  </div>
                  <div className="bg-white/5 rounded-xl p-5 border border-white/10">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-gray-400 text-sm">Proses Kirim</p>
                        <p className="text-3xl font-bold text-white mt-1">{countRequested}</p>
                      </div>
                      <Clock className="w-10 h-10 text-orange-400 opacity-60" />
                    </div>
                  </div>
                  <div className="bg-white/5 rounded-xl p-5 border border-white/10">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-gray-400 text-sm">Terkirim</p>
                        <p className="text-3xl font-bold text-white mt-1">{countShipped}</p>
                      </div>
                      <CheckCircle className="w-10 h-10 text-green-400 opacity-60" />
                    </div>
                  </div>
                </div>

                {/* Status Tabs & Search */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                  <div className="flex bg-white/5 rounded-xl p-1 border border-white/10 w-full sm:w-auto">
                    {statusTabs.map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setStatusTab(tab.id)}
                        className={`
                          flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all
                          ${statusTab === tab.id 
                            ? `bg-gradient-to-r from-${tab.color}-600/40 to-${tab.color}-500/20 text-${tab.color}-400 border border-${tab.color}-500/30` 
                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                          }
                        `}
                      >
                        <tab.icon className="w-4 h-4" />
                        <span>{tab.label}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                          statusTab === tab.id ? `bg-${tab.color}-500/30 text-${tab.color}-300` : 'bg-white/10 text-gray-400'
                        }`}>
                          {tab.count}
                        </span>
                      </button>
                    ))}
                  </div>

                  <div className="flex gap-3 w-full sm:w-auto">
                    <div className="relative flex-1 sm:w-64">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                      <input 
                        type="text" 
                        placeholder="Cari ID / Nama penerima..." 
                        className="w-full pl-9 pr-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:border-purple-500"
                        value={searchTerm} 
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                    {statusTab === "IN_WAREHOUSE" && (
                      <button 
                        onClick={() => setShowNoteModal(true)} 
                        disabled={selectedItems.length === 0}
                        className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-red-500 text-white px-5 py-2 rounded-lg font-semibold text-sm hover:shadow-lg transition-all disabled:opacity-50 whitespace-nowrap"
                      >
                        <Send className="w-4 h-4" />
                        Kirim ({selectedItems.length})
                      </button>
                    )}
                  </div>
                </div>

                {/* Tabel Barang */}
                <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10 bg-white/5">
                        {statusTab === "IN_WAREHOUSE" && <th className="px-4 py-3 text-center w-12">Pilih</th>}
                        <th className="px-4 py-3 text-left text-gray-400 font-medium">Tgl Masuk</th>
                        <th className="px-4 py-3 text-left text-gray-400 font-medium">Package ID & Nama</th>
                        <th className="px-4 py-3 text-left text-gray-400 font-medium">Status</th>
                        <th className="px-4 py-3 text-center text-gray-400 font-medium">No. Rak</th>
                        <th className="px-4 py-3 text-center text-gray-400 font-medium">Foto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredInventory.map((item) => (
                        <tr key={item.id} className="border-b border-white/10 hover:bg-white/5 transition-colors">
                          {statusTab === "IN_WAREHOUSE" && (
                            <td className="px-4 py-3 text-center">
                              <input 
                                type="checkbox" 
                                className="w-4 h-4 accent-orange-500 cursor-pointer"
                                checked={selectedItems.includes(item.id)} 
                                onChange={() => handleCheckboxChange(item.id)}
                              />
                            </td>
                          )}
                          <td className="px-4 py-3 text-gray-400 text-xs">
                            {item.createdAt ? item.createdAt.toDate().toLocaleDateString('id-ID') : '-'}
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-white font-medium text-sm">{item.packageId}</p>
                            <p className="text-gray-500 text-xs">{item.recipientName}</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                              item.status === 'IN_WAREHOUSE' ? 'bg-blue-500/20 text-blue-400' : 
                              item.status === 'REQUESTED' ? 'bg-orange-500/20 text-orange-400' : 
                              'bg-green-500/20 text-green-400'
                            }`}>
                              {item.status === 'IN_WAREHOUSE' ? '📦 Di Gudang' : item.status === 'REQUESTED' ? '⏳ Proses' : '✅ Terkirim'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-xs font-mono">{item.sackNumber}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {item.photoUrl ? (
                              <button onClick={() => setSelectedImage(item.photoUrl)}>
                                <img src={item.photoUrl} alt="Barang" className="w-8 h-8 object-cover rounded border border-white/20 hover:scale-110 transition-transform mx-auto" />
                              </button>
                            ) : (
                              <span className="text-gray-600 text-xs">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredInventory.length === 0 && (
                    <div className="p-12 text-center">
                      <Package className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                      <p className="text-gray-400">Tidak ada barang di kategori ini</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB RIWAYAT AKTIVITAS */}
            {activeTab === "LOG" && (
              <div className="animate-fade-in-up">
                <h1 className="text-2xl font-bold text-white mb-6">Riwayat Aktivitas</h1>
                <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
                  {logs.length === 0 ? (
                    <div className="p-12 text-center">
                      <Activity className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                      <p className="text-gray-400">Belum ada riwayat aktivitas</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-white/10">
                      {logs.map((log) => (
                        <div key={log.id} className="p-5 hover:bg-white/5 transition-colors">
                          <div className="flex flex-wrap justify-between items-start gap-2 mb-2">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center">
                                <FileText className="w-4 h-4 text-purple-400" />
                              </div>
                              <span className="font-semibold text-white">{log.action}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                              <Calendar className="w-3 h-3 text-gray-500" />
                              <span className="text-gray-500">{log.timestamp?.toDate().toLocaleString('id-ID')}</span>
                            </div>
                          </div>
                          <p className="text-gray-400 text-sm ml-11">{log.details}</p>
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