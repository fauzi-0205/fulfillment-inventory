"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import { collection, addDoc, serverTimestamp, query, where, getDocs, updateDoc, doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("requests"); // Kita jadikan tab requests sebagai default untuk tes ini

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

      alert("Sukses! Barang masuk gudang!");
      setFormData({ tenantId: '', packageId: '', recipientName: '', sackNumber: '' });
      setImageFile(null); setImagePreview("");
    } catch (error) {
      alert("Error: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ==========================================
  // TAB 2: REQUESTS & PICK LIST EXCEL (DIUPDATE!)
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
    if(!confirm("Yakin ingin mengubah status menjadi TERKIRIM?")) return;
    try {
      await updateDoc(doc(db, "inventory", inventoryId), { status: "SHIPPED" });
      await updateDoc(doc(db, "shippingRequests", requestId), { status: "PROCESSED" });
      alert("Barang TERKIRIM!");
      fetchPendingRequests(); 
    } catch (error) { alert("Gagal memproses."); }
  };

  // FUNGSI BARU: CETAK PICK LIST BERDASARKAN RAK
  const handleDownloadPickList = () => {
    if (requests.length === 0) return alert("Tidak ada barang yang perlu diambil!");

    // 1. Urutkan data berdasarkan Nomor Rak secara Alfabetis/Numerik (Misal: 01, 02, 03, dst)
    const sortedRequests = [...requests].sort((a, b) => 
      (a.sackNumber || "").localeCompare(b.sackNumber || "")
    );

    // 2. Format kolom-kolomnya agar rapi di Excel untuk dicetak
    const dataToExport = sortedRequests.map((req, index) => ({
      "No.": index + 1,
      "LOKASI (RAK)": req.sackNumber,
      "Package ID": req.packageId,
      "Tenant": req.tenantId.toUpperCase(),
      "Penerima": req.recipientName,
      "Instruksi Khusus": req.notes || "-",
      "Ceklis": " [   ] " // Kolom kosong untuk Admin mencentang pakai pulpen
    }));

    // 3. Buat dan Download Excel
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Daftar_Ambil_Barang");
    XLSX.writeFile(workbook, `Pick_List_Rak_${new Date().toLocaleDateString('id-ID')}.xlsx`);
  };

  // ==========================================
  // TAB 3: MASTER DATA & SEARCH
  // ==========================================
  const [masterData, setMasterData] = useState([]);
  const [loadingMaster, setLoadingMaster] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchMasterData = async () => {
    setLoadingMaster(true);
    try {
      const q = query(collection(db, "inventory"));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMasterData(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingMaster(false);
    }
  };

  const filteredMasterData = masterData.filter((item) => {
    const searchLower = searchTerm.toLowerCase();
    const matchName = item.recipientName?.toLowerCase().includes(searchLower);
    const matchPackageId = item.packageId?.toLowerCase().includes(searchLower);
    const matchTenant = item.tenantId?.toLowerCase().includes(searchLower);
    const matchSack = item.sackNumber?.toLowerCase().includes(searchLower);
    return matchName || matchPackageId || matchTenant || matchSack;
  });

  useEffect(() => {
    if (activeTab === "requests") fetchPendingRequests();
    if (activeTab === "master") fetchMasterData();
  }, [activeTab]);

  return (
    <div className="min-h-screen bg-gray-100 flex">
      <aside className="w-64 bg-slate-800 text-white flex flex-col">
        <div className="p-6">
          <h2 className="text-2xl font-bold text-blue-400">Admin Panel</h2>
          <p className="text-sm text-slate-400 mt-1">Fulfillment Inventory</p>
        </div>
        <nav className="flex-1 px-4 space-y-2">
          <button onClick={() => setActiveTab("input")} className={`w-full text-left px-4 py-2 rounded-md transition ${activeTab === "input" ? "bg-blue-600 font-bold" : "hover:bg-slate-700"}`}>
            ➕ Input Barang
          </button>
          <button onClick={() => setActiveTab("requests")} className={`w-full text-left px-4 py-2 rounded-md transition flex justify-between items-center ${activeTab === "requests" ? "bg-blue-600 font-bold" : "hover:bg-slate-700"}`}>
            <span>📦 Permintaan Kirim</span>
            {requests.length > 0 && <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">{requests.length}</span>}
          </button>
          <button onClick={() => setActiveTab("master")} className={`w-full text-left px-4 py-2 rounded-md transition ${activeTab === "master" ? "bg-blue-600 font-bold" : "hover:bg-slate-700"}`}>
            🗄️ Master Data & Stok
          </button>
        </nav>
      </aside>

      <main className="flex-1 p-8">
        
        {/* TAB 1: INPUT BARANG */}
        {activeTab === "input" && (
           <div className="max-w-3xl bg-white rounded-xl shadow-sm p-8 border border-gray-200">
           <h1 className="text-2xl font-bold text-gray-800 mb-6">Form Kedatangan Barang</h1>
           <form onSubmit={handleSubmitInput} className="space-y-6">
             <div><label className="block text-sm font-medium text-gray-700 mb-1">Pemilik Barang (Tenant)</label><select name="tenantId" value={formData.tenantId} onChange={handleInputChange} required className="w-full p-3 border border-gray-300 rounded-lg text-black"><option value="">-- Pilih Tenant --</option><option value="tokba">Tokba (Prefix: 4556)</option><option value="wankarpet">Wan Karpet (Prefix: 7788)</option></select></div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div><label className="block text-sm text-gray-700 mb-1">Package ID</label><input type="text" name="packageId" value={formData.packageId} onChange={handleInputChange} required className="w-full p-3 border border-gray-300 rounded-lg text-black" /></div>
               <div><label className="block text-sm text-gray-700 mb-1">Nama Penerima</label><input type="text" name="recipientName" value={formData.recipientName} onChange={handleInputChange} required className="w-full p-3 border border-gray-300 rounded-lg text-black" /></div>
             </div>
             <div><label className="block text-sm text-gray-700 mb-1">Nomor Rak / Karung</label><input type="text" name="sackNumber" value={formData.sackNumber} onChange={handleInputChange} required className="w-full p-3 border border-gray-300 rounded-lg text-black" /></div>
             <div><label className="block text-sm text-gray-700 mb-1">Bukti Foto Barang</label>{imagePreview && <img src={imagePreview} alt="Preview" className="mb-3 h-40 rounded-lg object-cover" />}<input type="file" accept="image/*" onChange={handleImageChange} required className="w-full text-sm text-black" /></div>
             <button type="submit" disabled={isSubmitting} className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg">{isSubmitting ? "Menyimpan..." : "Simpan Data"}</button>
           </form>
         </div>
        )}

        {/* TAB 2: REQUESTS (DENGAN TOMBOL EXCEL PICK LIST) */}
        {activeTab === "requests" && (
          <div className="animate-fade-in">
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-2xl font-bold text-gray-800">Daftar Permintaan Pengiriman</h1>
              
              {/* TOMBOL BARU: EXPORT PICK LIST BERDASARKAN RAK */}
              <button 
                onClick={handleDownloadPickList}
                disabled={requests.length === 0}
                className="bg-green-600 text-white px-5 py-2.5 rounded-lg font-bold shadow hover:bg-green-700 transition flex items-center disabled:bg-gray-400"
              >
                📋 Tarik Pick List per Rak (Excel)
              </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              {loadingRequests ? (
                <div className="p-8 text-center text-gray-500">Memuat permintaan...</div>
              ) : requests.length === 0 ? (
                <div className="p-8 text-center text-gray-500 font-medium">✨ Tidak ada permintaan pengiriman.</div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-orange-50 text-orange-800 text-sm"><th className="p-4 border-b">Tenant</th><th className="p-4 border-b">Package / Resi</th><th className="p-4 border-b">Rak</th><th className="p-4 border-b w-1/3">Instruksi Khusus</th><th className="p-4 border-b text-center">Aksi</th></tr>
                  </thead>
                  <tbody>
                    {requests.map((req) => (
                      <tr key={req.requestId} className="hover:bg-gray-50 text-gray-800 border-b">
                        <td className="p-4 font-bold uppercase">{req.tenantId}</td>
                        <td className="p-4 font-bold">{req.packageId} <br/><span className="text-xs font-normal text-gray-500">{req.recipientName}</span></td>
                        <td className="p-4 font-mono font-bold text-blue-600">{req.sackNumber}</td>
                        <td className="p-4 text-sm text-red-600 italic">"{req.notes}"</td>
                        <td className="p-4 text-center"><button onClick={() => handleMarkAsShipped(req.requestId, req.inventoryId)} className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold text-sm">✅ Kirim</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
        </div>
        )}

        {/* TAB 3: MASTER DATA */}
        {activeTab === "master" && (
          <div className="animate-fade-in">
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-2xl font-bold text-gray-800">Master Data Gudang</h1>
              <input 
                type="text" 
                placeholder="🔍 Cari Nama, Resi, atau Rak..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-white border border-gray-300 text-black px-4 py-2 rounded-lg w-72 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
              />
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              {loadingMaster ? (
                 <div className="p-8 text-center text-gray-500">Memuat data gudang...</div>
              ) : filteredMasterData.length === 0 ? (
                 <div className="p-8 text-center text-red-500 font-bold">Tidak ditemukan barang.</div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 text-sm">
                      <th className="p-4 border-b">Tenant</th>
                      <th className="p-4 border-b">Package / Nama</th>
                      <th className="p-4 border-b">No. Rak</th>
                      <th className="p-4 border-b">Status</th>
                      <th className="p-4 border-b text-center">Foto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMasterData.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50 text-gray-800 border-b">
                        <td className="p-4 font-bold uppercase text-blue-600">{item.tenantId}</td>
                        <td className="p-4 font-medium">{item.packageId} <br/><span className="text-xs text-gray-500">{item.recipientName}</span></td>
                        <td className="p-4 font-mono font-bold">{item.sackNumber}</td>
                        <td className="p-4">
                          <span className={`text-xs font-bold px-2 py-1 rounded ${item.status === 'IN_WAREHOUSE' ? 'bg-blue-100 text-blue-800' : item.status === 'REQUESTED' ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'}`}>
                            {item.status}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          {item.photoUrl ? (
                            <a href={item.photoUrl} target="_blank" rel="noopener noreferrer">
                              <img src={item.photoUrl} alt="Barang" className="w-10 h-10 object-cover rounded mx-auto hover:opacity-80 border border-gray-300" />
                            </a>
                          ) : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}