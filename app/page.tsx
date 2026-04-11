"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import {
  Package,
  ShieldCheck,
  Truck,
  ArrowRight,
  BarChart3,
  Users2,
  Zap,
  Clock,
  Globe,
  ChevronDown,
  Star,
  CheckCircle,
} from "lucide-react";

export default function LandingPage() {
  const heroRef = useRef(null);
  const featuresRef = useRef(null);
  const statsRef = useRef(null);
  const ctaRef = useRef(null);

  useEffect(() => {
    const observerOptions = {
      threshold: 0.1,
      rootMargin: "0px 0px -100px 0px",
    };

    const fadeInUpObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("animate-fade-in-up");
          fadeInUpObserver.unobserve(entry.target);
        }
      });
    }, observerOptions);

    const scaleInObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("animate-scale-in");
          scaleInObserver.unobserve(entry.target);
        }
      });
    }, observerOptions);

    // Observe all elements with animation classes
    document.querySelectorAll(".fade-up-item").forEach((el) => {
      fadeInUpObserver.observe(el);
    });

    document.querySelectorAll(".scale-item").forEach((el) => {
      scaleInObserver.observe(el);
    });

    return () => {
      fadeInUpObserver.disconnect();
      scaleInObserver.disconnect();
    };
  }, []);

  const scrollToSection = (ref) => {
    ref.current?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 overflow-x-hidden">
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

        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: scale(0.9);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }

        @keyframes float-delayed {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-15px); }
        }

        @keyframes pulse-glow {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.6; }
        }

        .animate-fade-in-up {
          animation: fadeInUp 0.8s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }

        .animate-scale-in {
          animation: scaleIn 0.6s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }

        .animate-float {
          animation: float 6s ease-in-out infinite;
        }

        .animate-float-delayed {
          animation: float-delayed 6s ease-in-out infinite 2s;
        }

        .animate-pulse-glow {
          animation: pulse-glow 4s ease-in-out infinite;
        }

        .fade-up-item, .scale-item {
          opacity: 0;
        }

        /* Custom scrollbar */
        ::-webkit-scrollbar {
          width: 8px;
        }

        ::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
        }

        ::-webkit-scrollbar-thumb {
          background: rgba(139, 92, 246, 0.5);
          border-radius: 10px;
        }

        ::-webkit-scrollbar-thumb:hover {
          background: rgba(139, 92, 246, 0.8);
        }
      `}</style>

      {/* Background装饰元素 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse-glow"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse-glow" style={{ animationDelay: "2s" }}></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-r from-purple-600/10 to-blue-600/10 rounded-full blur-3xl"></div>
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-black/20 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 group cursor-pointer">
            <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg flex items-center justify-center">
              <Package className="w-5 h-5 text-white" />
            </div>
            <span className="text-white font-bold text-xl">Fulfillment<span className="text-purple-400">.id</span></span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <button onClick={() => scrollToSection(featuresRef)} className="text-gray-300 hover:text-white transition-colors">Fitur</button>
            <button onClick={() => scrollToSection(statsRef)} className="text-gray-300 hover:text-white transition-colors">Statistik</button>
            <button onClick={() => scrollToSection(ctaRef)} className="text-gray-300 hover:text-white transition-colors">Kontak</button>
          </div>
          <Link href="/login" className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg text-white text-sm font-medium hover:shadow-lg transition-all">
            Masuk
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <div ref={heroRef} className="relative flex flex-col items-center justify-center min-h-screen px-6 pt-20">
        <div className="text-center max-w-4xl mx-auto">
          {/* Floating Icons */}
          <div className="absolute left-[10%] top-[20%] animate-float opacity-50">
            <Package className="w-12 h-12 text-purple-400" />
          </div>
          <div className="absolute right-[10%] top-[30%] animate-float-delayed opacity-50">
            <Truck className="w-10 h-10 text-blue-400" />
          </div>
          <div className="absolute left-[15%] bottom-[25%] animate-float opacity-40">
            <ShieldCheck className="w-8 h-8 text-green-400" />
          </div>

          {/* Badge */}
          <div className="fade-up-item inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 mb-8 border border-white/20">
            <ShieldCheck className="w-4 h-4 text-green-400" />
            <span className="text-sm text-white/90 font-medium">Enterprise Grade Security</span>
          </div>

          {/* Main Title */}
          <h1 className="fade-up-item text-6xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-white via-purple-200 to-blue-200 bg-clip-text text-transparent" style={{ animationDelay: "0.1s" }}>
            Fulfillment Inventory
            <br />
            <span className="text-5xl md:text-6xl">System</span>
          </h1>

          {/* Description */}
          <p className="fade-up-item text-lg md:text-xl text-gray-300 mb-10 max-w-2xl mx-auto leading-relaxed" style={{ animationDelay: "0.2s" }}>
            Platform manajemen logistik cerdas. Pantau barang masuk, kelola stok multi-tenant, 
            dan proses pengiriman secara <span className="text-purple-400 font-semibold">real-time</span> hanya dalam satu pintu.
          </p>

          {/* CTA Buttons */}
          <div className="fade-up-item flex flex-col sm:flex-row gap-4 justify-center" style={{ animationDelay: "0.3s" }}>
            <Link
              href="/login"
              className="group inline-flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white px-8 py-4 rounded-xl font-semibold hover:from-purple-700 hover:to-blue-700 transition-all duration-300 shadow-lg hover:shadow-2xl transform hover:-translate-y-1"
            >
              Masuk ke Sistem
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="/demo"
              className="inline-flex items-center justify-center gap-2 bg-white/10 backdrop-blur-sm border border-white/30 text-white px-8 py-4 rounded-xl font-semibold hover:bg-white/20 transition-all duration-300 hover:scale-105"
            >
              Lihat Demo
              <ChevronDown className="w-5 h-5" />
            </Link>
          </div>

          {/* Scroll Indicator */}
          <div className="fade-up-item absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 cursor-pointer" style={{ animationDelay: "0.4s" }} onClick={() => scrollToSection(featuresRef)}>
            <span className="text-gray-400 text-sm">Scroll untuk eksplorasi</span>
            <ChevronDown className="w-5 h-5 text-gray-400 animate-bounce" />
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div ref={featuresRef} className="relative bg-black/30 backdrop-blur-sm py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">
              Fitur <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">Unggulan</span>
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto text-lg">
              Solusi lengkap untuk kebutuhan logistik modern Anda
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="scale-item group relative bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10 hover:border-purple-500/50 transition-all duration-500 hover:transform hover:-translate-y-3 hover:shadow-2xl">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-600/20 to-blue-600/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="relative">
                <div className="w-14 h-14 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                  <Users2 className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">Multi-Tenant Ready</h3>
                <p className="text-gray-400 leading-relaxed">
                  Data setiap klien aman dan terisolasi secara privat dengan sistem keamanan enterprise-grade.
                </p>
              </div>
            </div>

            {/* Feature 2 */}
            <div className="scale-item group relative bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10 hover:border-purple-500/50 transition-all duration-500 hover:transform hover:-translate-y-3 hover:shadow-2xl" style={{ transitionDelay: "0.1s" }}>
              <div className="absolute inset-0 bg-gradient-to-br from-purple-600/20 to-blue-600/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="relative">
                <div className="w-14 h-14 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                  <Truck className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">Real-Time Tracking</h3>
                <p className="text-gray-400 leading-relaxed">
                  Notifikasi instan untuk setiap permintaan pengiriman barang dengan update status real-time.
                </p>
              </div>
            </div>

            {/* Feature 3 */}
            <div className="scale-item group relative bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10 hover:border-purple-500/50 transition-all duration-500 hover:transform hover:-translate-y-3 hover:shadow-2xl" style={{ transitionDelay: "0.2s" }}>
              <div className="absolute inset-0 bg-gradient-to-br from-purple-600/20 to-blue-600/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="relative">
                <div className="w-14 h-14 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                  <Package className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">Smart Logistics</h3>
                <p className="text-gray-400 leading-relaxed">
                  Terintegrasi dengan bukti foto barang dan cetak resi thermal untuk dokumentasi lengkap.
                </p>
              </div>
            </div>
          </div>

          {/* Additional Feature Highlight */}
          <div className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="fade-up-item bg-gradient-to-r from-purple-600/20 to-blue-600/20 rounded-2xl p-6 border border-purple-500/30 hover:border-purple-500/60 transition-all duration-300">
              <div className="flex items-center gap-3 mb-3">
                <BarChart3 className="w-6 h-6 text-purple-400" />
                <h4 className="text-white font-semibold">Analytics Dashboard</h4>
              </div>
              <p className="text-gray-400 text-sm">
                Pantau performa inventory dengan visualisasi data yang informatif dan mudah dipahami.
              </p>
            </div>
            <div className="fade-up-item bg-gradient-to-r from-purple-600/20 to-blue-600/20 rounded-2xl p-6 border border-purple-500/30 hover:border-purple-500/60 transition-all duration-300" style={{ transitionDelay: "0.1s" }}>
              <div className="flex items-center gap-3 mb-3">
                <ShieldCheck className="w-6 h-6 text-purple-400" />
                <h4 className="text-white font-semibold">Bank-Level Security</h4>
              </div>
              <p className="text-gray-400 text-sm">
                Enkripsi AES-256 dan autentikasi dua faktor untuk keamanan maksimal data Anda.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div ref={statsRef} className="relative py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8">
            <div className="scale-item text-center">
              <div className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent mb-2">99.9%</div>
              <div className="text-sm text-gray-400">Uptime Guarantee</div>
            </div>
            <div className="scale-item text-center" style={{ transitionDelay: "0.1s" }}>
              <div className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent mb-2">500+</div>
              <div className="text-sm text-gray-400">Business Partners</div>
            </div>
            <div className="scale-item text-center" style={{ transitionDelay: "0.2s" }}>
              <div className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent mb-2">24/7</div>
              <div className="text-sm text-gray-400">Support Available</div>
            </div>
            <div className="scale-item text-center" style={{ transitionDelay: "0.3s" }}>
              <div className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent mb-2">10k+</div>
              <div className="text-sm text-gray-400">Orders Processed</div>
            </div>
          </div>
        </div>
      </div>

      {/* Testimonial Section */}
      <div className="relative py-20 px-6 bg-black/20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Yang <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">Klien Kami</span> Katakan
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="fade-up-item bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, j) => (
                    <Star key={j} className="w-4 h-4 fill-purple-500 text-purple-500" />
                  ))}
                </div>
                <p className="text-gray-300 mb-4">
                  "Sistem ini sangat membantu operasional kami. Tracking real-time dan fitur multi-tenant benar-benar game changer!"
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full"></div>
                  <div>
                    <div className="text-white font-semibold text-sm">Andi Wijaya</div>
                    <div className="text-gray-500 text-xs">CEO, Logistik Indonesia</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer CTA */}
      <div ref={ctaRef} className="relative py-24 px-6 text-center">
        <div className="max-w-3xl mx-auto">
          <div className="fade-up-item">
            <h3 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Siap Mengoptimalkan Logistik Anda?
            </h3>
            <p className="text-gray-400 text-lg mb-8">
              Bergabunglah dengan ratusan bisnis yang telah mempercayakan sistem inventory mereka kepada kami
            </p>
            <Link
              href="/register"
              className="group inline-flex items-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white px-8 py-4 rounded-xl font-semibold hover:from-purple-700 hover:to-blue-700 transition-all duration-300 shadow-lg hover:shadow-2xl hover:scale-105"
            >
              Mulai Sekarang Gratis
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative border-t border-white/10 py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg flex items-center justify-center">
              <Package className="w-4 h-4 text-white" />
            </div>
            <span className="text-white text-sm">© 2024 Fulfillment.id. All rights reserved.</span>
          </div>
          <div className="flex gap-6">
            <Link href="#" className="text-gray-400 hover:text-white text-sm transition-colors">Privacy Policy</Link>
            <Link href="#" className="text-gray-400 hover:text-white text-sm transition-colors">Terms of Service</Link>
            <Link href="#" className="text-gray-400 hover:text-white text-sm transition-colors">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}