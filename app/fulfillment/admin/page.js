"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, query, where, getDocs, addDoc, serverTimestamp, updateDoc, doc } from 'firebase/firestore';
import { auth, db } from '../../../lib/firebase';
import AuthGuard from '../../../components/AuthGuard';
import Barcode from 'react-barcode';
import * as XLSX from 'xlsx';
import { Html5QrcodeScanner } from 'html5-qrcode';

export default function FulfillmentAdminDashboard() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState("");
  const [branchLocation, setBranchLocation] = useState("");
  const [activeTab, setActiveTab] = useState("input");
  
  // State untuk menampung URL foto yang sedang di-klik (Pop-up Foto)
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
    if (confirm("Yakin ingin keluar?")) {
      await signOut(auth);
      router.push('/login');
    }
  };

  // State Global
  const [masterData, setMasterData] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loadingData, setLoadingData] = useState(false);

  // ==========================================
  // STATE: TRANSFER ANTAR CABANG (BARU)
  // ==========================================
  const [trfMode, setTrfMode] = useState("KIRIM"); // "KIRIM" atau "TERIMA"
  const daftarCabang = ["Jakarta", "Tangerang", "Bekasi", "Depok", "Bogor", "Bandung", "Surabaya"]; // Sesuaikan dengan cabang aslimu

  // State Mode Kirim
  const [trfDestBranch, setTrfDestBranch] = useState("");
  const [trfKirimInput, setTrfKirimInput] = useState("");
  const [trfScannedItems, setTrfScannedItems] = useState([]);
  const [trfPrintKarung, setTrfPrintKarung] = useState(null);

  // State Mode Terima
  const [trfTerimaKarungId, setTrfTerimaKarungId] = useState("");
  const [trfActiveKarung, setTrfActiveKarung] = useState(null);
  const [trfTerimaItemInput, setTrfTerimaItemInput] = useState("");
  const [trfVerifiedIds, setTrfVerifiedIds] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [isBulkPrinting, setIsBulkPrinting] = useState(false);

  const fetchAllData = async () => {
    if(!branchLocation) return;
    setLoadingData(true);
    try {
      const qInv = query(collection(db, "jastip_inventory"), where("branchLocation", "==", branchLocation));
      const snapInv = await getDocs(qInv);
      const invData = snapInv.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      invData.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
      setMasterData(invData);

      const qReq = query(collection(db, "jastip_requests"), where("branchLocation", "==", branchLocation), where("status", "==", "PENDING"));
      const snapReq = await getDocs(qReq);
      setPendingRequests(snapReq.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) { console.error(error); } finally { setLoadingData(false); }
  };

  useEffect(() => { if (branchLocation) fetchAllData(); }, [branchLocation, activeTab]);

  // Fungsi Kalkulasi AGING (Level Penyimpanan)
  const getAgingDetails = (createdAt) => {
    if (!createdAt) return { days: 0, level: 1, color: "bg-green-100 text-green-700" };
    const createdDate = createdAt.toDate();
    const now = new Date();
    const diffTime = Math.abs(now - createdDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 7) return { days: diffDays, level: 1, color: "bg-green-100 text-green-700" }; // 1-7 Hari
    if (diffDays <= 14) return { days: diffDays, level: 2, color: "bg-yellow-100 text-yellow-700" }; // 8-14 Hari
    if (diffDays <= 30) return { days: diffDays, level: 3, color: "bg-orange-100 text-orange-700" }; // 15-30 Hari
    return { days: diffDays, level: 4, color: "bg-red-100 text-red-700" }; // 31+ Hari
  };

  const stats = {
    belumRak: masterData.filter(i => i.status === 'BELUM_MASUK_RAK').length,
    diRak: masterData.filter(i => i.status === 'IN_WAREHOUSE').length,
    keluar: masterData.filter(i => i.status === 'SHIPPED').length,
    agingWarning: masterData.filter(i => i.status !== 'SHIPPED' && getAgingDetails(i.createdAt).level >= 3).length
  };

  // ==========================================
  // FITUR SCAN KAMERA (BARU)
  // ==========================================
  const [activeCameraField, setActiveCameraField] = useState(null); // Menyimpan ID input mana yg mau diisi

  useEffect(() => {
    if (activeCameraField) {
      const scanner = new Html5QrcodeScanner("reader", { qrbox: { width: 300, height: 150 }, fps: 10 }, false);
      scanner.render(
        (decodedText) => {
          // Masukkan teks ke input yang sesuai
          if(activeCameraField === 'scanPackageId') setScanPackageId(decodedText);
          if(activeCameraField === 'scanRakId') setScanRakId(decodedText);
          if(activeCameraField === 'outBarcode') setOutBarcode(decodedText);
          if(activeCameraField === 'outResiEksternal') setOutResiEksternal(decodedText);
          
          // Bunyikan beep jika browser mendukung
          try { const audio = new Audio('https://www.soundjay.com/buttons/sounds/beep-07a.mp3'); audio.play(); } catch(e){}
          
          scanner.clear();
          setActiveCameraField(null);
        },
        (error) => { /* ignore */ }
      );
      return () => { scanner.clear().catch(e => console.log(e)); };
    }
  }, [activeCameraField]);


  // ==========================================
  // TAB 1: INPUT BARANG
  // ==========================================
  const [formData, setFormData] = useState({ namaEkspedisi: '', resi: '', namaPaket: '', kategori: '', tujuan: '', berat: '', panjang: '', lebar: '', tinggi: '' });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [printData, setPrintData] = useState(null); 

  const ekspedisiList = ["Shopee Express", "J&T Express", "JNE", "Sicepat", "AnterAja", "Ninja Xpress", "POS Indonesia", "ID Express", "Wahana", "Lainnya"];
  const negaraList = ["Singapore", "Malaysia", "Taiwan", "Indonesia", "Australia", "USA", "Japan", "South Korea", "China", "Hongkong", "Thailand", "Vietnam", "Philippines", "Lainnya"];

  const handleInputChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });
  const handleImageChange = (e) => { const file = e.target.files[0]; if (file) { setImageFile(file); setImagePreview(URL.createObjectURL(file)); } };

  const calculateVolume = () => {
    const p = parseFloat(formData.panjang) || 0; const l = parseFloat(formData.lebar) || 0;
    const t = parseFloat(formData.tinggi) || 0; const b = parseFloat(formData.berat) || 0;
    const divisor = ["Singapore", "Malaysia", "Taiwan"].includes(formData.tujuan) ? 6000 : 5000;
    const volWeight = (p * l * t) / divisor; const finalWeight = Math.max(b, volWeight);
    return { volWeight: volWeight.toFixed(2), finalWeight: finalWeight.toFixed(2) };
  };

  const handleSubmitInput = async (e) => {
    e.preventDefault(); setIsSubmitting(true);
    try {
      let uploadedPhotoUrl = "";
      if (imageFile) {
        const cloudData = new FormData(); cloudData.append("file", imageFile); cloudData.append("upload_preset", "inventory_preset"); 
        const cloudRes = await fetch("https://api.cloudinary.com/v1_1/djojirriv/image/upload", { method: "POST", body: cloudData });
        const cloudResult = await cloudRes.json(); if (cloudResult.secure_url) uploadedPhotoUrl = cloudResult.secure_url;
      }

      const { volWeight, finalWeight } = calculateVolume();
      const randomString = Math.floor(100000 + Math.random() * 900000);
      const newPackageId = `JSTP-${branchLocation.substring(0, 3).toUpperCase()}-${randomString}`;

      await addDoc(collection(db, "jastip_inventory"), {
        branchLocation, packageId: newPackageId, namaEkspedisi: formData.namaEkspedisi, resiEkspedisi: formData.resi,
        namaPaket: formData.namaPaket, kategori: formData.kategori, tujuan: formData.tujuan, dimensi: `${formData.panjang}x${formData.lebar}x${formData.tinggi}`, 
        beratAktual: parseFloat(formData.berat), beratVolumetrik: parseFloat(volWeight), beratFinal: parseFloat(finalWeight), 
        photoUrl: uploadedPhotoUrl, status: "BELUM_MASUK_RAK", rakId: "", resiKeluar: "", createdAt: serverTimestamp()
      });

      await addDoc(collection(db, "jastip_logs"), { branchLocation, userEmail, action: "INBOUND_TERIMA", details: `Paket ${newPackageId} diterima.`, timestamp: serverTimestamp() });

      setPrintData({ packageId: newPackageId, namaPaket: formData.namaPaket, ekspedisi: formData.namaEkspedisi, beratFinal: finalWeight, beratAktual: formData.berat, beratVol: volWeight, tujuan: formData.tujuan });
      setFormData({ ...formData, resi: '', namaPaket: '', berat: '', panjang: '', lebar: '', tinggi: '' }); setImageFile(null); setImagePreview(""); fetchAllData(); 
    } catch (error) { alert("Error: " + error.message); } finally { setIsSubmitting(false); }
  };

  // ==========================================
  // TAB 2: INBOUND & OUTBOUND SCANNER
  // ==========================================
  const [scanMode, setScanMode] = useState("INBOUND"); 
  const [scanPackageId, setScanPackageId] = useState("");
  const [scanRakId, setScanRakId] = useState("");
  const [outBarcode, setOutBarcode] = useState(""); 
  const [outResiEksternal, setOutResiEksternal] = useState("");
  const [isScanning, setIsScanning] = useState(false);

  const handleInboundScan = async (e) => {
    e.preventDefault(); setIsScanning(true);
    try {
      const pkgId = scanPackageId.trim().toUpperCase(); const rakId = scanRakId.trim().toUpperCase();
      const q = query(collection(db, "jastip_inventory"), where("packageId", "==", pkgId), where("branchLocation", "==", branchLocation));
      const snap = await getDocs(q);
      if (snap.empty) { alert("❌ Paket tidak ditemukan!"); setIsScanning(false); return; }

      let docIdToUpdate = ""; let currentStatus = "";
      snap.forEach(doc => { docIdToUpdate = doc.id; currentStatus = doc.data().status; });
      if (currentStatus !== "BELUM_MASUK_RAK") { alert(`❌ Gagal! Paket ini sudah berstatus: ${currentStatus}`); setIsScanning(false); return; }

      await updateDoc(doc(db, "jastip_inventory", docIdToUpdate), { status: "IN_WAREHOUSE", rakId: rakId });
      await addDoc(collection(db, "jastip_logs"), { branchLocation, userEmail, action: "MASUK_RAK", details: `Paket ${pkgId} ➔ Rak ${rakId}`, timestamp: serverTimestamp() });

      alert(`✅ BEEP! Paket sukses masuk ke Rak ${rakId}!`);
      setScanPackageId(""); setScanRakId(""); fetchAllData();
    } catch (error) { alert("Error: " + error.message); } finally { setIsScanning(false); }
  };

  const handleOutboundScan = async (e) => {
    e.preventDefault(); setIsScanning(true);
    try {
      const barcodeId = outBarcode.trim().toUpperCase(); const resiExt = outResiEksternal.trim().toUpperCase();
      const qBatch = query(collection(db, "jastip_requests"), where("batchId", "==", barcodeId), where("branchLocation", "==", branchLocation), where("status", "==", "PENDING"));
      const snapBatch = await getDocs(qBatch);

      if (!snapBatch.empty) {
        const reqDoc = snapBatch.docs[0]; const itemIds = reqDoc.data().inventoryIds;
        // Gunakan Promise.all untuk memproses item secara paralel agar lebih cepat
        await Promise.all(itemIds.map(itemId => 
          updateDoc(doc(db, "jastip_inventory", itemId), { status: "SHIPPED", resiKeluar: resiExt })
        ));
        await updateDoc(doc(db, "jastip_requests", reqDoc.id), { status: "PROCESSED", resiKeluar: resiExt });
        await addDoc(collection(db, "jastip_logs"), { branchLocation, userEmail, action: "OUTBOUND_MULTI", details: `Batch ${barcodeId} dikirim dengan Resi: ${resiExt}`, timestamp: serverTimestamp() });
        alert(`✅ BEEP! Outbound Multi-Koli Sukses! ${itemIds.length} barang terkirim.`);
      } else {
        const qSingle = query(collection(db, "jastip_inventory"), where("packageId", "==", barcodeId), where("branchLocation", "==", branchLocation));
        const snapSingle = await getDocs(qSingle);
        if (snapSingle.empty) { alert("❌ Barcode tidak valid atau barang tidak ditemukan!"); setIsScanning(false); return; }
        
        const invDoc = snapSingle.docs[0];
        if(invDoc.data().status === "SHIPPED") { alert("❌ Paket ini SUDAH PERNAH dikirim!"); setIsScanning(false); return; }
        if(invDoc.data().status === "REQUESTED") { alert("⚠️ Paket ini terkunci dalam Request Gabungan. Harap scan BARCODE BATCH-nya!"); setIsScanning(false); return; }

        await updateDoc(doc(db, "jastip_inventory", invDoc.id), { status: "SHIPPED", resiKeluar: resiExt });
        await addDoc(collection(db, "jastip_logs"), { branchLocation, userEmail, action: "OUTBOUND_SINGLE", details: `Paket ${barcodeId} dikirim dengan Resi: ${resiExt}`, timestamp: serverTimestamp() });
        alert(`✅ BEEP! Outbound Single Sukses!`);
      }
      setOutBarcode(""); setOutResiEksternal(""); fetchAllData();
    } catch (error) { alert("Error: " + error.message); } finally { setIsScanning(false); }
  };

  // ==========================================
  // FUNGSI TRANSFER ANTAR CABANG (BARU)
  // ==========================================

  // --- FUNGSI KIRIM (BUAT KARUNG) ---
  const handleScanTrfKirim = async (e) => {
    e.preventDefault();
    const pkgId = trfKirimInput.trim().toUpperCase();
    if(!pkgId) return;

    if(trfScannedItems.find(i => i.packageId === pkgId)) {
      alert("Paket ini sudah ada di daftar Karung!"); setTrfKirimInput(""); return;
    }

    try {
      const q = query(collection(db, "jastip_inventory"), where("packageId", "==", pkgId), where("branchLocation", "==", branchLocation));
      const snap = await getDocs(q);
      if(snap.empty){ alert("❌ Paket tidak ditemukan di Gudang ini."); setTrfKirimInput(""); return; }

      const docData = snap.docs[0];
      if(docData.data().status === "SHIPPED" || docData.data().status === "IN_TRANSIT") {
        alert(`❌ Gagal! Status paket: ${docData.data().status}`); setTrfKirimInput(""); return;
      }

      setTrfScannedItems(prev => [...prev, { docId: docData.id, ...docData.data() }]);
      setTrfKirimInput("");
    } catch (error) { alert("Error: " + error.message); }
  };

  const handleSubmitTrfKirim = async () => {
    if(trfScannedItems.length === 0 || !trfDestBranch) { alert("Pilih cabang tujuan & scan minimal 1 paket!"); return; }
    if(confirm(`Buat Karung Transfer berisi ${trfScannedItems.length} paket ke ${trfDestBranch}?`)){
      try {
        const karungId = `TRF-${branchLocation.substring(0,3).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
        const packageIdsOnly = trfScannedItems.map(i => i.packageId);

        // 1. Catat karung di database
        await addDoc(collection(db, "jastip_transfers"), {
          transferId: karungId, originBranch: branchLocation, destBranch: trfDestBranch,
          expectedItems: packageIdsOnly, status: "IN_TRANSIT", createdAt: serverTimestamp()
        });

        // 2. Ubah status barang
        // Menggunakan Promise.all agar update status barang tidak berjalan satu-satu (serial)
        await Promise.all(trfScannedItems.map(item => 
          updateDoc(doc(db, "jastip_inventory", item.docId), { status: "IN_TRANSIT", rakId: "" })
        ));

        alert(`✅ Karung Transfer Dibuat!`);
        setTrfPrintKarung({ id: karungId, dest: trfDestBranch, count: packageIdsOnly.length });
        setTrfScannedItems([]); setTrfDestBranch(""); 
        fetchAllData();
      } catch (err) { alert("Gagal membuat Karung: " + err.message); }
    }
  };

  // --- FUNGSI TERIMA (BONGKAR KARUNG) ---
  const handleCariKarungTerima = async (e) => {
    e.preventDefault();
    const kId = trfTerimaKarungId.trim().toUpperCase();
    try {
      const q = query(collection(db, "jastip_transfers"), where("transferId", "==", kId), where("destBranch", "==", branchLocation));
      const snap = await getDocs(q);
      if(snap.empty) { alert("❌ Karung Transfer tidak ditemukan / bukan untuk cabang ini!"); return; }

      const data = snap.docs[0];
      if(data.data().status === "RECEIVED") { alert("✅ Karung ini sudah selesai diserah-terimakan."); return; }

      setTrfActiveKarung({ docId: data.id, ...data.data() });
      setTrfVerifiedIds([]); setTrfTerimaKarungId("");
    } catch(err) { alert("Error mencari karung."); }
  };

  const handleScanTrfTerimaItem = (e) => {
    e.preventDefault();
    const pkgId = trfTerimaItemInput.trim().toUpperCase();

    if(!trfActiveKarung.expectedItems.includes(pkgId)) { alert("❌ Paket ini TIDAK ADA di dalam Karung ini!"); setTrfTerimaItemInput(""); return; }
    if(trfVerifiedIds.includes(pkgId)) { alert("⚠️ Paket sudah di-scan barusan!"); setTrfTerimaItemInput(""); return; }

    setTrfVerifiedIds(prev => [...prev, pkgId]);
    setTrfTerimaItemInput("");
  };

  const handleSubmitTrfTerima = async () => {
    if(trfVerifiedIds.length !== trfActiveKarung.expectedItems.length){ alert("Belum semua barang di-scan!"); return; }
    if(confirm("Selesaikan serah terima? Barang akan masuk ke stok Gudang ini.")){
      try {
        await updateDoc(doc(db, "jastip_transfers", trfActiveKarung.docId), { status: "RECEIVED", receivedAt: serverTimestamp() });

        const qInv = query(collection(db, "jastip_inventory"), where("packageId", "in", trfActiveKarung.expectedItems));
        const snapInv = await getDocs(qInv);
        
        // BUG FIX: forEach tidak menunggu async callback. Gunakan Promise.all.
        const updatePromises = snapInv.docs.map(invDoc => 
          updateDoc(doc(db, "jastip_inventory", invDoc.id), {
            branchLocation: branchLocation, // Pindah kepemilikan cabang
            status: "BELUM_MASUK_RAK", // Reset status
            rakId: ""
          })
        );
        await Promise.all(updatePromises);

        alert("✅ Serah Terima Berhasil!");
        setTrfActiveKarung(null); setTrfVerifiedIds([]); 
        fetchAllData();
      } catch(err) { alert("Gagal update serah terima."); }
    }
  };

  // ==========================================
  // TAB 3: PERMINTAAN KIRIM
  // ==========================================
  const handlePrintBatch = (reqDoc) => {
    setPrintData({ packageId: reqDoc.batchId, namaPaket: `GABUNGAN (${reqDoc.inventoryIds.length} Paket)`, ekspedisi: "MULTI-KOLI", beratFinal: "-", beratAktual: "-", beratVol: "-", tujuan: reqDoc.tujuanInfo || "Tujuan Gabungan" });
  };

  // ==========================================
  // TAB 4: MANAJEMEN RAK (DENGAN LEVEL)
  // ==========================================
  const [rakList, setRakList] = useState([]);
  const [newRakName, setNewRakName] = useState("");
  const [newRakLevel, setNewRakLevel] = useState("1"); // Default Level 1
  const [printRakData, setPrintRakData] = useState(null);

  const fetchRakData = async () => {
    const q = query(collection(db, "jastip_rak"), where("branchLocation", "==", branchLocation));
    const snap = await getDocs(q); setRakList(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  };
  useEffect(() => { if (activeTab === "rak") fetchRakData(); }, [activeTab]);

  const handleAddRak = async (e) => {
    e.preventDefault(); const namaRakFormat = newRakName.trim().toUpperCase(); if(!namaRakFormat) return;
    try { 
      await addDoc(collection(db, "jastip_rak"), { branchLocation, rakId: namaRakFormat, level: parseInt(newRakLevel), createdAt: serverTimestamp() }); 
      alert(`Rak ${namaRakFormat} (Level ${newRakLevel}) berhasil dibuat!`); setNewRakName(""); fetchRakData(); 
    } catch (error) { alert("Gagal."); }
  };

  // ==========================================
  // TAB 5: MASTER DATA & REPORT
  // ==========================================
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterDate, setFilterDate] = useState("");

  const filteredMasterData = masterData.filter((item) => {
    const matchSearch = item.packageId?.toLowerCase().includes(searchTerm.toLowerCase()) || item.resiEkspedisi?.toLowerCase().includes(searchTerm.toLowerCase()) || item.namaPaket?.toLowerCase().includes(searchTerm.toLowerCase()) || item.resiKeluar?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = filterStatus === "" || item.status === filterStatus;
    let matchDate = true;
    if (filterDate && item.createdAt) {
      const itemDate = item.createdAt.toDate(); const offset = itemDate.getTimezoneOffset() * 60000;
      const localDateStr = (new Date(itemDate - offset)).toISOString().split('T')[0];
      matchDate = localDateStr === filterDate;
    }
    return matchSearch && matchStatus && matchDate;
  });

  const handleDownloadReport = () => {
    // 1. Siapkan datanya
    const dataToExport = filteredMasterData.map(item => {
      const aging = getAgingDetails(item.createdAt);
      return {
        'Tgl Input': item.createdAt ? item.createdAt.toDate().toLocaleString('id-ID') : '-',
        'ID Jastip': item.packageId,
        'Resi Masuk': item.resiEkspedisi,
        'Resi Keluar (AWB)': item.resiKeluar || '-',
        'Nama Paket': item.namaPaket,
        'Kategori': item.kategori,
        'Tujuan': item.tujuan,
        'Berat Tagihan (Kg)': item.beratFinal,
        'Status': item.status,
        'Lokasi Rak': item.rakId || '-',
        'Lama Inap (Hari)': aging.days,
        'Level Aging': `Level ${aging.level}`
      };
    });

    // 2. Buat worksheet
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);

    // 3. Atur Lebar Kolom (Auto-Width / Fixed Width) agar rapi
    const wscols = [
      { wch: 20 }, // A: Tgl Input
      { wch: 25 }, // B: ID Jastip
      { wch: 20 }, // C: Resi Masuk
      { wch: 20 }, // D: Resi Keluar
      { wch: 30 }, // E: Nama Paket
      { wch: 15 }, // F: Kategori
      { wch: 18 }, // G: Tujuan
      { wch: 18 }, // H: Berat Tagihan
      { wch: 20 }, // I: Status
      { wch: 15 }, // J: Lokasi Rak
      { wch: 18 }, // K: Lama Inap
      { wch: 15 }  // L: Level Aging
    ];
    worksheet['!cols'] = wscols;

    // 4. Proses simpan ke Excel
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Laporan_Jastip");
    XLSX.writeFile(workbook, `Report_Jastip_${branchLocation}_${new Date().toLocaleDateString('id-ID')}.xlsx`);
  };
  
  // Fungsi pilih/batal pilih satu barang
  const toggleSelectItem = (id) => {
    if (selectedItems.includes(id)) {
      setSelectedItems(selectedItems.filter(item => item !== id));
    } else {
      setSelectedItems([...selectedItems, id]);
    }
  };

  // Fungsi pilih semua barang yang tampil di tabel
  const toggleSelectAll = () => {
    if (selectedItems.length === filteredMasterData.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(filteredMasterData.map(item => item.id));
    }
  };

  // Menyiapkan data untuk dicetak massal
  const handleBulkPrint = () => {
    if (selectedItems.length === 0) return alert("Pilih minimal satu barang!");
    setIsBulkPrinting(true);
  };

  return (
    <AuthGuard requiredRole="FULFILLMENT">
      <div className="min-h-screen bg-slate-50 flex font-sans">
        
        {/* POPUP KAMERA SCANNER */}
        {activeCameraField && (
          <div className="fixed inset-0 bg-black z-[100] flex flex-col items-center justify-center p-4">
            <h2 className="text-white text-xl font-bold mb-4 animate-pulse">Arahkan Kamera ke Barcode</h2>
            <div id="reader" className="w-full max-w-sm bg-white rounded-xl overflow-hidden shadow-2xl"></div>
            <button onClick={() => setActiveCameraField(null)} className="mt-8 bg-red-600 text-white px-8 py-3 rounded-full font-bold shadow-lg hover:bg-red-700">Tutup Kamera</button>
          </div>
        )}

        {/* POPUP FOTO BARANG */}
        {selectedImage && (
          <div 
            className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4 animate-fade-in print:hidden" 
            onClick={() => setSelectedImage(null)}
          >
            <div className="relative max-w-4xl w-full flex flex-col items-center">
              <button 
                className="absolute -top-12 right-0 text-white text-4xl font-bold hover:text-red-500 transition-colors"
                onClick={() => setSelectedImage(null)}
              >
                &times;
              </button>
              <img 
                src={selectedImage} 
                className="max-h-[85vh] rounded-lg shadow-2xl border-4 border-white object-contain" 
                alt="Foto Barang Zoom" 
              />
              <p className="text-white mt-4 text-sm font-bold">Klik di mana saja untuk menutup</p>
            </div>
          </div>
        )}

        {/* POPUP PRINT BARCODE */}
        {printData && (
          <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4 print:bg-white print:p-0">
            <div className="bg-white p-8 rounded-2xl max-w-sm w-full text-center print:shadow-none print:w-full print:max-w-full print:p-0 print:m-0">
              <h2 className="text-xl font-bold text-gray-800 mb-2 print:hidden">Siap Dicetak!</h2>
              <div className="border-2 border-black p-4 inline-block mb-6 w-full max-w-[300px] text-left relative">
                <div className="absolute top-0 right-0 bg-black text-white px-2 py-1 text-xs font-bold uppercase">{printData.tujuan}</div>
                <p className="font-black text-lg uppercase pr-16">{printData.namaPaket}</p>
                <p className="text-xs font-bold text-gray-600 mb-3 border-b border-dashed border-gray-400 pb-1">{printData.ekspedisi}</p>
                <div className="flex justify-center mb-1"><Barcode value={printData.packageId} width={1.8} height={40} fontSize={12} displayValue={true} /></div>
                <div className="mt-2 bg-gray-100 p-2 rounded border border-gray-300 text-center">
                  <p className="text-[10px] text-gray-500">Aktual: {printData.beratAktual}kg | Vol: {printData.beratVol}kg</p>
                  <p className="font-black text-sm uppercase mt-1">Berat Tagihan: {printData.beratFinal} KG</p>
                </div>
              </div>
              <div className="flex gap-2 print:hidden">
                <button onClick={() => setPrintData(null)} className="flex-1 py-2 bg-gray-200 text-gray-700 font-bold rounded-lg hover:bg-gray-300">Tutup</button>
                <button onClick={() => window.print()} className="flex-1 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700">🖨️ Cetak</button>
              </div>
            </div>
          </div>
        )}

        {/* POPUP PRINT KARUNG TRANSFER */}
        {trfPrintKarung && (
          <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4 print:bg-white print:p-0">
            <div className="bg-white p-8 rounded-2xl max-w-sm w-full text-center print:shadow-none print:w-full print:max-w-full print:p-0 print:m-0">
              <h2 className="text-xl font-bold text-gray-800 mb-2 print:hidden">Karung Transfer Siap!</h2>
              <div className="border-4 border-orange-500 p-6 inline-block mb-6 w-full text-center">
                <p className="font-black text-sm mb-1 text-orange-600">KARUNG TRANSFER</p>
                <p className="font-black text-2xl mb-2 tracking-widest uppercase">{trfPrintKarung.id}</p>
                <Barcode value={trfPrintKarung.id} width={2.5} height={60} fontSize={16} displayValue={true} />
                <p className="text-sm font-bold mt-3">DARI: {branchLocation} ➔ KE: {trfPrintKarung.dest}</p>
                <p className="text-xs bg-orange-100 text-orange-800 px-3 py-1 rounded-full inline-block mt-2 font-bold">ISI: {trfPrintKarung.count} PAKET</p>
              </div>
              <div className="flex gap-2 print:hidden">
                <button onClick={() => setTrfPrintKarung(null)} className="flex-1 py-2 bg-gray-200 text-gray-700 font-bold rounded-lg hover:bg-gray-300">Tutup</button>
                <button onClick={() => window.print()} className="flex-1 py-2 bg-orange-600 text-white font-bold rounded-lg hover:bg-orange-700">🖨️ Cetak Karung</button>
              </div>
            </div>
          </div>
        )}

        {/* POPUP CETAK MASSAL */}
{isBulkPrinting && (
  <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4 print:bg-white print:p-0">
    {/* Style CSS Khusus Print untuk Memaksa Pemisahan Halaman */}
    <style jsx global>{`
      @media print {
        @page {
          margin: 0;
          size: auto;
        }
        body {
          background: white;
        }
        .print-container {
          display: block !important;
        }
        .print-page-break {
          page-break-after: always !important;
          break-after: page !important;
          display: block !important;
          margin: 0 !important;
          padding: 20px !important; /* Jarak aman tepi kertas */
        }
      }
    `}</style>

    <div className="bg-white p-8 rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-y-auto print:max-h-none print:overflow-visible print:p-0 print:shadow-none shadow-2xl">
      
      <div className="flex justify-between items-center mb-6 print:hidden border-b pb-4">
        <div>
          <h2 className="text-2xl font-black text-gray-800">Pratinjau Cetak Massal</h2>
          <p className="text-sm text-gray-500">Total: {selectedItems.length} Label siap cetak</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setIsBulkPrinting(false)} className="px-6 py-2 bg-gray-200 font-bold rounded-xl hover:bg-gray-300">Tutup</button>
          <button onClick={() => window.print()} className="px-6 py-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-500/30">Mulai Cetak</button>
        </div>
      </div>

      {/* Area yang akan di-print */}
      <div className="print-container grid grid-cols-1 md:grid-cols-2 gap-8">
        {masterData
          .filter(item => selectedItems.includes(item.id))
          .map((printItem, index) => (
            <div key={printItem.id} className="print-page-break border-2 border-black p-4 w-full max-w-[320px] mx-auto mb-8 text-left relative">
              {/* Header Label */}
              <div className="absolute top-0 right-0 bg-black text-white px-2 py-1 text-[10px] font-bold uppercase">{printItem.tujuan}</div>
              <p className="font-black text-lg uppercase truncate pr-14">{printItem.namaPaket}</p>
              
              <div className="flex justify-between items-end border-b border-dashed border-gray-400 pb-1 mb-2">
                <p className="text-[10px] font-bold text-gray-600 uppercase">{printItem.namaEkspedisi}</p>
                {/* PENAMBAHAN TANGGAL MASUK */}
                <p className="text-[9px] font-bold text-gray-800">
                  TGL: {printItem.createdAt ? printItem.createdAt.toDate().toLocaleDateString('id-ID') : '-'}
                </p>
              </div>
              
              {/* Barcode Area */}
              <div className="flex justify-center mb-1">
                <Barcode value={printItem.packageId} width={1.6} height={45} fontSize={10} displayValue={true} />
              </div>

              {/* Data Berat & Dimensi */}
              <div className="mt-2 bg-gray-100 p-2 rounded border border-gray-300 text-center">
                <p className="text-[9px] text-gray-500">
                  Dimensi: {printItem.dimensi} cm | Akt: {printItem.beratAktual}kg
                </p>
                <p className="font-black text-xs uppercase mt-1">
                  BERAT FINAL: {printItem.beratFinal} KG
                </p>
              </div>

              {/* Footer Label */}
              <div className="mt-2 flex justify-between items-center text-[8px] text-gray-400 font-bold uppercase">
                <span>HUB: {branchLocation}</span>
                <span>Seq: {index + 1}/{selectedItems.length}</span>
              </div>
            </div>
          ))}
      </div>
    </div>
  </div>
)}

        {/* POPUP PRINT RAK */}
        {printRakData && (
          <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4 print:bg-white print:p-0">
            <div className="bg-white p-8 rounded-2xl max-w-sm w-full text-center print:shadow-none print:w-full print:max-w-full print:p-0 print:m-0">
              <div className="border-4 border-black p-6 inline-block mb-6 w-full text-center">
                <p className="font-black text-2xl mb-2 tracking-widest uppercase">LOKASI RAK</p>
                <Barcode value={printRakData.id} width={2.5} height={60} fontSize={20} displayValue={true} />
                <p className="text-sm font-bold mt-2 uppercase">CABANG {branchLocation} | LV.{printRakData.level}</p>
              </div>
              <div className="flex gap-2 print:hidden">
                <button onClick={() => setPrintRakData(null)} className="flex-1 py-2 bg-gray-200 text-gray-700">Tutup</button>
                <button onClick={() => window.print()} className="flex-1 py-2 bg-teal-600 text-white">🖨️ Cetak</button>
              </div>
            </div>
          </div>
        )}

        {/* SIDEBAR */}
        <aside className="w-64 bg-slate-900 text-white flex flex-col print:hidden shadow-xl z-10">
          <div className="p-6">
            <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-teal-400">Jastip Hub</h2>
            <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest flex items-center gap-1">📍 Cabang {branchLocation}</p>
          </div>
          <nav className="flex-1 px-4 space-y-2 mt-4">
            <button onClick={() => setActiveTab("input")} className={`w-full text-left px-4 py-3 rounded-xl transition ${activeTab === "input" ? "bg-blue-600 font-bold" : "hover:bg-slate-800 text-slate-300"}`}>📝 1. Terima Barang</button>
            <button onClick={() => setActiveTab("scan")} className={`w-full text-left px-4 py-3 rounded-xl transition ${activeTab === "scan" ? "bg-blue-600 font-bold" : "hover:bg-slate-800 text-slate-300"}`}>🎯 2. Stasiun Scanner</button>
            <button onClick={() => setActiveTab("requests")} className={`w-full text-left px-4 py-3 rounded-xl transition flex justify-between items-center ${activeTab === "requests" ? "bg-blue-600 font-bold" : "hover:bg-slate-800 text-slate-300"}`}>
              <span>📦 3. Permintaan Kirim</span>
              {pendingRequests.length > 0 && <span className="bg-orange-500 text-white text-xs px-2 py-1 rounded-full">{pendingRequests.length}</span>}
            </button>
            <button onClick={() => setActiveTab("transfer")} className={`w-full text-left px-4 py-3 rounded-xl transition ${activeTab === "transfer" ? "bg-orange-600 font-bold" : "hover:bg-slate-800 text-slate-300"}`}>🚚 Transfer Cabang</button>
            <button onClick={() => setActiveTab("rak")} className={`w-full text-left px-4 py-3 rounded-xl transition ${activeTab === "rak" ? "bg-blue-600 font-bold" : "hover:bg-slate-800 text-slate-300"}`}>🏗️ Manajemen Rak</button>
            <button onClick={() => setActiveTab("master")} className={`w-full text-left px-4 py-3 rounded-xl transition ${activeTab === "master" ? "bg-blue-600 font-bold" : "hover:bg-slate-800 text-slate-300"}`}>🗄️ Master Data</button>
          </nav>
          <div className="p-4 border-t border-slate-800">
            <button onClick={handleLogout} className="w-full py-3 text-red-400 font-bold hover:bg-red-500/10 rounded-xl transition">🚪 Logout Hub</button>
          </div>
        </aside>

        {/* MAIN AREA */}
        <main className="flex-1 p-8 print:hidden flex flex-col">
          
          {/* HEADER STATISTIK GLOBAL */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-3">
              <div className="p-3 bg-red-50 text-red-600 rounded-lg text-xl">⚠️</div>
              <div><p className="text-[10px] text-gray-500 font-bold uppercase">Belum Rak</p><p className="text-xl font-black text-gray-800">{stats.belumRak}</p></div>
            </div>
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-3">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-lg text-xl">📦</div>
              <div><p className="text-[10px] text-gray-500 font-bold uppercase">Di Rak (Siap)</p><p className="text-xl font-black text-gray-800">{stats.diRak}</p></div>
            </div>
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-3">
              <div className="p-3 bg-green-50 text-green-600 rounded-lg text-xl">✈️</div>
              <div><p className="text-[10px] text-gray-500 font-bold uppercase">Outbound</p><p className="text-xl font-black text-gray-800">{stats.keluar}</p></div>
            </div>
            <div className="bg-red-50 p-4 rounded-xl shadow-sm border border-red-200 flex items-center gap-3">
              <div className="p-3 bg-red-100 text-red-600 rounded-lg text-xl">⏳</div>
              <div><p className="text-[10px] text-red-500 font-bold uppercase">Warning: Level 3-4</p><p className="text-xl font-black text-red-800">{stats.agingWarning} <span className="text-xs font-normal">paket</span></p></div>
            </div>
          </div>

          {/* TAB 1: INPUT BARANG */}
          {activeTab === "input" && (
            <div className="max-w-3xl animate-fade-in mx-auto w-full">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-bl-full -z-0"></div>
                <h1 className="text-2xl font-bold text-gray-800 mb-1 relative z-10">Form Penerimaan Ekspedisi</h1>
                <p className="text-sm text-gray-500 mb-8 relative z-10">Data paket yang tiba di hub untuk didata sebelum masuk rak.</p>
                <form onSubmit={handleSubmitInput} className="space-y-6 relative z-10">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div><label className="block text-sm font-bold text-gray-700 mb-2">Nama Ekspedisi</label><select name="namaEkspedisi" value={formData.namaEkspedisi} onChange={handleInputChange} required className="w-full p-3 bg-gray-50 border rounded-xl outline-none"><option value="">-- Pilih --</option>{ekspedisiList.map(e => <option key={e} value={e}>{e}</option>)}</select></div>
                    <div><label className="block text-sm font-bold text-gray-700 mb-2">Resi Ekspedisi</label><input type="text" name="resi" value={formData.resi} onChange={handleInputChange} required className="w-full p-3 bg-gray-50 border rounded-xl outline-none" /></div>
                  </div>
                  <div><label className="block text-sm font-bold text-gray-700 mb-2">Nama Paket</label><input type="text" name="namaPaket" value={formData.namaPaket} onChange={handleInputChange} required className="w-full p-3 bg-gray-50 border rounded-xl outline-none" /></div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div><label className="block text-sm font-bold text-gray-700 mb-2">Kategori</label><select name="kategori" value={formData.kategori} onChange={handleInputChange} required className="w-full p-3 bg-gray-50 border rounded-xl"><option value="">-- Pilih --</option><option value="Non-Food">Non-Food</option><option value="Food">Food</option></select></div>
                    <div><label className="block text-sm font-bold text-gray-700 mb-2">Tujuan</label><select name="tujuan" value={formData.tujuan} onChange={handleInputChange} required className="w-full p-3 bg-gray-50 border rounded-xl"><option value="">-- Pilih --</option>{negaraList.map(n => <option key={n} value={n}>{n}</option>)}</select></div>
                  </div>
                  <div className="bg-blue-50/50 p-6 rounded-xl border border-blue-100">
                    <div className="grid grid-cols-4 gap-4 mb-4">
                      <div><label className="block text-xs text-gray-500 mb-1">P (cm)</label><input type="number" name="panjang" value={formData.panjang} onChange={handleInputChange} required className="w-full p-2 border rounded-lg text-center" /></div>
                      <div><label className="block text-xs text-gray-500 mb-1">L (cm)</label><input type="number" name="lebar" value={formData.lebar} onChange={handleInputChange} required className="w-full p-2 border rounded-lg text-center" /></div>
                      <div><label className="block text-xs text-gray-500 mb-1">T (cm)</label><input type="number" name="tinggi" value={formData.tinggi} onChange={handleInputChange} required className="w-full p-2 border rounded-lg text-center" /></div>
                      <div><label className="block text-xs text-gray-500 mb-1">Berat Aktual (kg)</label><input type="number" step="0.01" name="berat" value={formData.berat} onChange={handleInputChange} required className="w-full p-2 border border-blue-300 bg-white rounded-lg text-center font-bold" /></div>
                    </div>
                  </div>
                  <div><label className="block text-sm font-bold text-gray-700 mb-2">Foto Barang <span className="text-gray-400">(Opsional)</span></label>
                  {imagePreview && <img src={imagePreview} className="mb-3 h-32 rounded-xl object-cover" alt="Preview" />}
                  <input type="file" accept="image/*" capture="environment" onChange={handleImageChange} className="w-full text-sm text-gray-500 file:bg-blue-50 hover:file:bg-blue-100 cursor-pointer" /></div>
                  <button type="submit" disabled={isSubmitting} className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl hover:bg-blue-700">Simpan & Cetak Barcode</button>
                </form>
              </div>
            </div>
          )}

          {/* TAB 2: INBOUND & OUTBOUND SCANNER DENGAN KAMERA */}
          {activeTab === "scan" && (
            <div className="max-w-2xl mx-auto animate-fade-in text-center w-full">
              <div className="flex bg-gray-200 p-1 rounded-2xl mb-8 border border-gray-300 max-w-sm mx-auto">
                <button onClick={() => setScanMode("INBOUND")} className={`flex-1 py-3 rounded-xl font-bold text-sm transition ${scanMode === "INBOUND" ? "bg-white text-blue-600 shadow-md" : "text-gray-500"}`}>📦 INBOUND</button>
                <button onClick={() => setScanMode("OUTBOUND")} className={`flex-1 py-3 rounded-xl font-bold text-sm transition ${scanMode === "OUTBOUND" ? "bg-green-600 text-white shadow-md" : "text-gray-500"}`}>✈️ OUTBOUND</button>
              </div>

              {scanMode === "INBOUND" ? (
                <form onSubmit={handleInboundScan} className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100 text-left">
                  <div className="text-center mb-6"><div className="inline-flex w-16 h-16 rounded-full bg-blue-100 text-blue-600 text-3xl items-center justify-center mb-2">📥</div><h2 className="text-2xl font-black text-gray-800">Scan Inbound</h2></div>
                  
                  <div className="mb-4">
                    <label className="block text-sm font-bold text-blue-600 mb-2">1. Barcode Paket (JSTP-...)</label>
                    <div className="flex gap-2">
                      <input type="text" className="w-full p-4 text-xl font-mono uppercase border-4 border-blue-200 rounded-2xl bg-gray-50" value={scanPackageId} onChange={(e) => setScanPackageId(e.target.value)} required />
                      <button type="button" onClick={() => setActiveCameraField("scanPackageId")} className="bg-blue-100 hover:bg-blue-200 text-blue-600 p-4 rounded-2xl text-xl">📷</button>
                    </div>
                  </div>
                  
                  <div className="mb-4">
                    <label className="block text-sm font-bold text-teal-600 mb-2">2. Barcode Rak</label>
                    <div className="flex gap-2">
                      <input type="text" className="w-full p-4 text-xl font-mono uppercase border-4 border-teal-200 rounded-2xl bg-gray-50" value={scanRakId} onChange={(e) => setScanRakId(e.target.value)} required />
                      <button type="button" onClick={() => setActiveCameraField("scanRakId")} className="bg-teal-100 hover:bg-teal-200 text-teal-600 p-4 rounded-2xl text-xl">📷</button>
                    </div>
                  </div>

                  <button type="submit" disabled={isScanning || !scanPackageId || !scanRakId} className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl mt-4">PROSES INBOUND</button>
                </form>
              ) : (
                <form onSubmit={handleOutboundScan} className="bg-white p-8 rounded-3xl shadow-xl border-t-8 border-t-green-500 text-left">
                  <div className="text-center mb-6"><div className="inline-flex w-16 h-16 rounded-full bg-green-100 text-green-600 text-3xl items-center justify-center mb-2">✈️</div><h2 className="text-2xl font-black text-gray-800">Scan Outbound</h2></div>
                  
                  <div className="mb-4">
                    <label className="block text-sm font-bold text-green-600 mb-2">1. Barcode Barang / Batch Gabungan</label>
                    <div className="flex gap-2">
                      <input type="text" className="w-full p-4 text-xl font-mono uppercase border-4 border-green-200 rounded-2xl bg-gray-50" value={outBarcode} onChange={(e) => setOutBarcode(e.target.value)} required />
                      <button type="button" onClick={() => setActiveCameraField("outBarcode")} className="bg-green-100 hover:bg-green-200 text-green-600 p-4 rounded-2xl text-xl">📷</button>
                    </div>
                  </div>
                  
                  <div className="mb-4">
                    <label className="block text-sm font-bold text-purple-600 mb-2">2. Resi Eksternal (AWB)</label>
                    <div className="flex gap-2">
                      <input type="text" className="w-full p-4 text-xl font-mono uppercase border-4 border-purple-200 rounded-2xl bg-gray-50" value={outResiEksternal} onChange={(e) => setOutResiEksternal(e.target.value)} required />
                      <button type="button" onClick={() => setActiveCameraField("outResiEksternal")} className="bg-purple-100 hover:bg-purple-200 text-purple-600 p-4 rounded-2xl text-xl">📷</button>
                    </div>
                  </div>

                  <button type="submit" disabled={isScanning || !outBarcode || !outResiEksternal} className="w-full bg-green-600 text-white font-bold py-4 rounded-xl mt-4">PROSES KIRIM (OUTBOUND)</button>
                </form>
              )}
            </div>
          )}

          {/* TAB: TRANSFER ANTAR CABANG (BARU) */}
          {activeTab === "transfer" && (
            <div className="max-w-4xl mx-auto w-full">
              <div className="flex bg-gray-200 p-1 rounded-xl mb-6 max-w-sm mx-auto shadow-inner">
                <button onClick={() => {setTrfMode("KIRIM"); setTrfScannedItems([]); setTrfActiveKarung(null);}} className={`flex-1 py-3 rounded-lg font-bold text-sm ${trfMode === "KIRIM" ? "bg-blue-600 text-white" : "text-gray-500"}`}>📤 KIRIM KE CABANG</button>
                <button onClick={() => {setTrfMode("TERIMA"); setTrfScannedItems([]); setTrfActiveKarung(null);}} className={`flex-1 py-3 rounded-lg font-bold text-sm ${trfMode === "TERIMA" ? "bg-green-600 text-white" : "text-gray-500"}`}>📥 TERIMA DARI CABANG</button>
              </div>

              {trfMode === "KIRIM" ? (
                <div className="bg-white rounded-xl shadow border p-6 flex flex-col md:flex-row gap-6">
                  {/* KIRI: Input & Scan */}
                  <div className="flex-1 border-r pr-6">
                    <h2 className="text-xl font-bold mb-4">Buat Karung Transit</h2>
                    <label className="block text-sm font-bold mb-2">Tujuan Cabang</label>
                    <select value={trfDestBranch} onChange={(e) => setTrfDestBranch(e.target.value)} className="w-full p-3 border rounded-xl mb-4 bg-gray-50">
                      <option value="">-- Pilih Tujuan --</option>
                      {daftarCabang.filter(c => c.toUpperCase() !== branchLocation.toUpperCase()).map(c => <option key={c} value={c}>{c}</option>)}
                    </select>

                    <form onSubmit={handleScanTrfKirim}>
                      <label className="block text-sm font-bold mb-2">Scan Barcode Paket</label>
                      <div className="flex gap-2 mb-4">
                        <input autoFocus type="text" placeholder="JSTP-..." className="w-full p-3 font-mono uppercase border rounded-xl bg-gray-50" value={trfKirimInput} onChange={(e) => setTrfKirimInput(e.target.value)} />
                        <button type="submit" className="bg-blue-600 text-white font-bold px-4 rounded-xl">+</button>
                      </div>
                    </form>
                  </div>
                  {/* KANAN: Daftar Isi Karung */}
                  <div className="flex-1 flex flex-col">
                    <h2 className="text-sm font-bold text-gray-500 mb-2 uppercase">Isi Karung ({trfScannedItems.length})</h2>
                    <div className="bg-slate-50 rounded-xl border flex-1 p-2 overflow-y-auto max-h-60 mb-4 space-y-2">
                      {trfScannedItems.map((item, idx) => (
                        <div key={item.packageId} className="bg-white p-2 border rounded flex justify-between items-center text-sm">
                          <span className="font-mono font-bold text-blue-600">{item.packageId}</span>
                          <button onClick={() => setTrfScannedItems(trfScannedItems.filter((_, i) => i !== idx))} className="text-red-500 font-bold px-2">X</button>
                        </div>
                      ))}
                    </div>
                    <button onClick={handleSubmitTrfKirim} disabled={trfScannedItems.length === 0} className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl disabled:bg-gray-300">CETAK BARCODE KARUNG</button>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-xl shadow border p-6 flex flex-col md:flex-row gap-6">
                  {/* KIRI: Cari Karung */}
                  <div className="flex-1 border-r pr-6">
                    <h2 className="text-xl font-bold mb-4">Bongkar Karung</h2>
                    {!trfActiveKarung ? (
                      <form onSubmit={handleCariKarungTerima}>
                        <label className="block text-sm font-bold mb-2">Scan Barcode Karung (TRF-...)</label>
                        <div className="flex gap-2">
                          <input autoFocus type="text" placeholder="TRF-..." className="w-full p-3 font-mono uppercase border rounded-xl bg-gray-50" value={trfTerimaKarungId} onChange={(e) => setTrfTerimaKarungId(e.target.value)} required />
                          <button type="submit" className="bg-green-600 text-white font-bold px-4 rounded-xl">CARI</button>
                        </div>
                      </form>
                    ) : (
                      <div>
                        <div className="bg-green-50 p-4 rounded-xl border border-green-200 mb-4">
                          <p className="text-xs text-green-600 font-bold">DARI: {trfActiveKarung.originBranch}</p>
                          <p className="text-lg font-black font-mono">{trfActiveKarung.transferId}</p>
                          <p className="text-sm font-bold mt-2">Divalidasi: {trfVerifiedIds.length} / {trfActiveKarung.expectedItems.length}</p>
                        </div>
                        <form onSubmit={handleScanTrfTerimaItem}>
                          <label className="block text-sm font-bold mb-2">Bongkar Karung & Scan Paket</label>
                          <input autoFocus type="text" placeholder="Scan JSTP-..." className="w-full p-3 font-mono uppercase border rounded-xl" value={trfTerimaItemInput} onChange={(e) => setTrfTerimaItemInput(e.target.value)} required />
                          <button type="submit" className="hidden">OK</button>
                        </form>
                      </div>
                    )}
                  </div>
                  {/* KANAN: Validasi Daftar */}
                  <div className="flex-1 flex flex-col">
                    <h2 className="text-sm font-bold text-gray-500 mb-2 uppercase">Manifest Validasi</h2>
                    <div className="bg-slate-50 rounded-xl border flex-1 p-2 overflow-y-auto max-h-60 mb-4 space-y-2">
                      {!trfActiveKarung ? ( <p className="text-center text-gray-400 mt-10 text-xs">Scan Karung terlebih dahulu.</p> ) : (
                        trfActiveKarung.expectedItems.map(pkgId => {
                          const isOk = trfVerifiedIds.includes(pkgId);
                          return (
                            <div key={pkgId} className={`p-2 border rounded flex justify-between text-sm ${isOk ? 'bg-green-100' : 'bg-white'}`}>
                              <span className="font-mono font-bold">{pkgId}</span>
                              <span>{isOk ? '✅' : '⏳'}</span>
                            </div>
                          )
                        })
                      )}
                    </div>
                    {trfActiveKarung && (
                      <button onClick={handleSubmitTrfTerima} disabled={trfVerifiedIds.length !== trfActiveKarung.expectedItems.length} className="w-full bg-green-600 text-white font-bold py-3 rounded-xl disabled:bg-gray-300">
                        SELESAIKAN SERAH TERIMA
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: REQUESTS (Diringkas agar code cukup) */}
          {/* TAB: PERMINTAAN KIRIM (REQUESTS) */}
          {activeTab === "requests" && (
            <div className="animate-fade-in w-full">
              <h1 className="text-2xl font-bold text-gray-800 mb-6">Permintaan Pengiriman Gabungan</h1>
              
              {pendingRequests.length === 0 ? (
                <div className="bg-white p-12 text-center rounded-2xl border border-gray-200 text-gray-400 font-medium">
                  Tidak ada antrean permintaan pengiriman dari Manager.
                </div>
              ) : (
                <div className="space-y-6">
                  {pendingRequests.map(req => (
                    <div key={req.id} className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                      
                      {/* HEADER REQUEST */}
                      <div className="p-6 border-b border-gray-100 bg-gray-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="bg-orange-500 text-white font-black px-3 py-1 rounded-lg text-xs uppercase shadow-sm">{req.batchId}</span>
                            <span className="text-gray-500 text-xs">{req.createdAt?.toDate().toLocaleString('id-ID')}</span>
                          </div>
                          <h3 className="font-bold text-gray-800 text-lg">Minta kirim {req.inventoryIds.length} Paket Gabungan</h3>
                          <p className="text-sm text-gray-600 mt-1">Tujuan: <strong className="text-black">{req.tujuanInfo}</strong></p>
                        </div>
                        <div className="flex gap-2 w-full md:w-auto">
                           <button onClick={() => handlePrintBatch(req)} className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 shadow-md w-full md:w-auto">
                             🖨️ Print Barcode Batch
                           </button>
                        </div>
                      </div>

                      {/* BODY REQUEST: NOTES & DAFTAR BARANG */}
                      <div className="p-6">
                        
                        {/* Catatan / Notes dari Manager */}
                        {req.notes && (
                          <div className="mb-6 p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded-r-lg">
                            <p className="text-xs font-bold text-yellow-800 mb-1">Catatan Manager:</p>
                            <p className="text-sm text-yellow-700 italic">"{req.notes}"</p>
                          </div>
                        )}

                        {/* Daftar Barang yang harus diambil di Rak (Picking List) */}
                        <h4 className="text-sm font-bold text-gray-700 mb-3 uppercase tracking-wider">Daftar Paket yang harus diambil (Picking List):</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {req.inventoryIds.map(itemId => {
                            // Mencari detail barang di masterData gudang agar tahu lokasi raknya
                            const detailBarang = masterData.find(item => item.id === itemId);
                            
                            return (
                              <div key={itemId} className="flex items-center justify-between p-3 border border-gray-200 rounded-xl bg-white hover:border-blue-300 transition">
                                <div>
                                  <span className="font-mono font-bold text-indigo-600 block text-lg">
                                    {detailBarang ? detailBarang.packageId : "ID Tidak Ditemukan"}
                                  </span>
                                  <span className="text-xs text-gray-500 block uppercase mt-1">
                                    {detailBarang ? detailBarang.namaPaket : "-"}
                                  </span>
                                </div>
                                <div className="text-right">
                                  <span className="text-[10px] text-gray-400 block mb-1">Ambil di Rak:</span>
                                  <span className="bg-gray-800 text-white px-3 py-1.5 rounded-lg font-mono text-sm font-black shadow-inner">
                                    {detailBarang?.rakId || "N/A"}
                                  </span>
                                </div>
                              </div>
                            )
                          })}
                        </div>

                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: MANAJEMEN RAK (DENGAN LEVEL) */}
          {activeTab === "rak" && (
            <div className="animate-fade-in mx-auto w-full max-w-4xl">
              <h1 className="text-2xl font-bold text-gray-800 mb-6">Manajemen Rak Berdasarkan Level</h1>
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 mb-8 flex flex-col md:flex-row gap-4 items-end">
                <div className="flex-1"><label className="block text-sm font-bold text-gray-700 mb-2">Nama Rak Baru</label><input type="text" placeholder="Contoh: RAK-A1" className="w-full p-3 border rounded-xl outline-none uppercase font-mono" value={newRakName} onChange={(e) => setNewRakName(e.target.value)} /></div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Level Peruntukan</label>
                  <select className="w-full p-3 border rounded-xl outline-none" value={newRakLevel} onChange={(e) => setNewRakLevel(e.target.value)}>
                    <option value="1">Level 1 (1-7 Hari)</option>
                    <option value="2">Level 2 (8-14 Hari)</option>
                    <option value="3">Level 3 (15-30 Hari)</option>
                    <option value="4">Level 4 (31+ Hari)</option>
                  </select>
                </div>
                <button onClick={handleAddRak} disabled={!newRakName} className="bg-teal-600 text-white font-bold px-8 py-3 rounded-xl hover:bg-teal-700">➕ Tambah Rak</button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {rakList.map(rak => (
                  <div key={rak.id} className="bg-white border p-4 rounded-xl shadow-sm text-center cursor-pointer relative" onClick={() => setPrintRakData({id: rak.rakId, level: rak.level})}>
                    <div className="absolute top-2 right-2 bg-gray-800 text-white text-[10px] font-bold px-2 py-1 rounded">LV.{rak.level}</div>
                    <div className="text-teal-600 mb-2 mt-2 text-2xl">🏗️</div>
                    <p className="font-mono font-bold text-lg">{rak.rakId}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: MASTER DATA DENGAN AGING & EXCEL */}
          {activeTab === "master" && (
            <div className="animate-fade-in flex-1 flex flex-col">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <h1 className="text-2xl font-bold text-gray-800">Master Data & Aging Inventory</h1>
                <div className="flex flex-wrap gap-3">
                  <button onClick={handleDownloadReport} className="bg-green-600 text-white font-bold px-4 py-2 rounded-lg shadow hover:bg-green-700">📊 Laporan Excel</button>
                  <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="p-2 border rounded-lg text-sm outline-none" />
                  <select className="bg-white border p-2 rounded-lg text-sm" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                    <option value="">Semua Status</option><option value="BELUM_MASUK_RAK">Belum Masuk Rak</option><option value="IN_WAREHOUSE">Di Rak (Inbound)</option><option value="SHIPPED">Terkirim (Outbound)</option>
                  </select>
                  <input type="text" placeholder="🔍 Cari ID / Resi" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="bg-white border p-2 rounded-lg text-sm w-full md:w-64" />
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border overflow-hidden overflow-x-auto flex-1">
                <table className="w-full text-left border-collapse text-sm min-w-[1000px]">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-xs sticky top-0 z-20">
                      <th className="p-4 border-b">
                        <input 
                          type="checkbox" 
                          onChange={toggleSelectAll} 
                          checked={selectedItems.length === filteredMasterData.length && filteredMasterData.length > 0}
                          className="w-4 h-4 cursor-pointer"
                        />
                      </th>
                  <th className="p-4 border-b">Tgl Input</th><th className="p-4 border-b">ID Jastip & Resi</th><th className="p-4 border-b">Detail Paket</th><th className="p-4 border-b text-center">Status & Rak</th><th className="p-4 border-b text-center">SLA Aging</th><th className="p-4 border-b text-center">Foto</th><th className="p-4 border-b text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMasterData.map((item) => {
                      const aging = getAgingDetails(item.createdAt);
                      return (
                      <tr key={item.id} className={`hover:bg-slate-50 border-b ${selectedItems.includes(item.id) ? 'bg-blue-50/50' : ''}`}>
                        <td className="p-4">
                          <input 
                            type="checkbox" 
                            checked={selectedItems.includes(item.id)} 
                            onChange={() => toggleSelectItem(item.id)}
                            className="w-4 h-4 cursor-pointer"
                          />
                        </td>
                        <td className="p-4 text-gray-500 text-xs">{item.createdAt ? item.createdAt.toDate().toLocaleString('id-ID') : '-'}</td>
                        <td className="p-4">
                          <span className="font-bold text-blue-600 block">{item.packageId}</span>
                          <span className="text-gray-500 text-xs mt-1">In: {item.resiEkspedisi}</span>
                          {item.resiKeluar && <span className="text-green-600 font-bold text-xs block mt-1">Out: {item.resiKeluar}</span>}
                        </td>
                        <td className="p-4">
                          <span className="font-bold text-gray-800 block uppercase">{item.namaPaket}</span>
                          <span className="text-gray-500 text-xs">{item.kategori} ➔ {item.tujuan}</span>
                        </td>
                        <td className="p-4 text-center">
                          <span className="text-[10px] font-black uppercase px-2 py-1 rounded-full block mb-1 bg-gray-100">{item.status}</span>
                          <span className="font-mono font-bold text-gray-500 text-xs">{item.rakId || "N/A"}</span>
                        </td>
                        <td className="p-4 text-center">
                          <div className={`px-2 py-1 rounded-lg inline-block ${item.status === 'SHIPPED' ? 'bg-gray-100 text-gray-400' : aging.color}`}>
                            <span className="font-black text-sm block">{item.status === 'SHIPPED' ? '-' : `${aging.days} Hari`}</span>
                            <span className="text-[10px] uppercase font-bold">{item.status === 'SHIPPED' ? 'SELESAI' : `Level ${aging.level}`}</span>
                          </div>
                        </td>
                      <td className="p-4 text-center">
                        {item.photoUrl ? (
                          <button 
                            onClick={() => setSelectedImage(item.photoUrl)} 
                            className="hover:scale-110 transition border border-gray-200 rounded p-1 bg-white shadow-sm"
                            title="Lihat Foto"
                          >
                            <img 
                              src={item.photoUrl} 
                              alt="Foto Paket" 
                              className="w-10 h-10 object-cover rounded-sm" 
                            />
                          </button>
                        ) : (
                          <span className="text-xs text-gray-300 italic">Kosong</span>
                        )}
                      </td>
                        <td className="p-4 text-center">
                          <button onClick={() => setPrintData({ packageId: item.packageId, namaPaket: item.namaPaket, ekspedisi: item.namaEkspedisi, beratFinal: item.beratFinal, beratAktual: item.beratAktual, beratVol: item.beratVolumetrik, tujuan: item.tujuan })} className="bg-gray-800 text-white p-2 rounded-lg text-xs font-bold hover:bg-black">🖨️ Cetak</button>
                        </td>
                      </tr>
                    )})}
                  </tbody>
                </table>
              </div>

              {/* Tombol Cetak Massal Melayang (Hanya muncul jika ada yang dicentang) */}
              {selectedItems.length > 0 && (
                <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-6 py-4 rounded-2xl shadow-2xl z-50 flex items-center gap-6 animate-bounce-subtle">
                  <span className="font-bold">{selectedItems.length} Barang terpilih</span>
                  <button 
                    onClick={handleBulkPrint}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-bold transition flex items-center gap-2"
                  >
                    🖨️ Cetak Resi Massal
                  </button>
                  <button onClick={() => setSelectedItems([])} className="text-gray-400 hover:text-white text-sm">Batal</button>
                </div>
              )}
            </div>
          )}

        </main>
      </div>
    </AuthGuard>
  );
}