import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { ToastProvider } from './context/ToastContext.tsx';
import { Navbar } from './components/Navbar.tsx';
import { LoginPage } from './pages/LoginPage.tsx';
import { DashboardPage } from './pages/DashboardPage.tsx';
import { SecurityScanPage } from './pages/SecurityScanPage.tsx';
import { CreatePassPage } from './pages/CreatePassPage.tsx';
import { CurrentlyInsidePage } from './pages/CurrentlyInsidePage.tsx';
import { PassesListPage } from './pages/PassesListPage.tsx';
import { ReportsPage } from './pages/ReportsPage.tsx';
import { GatesAndAuditPage } from './pages/GatesAndAuditPage.tsx';
import { NextJsProjectHub } from './pages/NextJsProjectHub.tsx';
import { ApprovalDashboardPage } from './pages/ApprovalDashboardPage.tsx';
import { GeminiChatbotModal } from './components/GeminiChatbotModal.tsx';
import { PublicPassView } from './pages/PublicPassView.tsx';
import { PassCardModal } from './components/PassCardModal.tsx';
import { VisitorPass } from './types.ts';
import { Sparkles } from 'lucide-react';

function MainApp() {
  const { user, token, isLoading } = useAuth();

  // Tab State
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [isChatbotOpen, setIsChatbotOpen] = useState<boolean>(false);
  const [selectedPassForBadge, setSelectedPassForBadge] = useState<VisitorPass | null>(null);
  const [insideCount, setInsideCount] = useState<number>(0);
  const [pendingApprovalCount, setPendingApprovalCount] = useState<number>(0);

  // Check URL pathname for public visitor pass link (e.g., /pass/token_xyz or /verify/token_xyz)
  const [publicToken, setPublicToken] = useState<string | null>(() => {
    const path = window.location.pathname;
    if (path.startsWith('/pass/')) {
      return path.replace('/pass/', '');
    }
    if (path.startsWith('/verify/')) {
      return path.replace('/verify/', '');
    }
    return null;
  });

  // Switch initial tab based on role: Security starts directly at QR Scanner!
  useEffect(() => {
    if (user?.role === 'SECURITY') {
      setCurrentTab('scan');
    }
  }, [user?.role]);

  // Live Inside Count & Pending Approvals polling
  const fetchCounts = async () => {
    if (!token) return;
    try {
      const [insideRes, statsRes] = await Promise.all([
        fetch('/api/currently-inside', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/dashboard/stats', { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (insideRes.ok) {
        const insideData = await insideRes.json();
        setInsideCount(insideData.count || 0);
      }
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setPendingApprovalCount(statsData.stats?.pendingApproval || 0);
      }
    } catch {
      // Quiet fail
    }
  };

  useEffect(() => {
    fetchCounts();
    const interval = setInterval(fetchCounts, 10000);
    return () => clearInterval(interval);
  }, [token]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white text-xs">
        <div className="text-center space-y-2">
          <div className="h-8 w-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="font-semibold text-slate-300">Loading FactoryPass System...</p>
        </div>
      </div>
    );
  }

  // Public visitor pass view
  if (publicToken) {
    return (
      <PublicPassView
        tokenOrPass={publicToken}
        onBackToApp={() => {
          setPublicToken(null);
          window.history.pushState({}, '', '/');
        }}
      />
    );
  }

  // If not authenticated, show login page
  if (!user) {
    return <LoginPage />;
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-900 antialiased">
      {/* Top Navbar */}
      <Navbar
        currentTab={currentTab}
        setCurrentTab={(tab) => {
          setCurrentTab(tab);
          fetchCounts();
        }}
        openCreateModal={() => setIsCreateModalOpen(true)}
        insideCount={insideCount}
        pendingApprovalCount={pendingApprovalCount}
        onOpenChatbot={() => setIsChatbotOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 pb-16">
        {currentTab === 'dashboard' && user.role !== 'SECURITY' && (
          <DashboardPage
            onOpenCreate={() => setIsCreateModalOpen(true)}
            onSelectPass={(pass) => setSelectedPassForBadge(pass)}
            onNavigateToScan={() => setCurrentTab('scan')}
            onNavigateToEmergency={() => setCurrentTab('emergency')}
            onNavigateToApprovals={() => setCurrentTab('approvals')}
          />
        )}

        {currentTab === 'scan' && <SecurityScanPage />}

        {currentTab === 'approvals' && (
          <ApprovalDashboardPage
            onSelectPass={(pass) => setSelectedPassForBadge(pass)}
            onRefreshStats={fetchCounts}
          />
        )}

        {currentTab === 'passes' && (
          <PassesListPage
            onSelectPass={(pass) => setSelectedPassForBadge(pass)}
            onOpenCreate={() => setIsCreateModalOpen(true)}
          />
        )}

        {currentTab === 'emergency' && <CurrentlyInsidePage />}

        {currentTab === 'reports' && user.role !== 'SECURITY' && <ReportsPage />}

        {currentTab === 'gates-audit' && user.role === 'ADMIN' && <GatesAndAuditPage />}

        {currentTab === 'nextjs-hub' && <NextJsProjectHub />}
      </main>

      {/* Create Pass Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm p-4 flex items-center justify-center">
          <div className="w-full max-w-4xl max-h-[92vh] overflow-y-auto">
            <CreatePassPage
              onSuccess={(newPass) => {
                setIsCreateModalOpen(false);
                setSelectedPassForBadge(newPass);
                fetchCounts();
              }}
              onCancel={() => setIsCreateModalOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Printable Pass / Mobile Pass Modal */}
      <PassCardModal
        pass={selectedPassForBadge}
        onClose={() => setSelectedPassForBadge(null)}
      />

      {/* Floating Gemini AI Security Co-Pilot Launcher */}
      {!isChatbotOpen && (
        <button
          onClick={() => setIsChatbotOpen(true)}
          className="fixed bottom-5 right-5 z-40 flex items-center gap-2.5 px-4 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl shadow-2xl border border-emerald-500/60 cursor-pointer hover:scale-105 transition-all group"
          title="Ask FactoryGuard AI Co-Pilot"
        >
          <div className="h-8 w-8 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center font-black group-hover:rotate-12 transition">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="text-left hidden sm:block">
            <div className="text-xs font-black text-white flex items-center gap-1.5">
              <span>FactoryGuard AI</span>
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
            </div>
            <div className="text-[10px] text-slate-400">Security Co-Pilot</div>
          </div>
        </button>
      )}

      {/* Gemini AI Multi-Turn Chatbot */}
      <GeminiChatbotModal
        isOpen={isChatbotOpen}
        onClose={() => setIsChatbotOpen(false)}
        contextInfo={{
          insideCount,
          activeTab: currentTab,
          userRole: user?.role,
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <MainApp />
      </AuthProvider>
    </ToastProvider>
  );
}
