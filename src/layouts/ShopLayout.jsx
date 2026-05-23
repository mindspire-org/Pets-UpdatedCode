import React, { useEffect, useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  FiHome, FiPackage, FiShoppingCart, FiTruck, FiBarChart2, 
  FiMenu, FiX, FiLogOut, FiSettings, FiXCircle, FiUsers, FiCreditCard, FiFileText 
} from 'react-icons/fi';
import { useSettings } from '../context/SettingsContext';
import DaySessionBanner from '../components/DaySessionBanner';

export default function ShopLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { settings } = useSettings();

  const shopUser = JSON.parse(localStorage.getItem('shop_auth') || '{}');

  useEffect(() => {
    if (!shopUser?.username) {
      navigate('/shop/login', { replace: true })
    }
  }, [navigate, shopUser?.username])

  if (!shopUser?.username) return null;

  const isAdmin = shopUser.role?.toLowerCase() === 'admin'
  const hasAccess = isAdmin || (Array.isArray(shopUser.portalAccess) && shopUser.portalAccess.map(p => String(p).toLowerCase()).includes('shop'))

  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="text-center p-8 bg-white rounded-2xl shadow-lg border border-red-100">
          <div className="h-16 w-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FiXCircle className="h-8 w-8 text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Access Denied</h2>
          <p className="text-slate-600">You don't have access to the Shop Portal.</p>
          <p className="text-sm text-slate-500 mt-2">Contact your administrator to request access.</p>
          <button
            onClick={() => navigate('/')}
            className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Return to Home
          </button>
        </div>
      </div>
    )
  }

  const menuItems = [
    { path: '/shop', icon: FiHome, label: 'Dashboard', exact: true },
    { path: '/shop/inventory', icon: FiPackage, label: 'Inventory' },
    { path: '/shop/pos', icon: FiShoppingCart, label: 'Point of Sale' },
    { path: '/shop/sales-history', icon: FiFileText, label: 'Sales History' },
    { path: '/shop/purchase-history', icon: FiFileText, label: 'Purchase History' },
    { path: '/shop/sales-return', icon: FiFileText, label: 'Sales Return' },
    { path: '/shop/supplier-returns', icon: FiFileText, label: 'Supplier Returns' },
    { path: '/shop/return-history', icon: FiFileText, label: 'Return History' },
    { path: '/shop/notifications', icon: FiFileText, label: 'Notifications' },
    { path: '/shop/suppliers', icon: FiTruck, label: 'Suppliers' },
    { path: '/shop/companies', icon: FiUsers, label: 'Companies' },
    { path: '/shop/credit-customers', icon: FiCreditCard, label: 'Credit Customers' },
    { path: '/shop/reports', icon: FiBarChart2, label: 'Sales Reports' },
    { path: '/shop/settings', icon: FiSettings, label: 'Settings' },
  ];

  const isActive = (path, exact = false) => {
    if (exact) {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  const handleLogout = () => {
    localStorage.removeItem('shop_auth');
    localStorage.removeItem('portal');
    navigate('/shop/login');
  };

  const handleToggle = () => {
    const isDesktop = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(min-width: 768px)').matches;
    if (isDesktop) {
      setSidebarOpen(v => !v);
    } else {
      setMobileMenuOpen(v => !v);
    }
  };

  const filteredMenuItems = menuItems;

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur border-b border-slate-200">
        <div className="px-3 md:px-5 py-2">
          <div className="h-12 w-full rounded-full border border-blue-100 bg-blue-50/60 shadow-sm flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
              <button
                onClick={handleToggle}
                className="inline-flex items-center justify-center h-9 w-9 rounded-full bg-white text-slate-600 hover:text-slate-800 border border-slate-200"
                aria-label="Toggle sidebar"
              >
                <FiMenu className="h-5 w-5" />
              </button>
              <div className="hidden sm:block h-6 w-px bg-slate-200/70" />
              <div className="min-w-0 flex items-center gap-2">
                {settings.companyLogo && (
                  <img src={settings.companyLogo} alt="Logo" className="h-7 w-7 rounded-md object-contain ring-1 ring-slate-200" />
                )}
                <div className="text-sm md:text-base font-semibold tracking-wide text-slate-800 truncate">
                  {settings.companyName || 'Abbottabad Pet Hospital'}
                  <span className="ml-2 text-xs font-medium text-blue-600 align-middle">
                    Shop Portal • {shopUser.name || shopUser.username || 'Shop User'}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-sm text-slate-600 hidden md:block">Welcome</div>
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs rounded-full transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Mobile Overlay */}
        {mobileMenuOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside className={`
          ${sidebarOpen ? 'w-64' : 'w-20'} 
          ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          fixed md:relative z-50 md:z-auto
          bg-white border-r border-slate-200 
          transition-all duration-300 
          flex flex-col h-full
        `}>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {filteredMenuItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path, item.exact);
            
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all ${
                  active
                    ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
                title={!sidebarOpen ? item.label : ''}
              >
                <div className={`flex items-center justify-center ${!sidebarOpen && 'mx-auto'}`}>
                  <Icon className="w-6 h-6" strokeWidth={2} />
                </div>
                {sidebarOpen && <span className="text-sm font-medium">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 space-y-2">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-red-600 hover:bg-red-50 w-full transition-colors"
            title={!sidebarOpen ? 'Logout' : ''}
          >
            <FiLogOut className={`w-5 h-5 ${!sidebarOpen && 'mx-auto'}`} />
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 md:p-6 w-full min-w-0">
            <DaySessionBanner portal="shop" userName={(JSON.parse(localStorage.getItem('shop_auth')||'{}').name)||'Shop User'} />
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
