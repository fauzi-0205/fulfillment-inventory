"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import Link from 'next/link';
import { Package, Mail, Lock, ArrowRight, Eye, EyeOff, ShieldCheck, Zap } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const userEmail = userCredential.user.email;

      const q = query(collection(db, "users"), where("email", "==", userEmail));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        throw new Error("Akun ditemukan, tapi role tidak terdaftar di database.");
      }

      querySnapshot.forEach((doc) => {
        const userData = doc.data();
        
        // ===== LOGIKA ROUTING BARU =====
        if (userData.role === 'SUPER_ADMIN') {
          router.push('/superadmin'); // <--- TAMBAHKAN BARIS INI
        } else if (userData.role === 'ADMIN') {
          router.push('/admin');
        } else if (userData.role === 'CUSTOMER') {
          router.push('/customer');
        } else if (userData.role === 'FULFILLMENT') {
          router.push('/fulfillment/admin');
        } else if (userData.role === 'FULFILLMENT_MANAGER') {
          router.push('/fulfillment/manager');
        } else {
          throw new Error("Role tidak valid.");
        }
        // ===============================
      });

    } catch (error) {
      console.error(error);
      setErrorMsg("Gagal login. Periksa kembali email dan password Anda.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <style jsx global>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes slideInLeft {
          from {
            opacity: 0;
            transform: translateX(-50px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes slideInRight {
          from {
            opacity: 0;
            transform: translateX(50px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(5deg); }
        }

        @keyframes pulseGlow {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.6; }
        }

        @keyframes shimmer {
          0% { background-position: -1000px 0; }
          100% { background-position: 1000px 0; }
        }

        .animate-fade-in-up {
          animation: fadeInUp 0.8s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }

        .animate-slide-left {
          animation: slideInLeft 0.8s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }

        .animate-slide-right {
          animation: slideInRight 0.8s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }

        .animate-float {
          animation: float 6s ease-in-out infinite;
        }

        .animate-float-delayed {
          animation: float 6s ease-in-out infinite 2s;
        }

        .animate-pulse-glow {
          animation: pulseGlow 4s ease-in-out infinite;
        }

        .shimmer-bg {
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
          background-size: 1000px 100%;
          animation: shimmer 2s infinite;
        }
      `}</style>

      {/* Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse-glow"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse-glow" style={{ animationDelay: "2s" }}></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-r from-purple-600/5 to-blue-600/5 rounded-full blur-3xl"></div>
        
        {/* Floating Icons */}
        <div className="absolute top-[15%] left-[5%] animate-float opacity-30">
          <Package className="w-16 h-16 text-purple-400" />
        </div>
        <div className="absolute bottom-[15%] right-[5%] animate-float-delayed opacity-30">
          <ShieldCheck className="w-12 h-12 text-blue-400" />
        </div>
        <div className="absolute top-[40%] right-[10%] animate-float opacity-20">
          <Zap className="w-8 h-8 text-yellow-400" />
        </div>
      </div>

      {/* Back to Home Link */}
      <Link 
        href="/" 
        className="fixed top-6 left-6 z-50 flex items-center gap-2 text-white/70 hover:text-white transition-all duration-300 group bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full border border-white/20"
      >
        <ArrowRight className="w-4 h-4 group-hover:-translate-x-1 transition-transform rotate-180" />
        <span className="text-sm">Kembali ke Beranda</span>
      </Link>

      <div className="w-full max-w-5xl mx-auto grid md:grid-cols-2 gap-8 relative z-10">
        {/* Left Side - Branding */}
        <div className="hidden md:flex flex-col justify-center text-white animate-slide-left">
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl flex items-center justify-center shadow-lg">
                <Package className="w-7 h-7 text-white" />
              </div>
              <span className="text-2xl font-bold">Fulfillment<span className="text-purple-400">.id</span></span>
            </div>
            <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-white via-purple-200 to-blue-200 bg-clip-text text-transparent">
              Selamat Datang<br />Kembali!
            </h1>
            <p className="text-gray-300 text-lg leading-relaxed">
              Akses dashboard Anda dan kelola<br />
              logistik dengan lebih mudah dan cepat.
            </p>
          </div>

          {/* Feature List */}
          <div className="space-y-4 mt-8">
            {[
              { icon: ShieldCheck, text: "Keamanan enterprise-grade terenkripsi" },
              { icon: Zap, text: "Akses real-time ke semua fitur" },
              { icon: Package, text: "Manajemen inventory multi-tenant" }
            ].map((feature, idx) => (
              <div key={idx} className="flex items-center gap-3 text-gray-300">
                <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center">
                  <feature.icon className="w-4 h-4 text-purple-400" />
                </div>
                <span className="text-sm">{feature.text}</span>
              </div>
            ))}
          </div>

          {/* Stats */}
          <div className="mt-12 pt-8 border-t border-white/10">
            <div className="flex gap-8">
              <div>
                <div className="text-2xl font-bold text-white">99.9%</div>
                <div className="text-xs text-gray-400">Uptime</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-white">500+</div>
                <div className="text-xs text-gray-400">Klien Aktif</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-white">24/7</div>
                <div className="text-xs text-gray-400">Support</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Login Form */}
        <div className="animate-slide-right">
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 shadow-2xl p-8">
            <div className="text-center mb-8">
              <div className="md:hidden flex justify-center mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl flex items-center justify-center">
                  <Package className="w-6 h-6 text-white" />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Masuk ke Akun</h2>
              <p className="text-gray-400 text-sm">Masukkan kredensial Anda untuk melanjutkan</p>
            </div>

            {errorMsg && (
              <div className="bg-red-500/20 border border-red-500/50 text-red-200 p-3 rounded-lg text-sm mb-6 text-center backdrop-blur-sm">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-6">
              {/* Email Field */}
              <div className="relative">
                <label className="block text-sm font-medium text-gray-300 mb-2">Alamat Email</label>
                <div className={`relative transition-all duration-300 ${emailFocused ? 'transform scale-[1.02]' : ''}`}>
                  <Mail className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors duration-300 ${emailFocused ? 'text-purple-400' : 'text-gray-500'}`} />
                  <input 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onFocus={() => setEmailFocused(true)}
                    onBlur={() => setEmailFocused(false)}
                    required
                    className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/20 rounded-xl focus:outline-none focus:border-purple-500 text-white placeholder-gray-500 transition-all duration-300"
                    placeholder="nama@perusahaan.com"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="relative">
                <label className="block text-sm font-medium text-gray-300 mb-2">Kata Sandi</label>
                <div className={`relative transition-all duration-300 ${passwordFocused ? 'transform scale-[1.02]' : ''}`}>
                  <Lock className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors duration-300 ${passwordFocused ? 'text-purple-400' : 'text-gray-500'}`} />
                  <input 
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setPasswordFocused(true)}
                    onBlur={() => setPasswordFocused(false)}
                    required
                    className="w-full pl-10 pr-12 py-3 bg-white/5 border border-white/20 rounded-xl focus:outline-none focus:border-purple-500 text-white placeholder-gray-500 transition-all duration-300"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-purple-400 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button 
                type="submit" 
                disabled={isLoading}
                className="group relative w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold py-3 px-4 rounded-xl hover:from-purple-700 hover:to-blue-700 transition-all duration-300 disabled:opacity-70 disabled:cursor-not-allowed overflow-hidden"
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {isLoading ? (
                    <>
                      <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Memverifikasi...
                    </>
                  ) : (
                    <>
                      Masuk ke Dashboard
                      <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </span>
                {!isLoading && (
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                )}
              </button>
            </form>

          
          </div>
        </div>
      </div>

      {/* Footer Note */}
      <div className="fixed bottom-4 left-0 right-0 text-center text-xs text-gray-500">
        © 2024 Fulfillment.id | Sistem Manajemen Logistik Terintegrasi
      </div>
    </div>
  );
}