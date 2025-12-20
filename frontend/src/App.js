import { useEffect, useState } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { useAuthStore, useUIStore } from "@/store";
import { MessageSquare, LayoutDashboard, Wifi, Calendar, Users, LogOut, Menu, X, Sun, Moon, FileText, History, User, Coins, Shield } from "lucide-react";

// Pages
import LoginPage from "@/pages/LoginPage";
import DashboardPage from "@/pages/DashboardPage";
import ConnectionsPage from "@/pages/ConnectionsPage";
import CampaignsPage from "@/pages/CampaignsPage";
import CreateCampaignPage from "@/pages/CreateCampaignPage";
import EditCampaignPage from "@/pages/EditCampaignPage";
import TemplatesPage from "@/pages/TemplatesPage";
import ProfilePage from "@/pages/ProfilePage";
import AllUsersPage from "@/pages/AllUsersPage";
import ResellersPage from "@/pages/ResellersPage";
import HistoryPage from "@/pages/HistoryPage";

// Theme hook
const useTheme = () => {
  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') || 'dark';
    }
    return 'dark';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  return { theme, toggleTheme };
};

// Protected Route Component
const ProtectedRoute = ({ children, adminOnly = false, masterOrAdmin = false }) => {
  const { isAuthenticated, user, checkAuth } = useAuthStore();
  const [checking, setChecking] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const verify = async () => {
      const valid = await checkAuth();
      if (!valid) {
        navigate('/login');
      }
      setChecking(false);
    };
    verify();
  }, [checkAuth, navigate]);

  if (checking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-primary font-mono text-sm">Carregando...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && user?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  if (masterOrAdmin && user?.role !== 'admin' && user?.role !== 'master') {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

// Layout Component with Responsive Sidebar
const Layout = ({ children }) => {
  const { user, logout } = useAuthStore();
  const { sidebarOpen, setSidebarOpen } = useUIStore();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleNavigation = (path) => {
    navigate(path);
    setSidebarOpen(false);
  };

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/connections', label: 'Conexões', icon: Wifi },
    { path: '/campaigns', label: 'Campanhas', icon: Calendar },
    { path: '/templates', label: 'Templates', icon: FileText },
    { path: '/history', label: 'Histórico', icon: History },
  ];
    { path: '/campaigns', label: 'Campanhas', icon: Calendar },
    { path: '/templates', label: 'Templates', icon: FileText },
  ];

  // Add resellers page for admin and master
  if (user?.role === 'admin' || user?.role === 'master') {
    navItems.push({ path: '/resellers', label: 'Revendedores', icon: Users });
  }

  // Add all users page for admin only
  if (user?.role === 'admin') {
    navItems.push({ path: '/users', label: 'Usuários', icon: Shield });
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-14 glass border-b border-border z-50 flex items-center justify-between px-4 safe-top">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 -ml-2 text-muted-foreground hover:text-foreground"
          data-testid="mobile-menu-btn"
        >
          <Menu className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <MessageSquare className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-heading font-bold text-lg text-foreground">NEXUS</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Credits badge for mobile */}
          {(user?.role === 'admin' || user?.role === 'master') && user?.credits !== undefined && (
            <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-yellow-500/15 text-yellow-500 text-xs font-medium">
              <Coins className="w-3 h-3" />
              {user.credits}
            </div>
          )}
          <button
            onClick={toggleTheme}
            className="p-2 -mr-2 text-muted-foreground hover:text-foreground"
          >
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/60 z-50 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 h-full w-72 glass border-r border-border z-50
        transform transition-transform duration-300 ease-out
        lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-4 lg:p-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center neon-glow">
                <MessageSquare className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="font-heading font-bold text-xl text-foreground">NEXUS</h1>
                <p className="text-[10px] font-mono text-primary uppercase tracking-widest">WhatsApp</p>
              </div>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Credits Badge (Desktop) */}
          {(user?.role === 'admin' || user?.role === 'master') && user?.credits !== undefined && (
            <div className="hidden lg:flex mx-4 mb-2 items-center justify-center gap-2 px-3 py-2 rounded-lg bg-yellow-500/15 text-yellow-500">
              <Coins className="w-4 h-4" />
              <span className="font-medium">{user.credits} créditos</span>
            </div>
          )}

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto no-scrollbar">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <button
                  key={item.path}
                  onClick={() => handleNavigation(item.path)}
                  data-testid={`nav-${item.path.slice(1)}`}
                  className={`
                    w-full flex items-center gap-3 px-4 py-3 rounded-xl
                    transition-all duration-200 touch-target
                    ${isActive 
                      ? 'bg-primary/15 text-primary border border-primary/20' 
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    }
                  `}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" strokeWidth={1.5} />
                  <span className="font-medium">{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Activity Log */}
          <ActivityLog />

          {/* Theme Toggle (Desktop) */}
          <div className="hidden lg:block px-4 pb-2">
            <button
              onClick={toggleTheme}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              {theme === 'dark' ? 'Tema Claro' : 'Tema Escuro'}
            </button>
          </div>

          {/* User Section */}
          <div className="p-4 border-t border-border safe-bottom">
            <button 
              onClick={() => handleNavigation('/profile')}
              className="w-full flex items-center gap-3 mb-3 p-2 -m-2 rounded-lg hover:bg-muted/50 transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
                <span className="font-heading font-bold text-primary uppercase">
                  {user?.username?.[0] || 'U'}
                </span>
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="font-medium text-sm text-foreground truncate">{user?.username}</p>
                <p className="text-xs font-mono text-primary uppercase">
                  {user?.role === 'admin' ? 'Administrador' : user?.role === 'master' ? 'Master' : 'Revendedor'}
                </p>
              </div>
              <User className="w-4 h-4 text-muted-foreground" />
            </button>
            <button
              onClick={handleLogout}
              data-testid="logout-btn"
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors touch-target"
            >
              <LogOut className="w-4 h-4" />
              Sair
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-72 min-h-screen pt-14 lg:pt-0">
        <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};

function App() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Set initial theme
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.classList.add(savedTheme);
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Layout>
                <DashboardPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/connections"
          element={
            <ProtectedRoute>
              <Layout>
                <ConnectionsPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/campaigns"
          element={
            <ProtectedRoute>
              <Layout>
                <CampaignsPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/campaigns/new"
          element={
            <ProtectedRoute>
              <Layout>
                <CreateCampaignPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/campaigns/edit/:id"
          element={
            <ProtectedRoute>
              <Layout>
                <EditCampaignPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/templates"
          element={
            <ProtectedRoute>
              <Layout>
                <TemplatesPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Layout>
                <ProfilePage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/resellers"
          element={
            <ProtectedRoute masterOrAdmin>
              <Layout>
                <ResellersPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/users"
          element={
            <ProtectedRoute adminOnly>
              <Layout>
                <AllUsersPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
      <Toaster richColors position="top-center" />
    </BrowserRouter>
  );
}

export default App;
