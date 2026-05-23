import React, { useEffect, useState } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import {
  FiHome,
  FiPackage,
  FiShoppingCart,
  FiFileText,
  FiMenu,
  FiLogOut,
  FiUsers,
  FiSettings,
  FiGrid,
  FiCreditCard,
  FiCornerUpLeft,
  FiBell,
  FiActivity,
  FiTrendingDown,
} from "react-icons/fi";
import { MdLocalPharmacy } from "react-icons/md";
import { useSettings } from "../context/SettingsContext";
import DaySessionBanner from "../components/DaySessionBanner";

export default function ShopPharmacyLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const context = (function () {
    try {
      return useSettings();
    } catch (e) {
      console.warn("ShopPharmacyLayout: useSettings failed", e);
      return null;
    }
  })();

  const settings = context?.settings || {
    companyName: "Abbottabad Pet Hospital",
    companyLogo: null,
  };

  const shopUser = JSON.parse(localStorage.getItem("shop_auth") || "{}");

  useEffect(() => {
    if (!shopUser?.username) {
      navigate("/shop/login", { replace: true });
    }
  }, [navigate, shopUser?.username]);

  if (!context) {
    return (
      <div className="flex flex-col h-screen bg-slate-50">
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur border-b border-slate-200">
          <div className="px-3 md:px-5 py-2">
            <div className="h-12 w-full rounded-full border border-purple-100 bg-purple-50/60 shadow-sm flex items-center justify-center">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-600"></div>
            </div>
          </div>
        </header>
        <main className="flex-1 flex items-center justify-center">
          <p className="text-slate-500 font-medium">
            Initializing Petshop Pharmacy...
          </p>
        </main>
      </div>
    );
  }

  if (!shopUser?.username) return null;

  const isAdmin = shopUser.role?.toLowerCase() === "admin";
  const hasAccess =
    isAdmin ||
    (Array.isArray(shopUser.portalAccess) &&
      shopUser.portalAccess
        .map((p) => String(p).toLowerCase())
        .includes("shop"));

  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="text-center p-8 bg-white rounded-2xl shadow-lg border border-red-100">
          <div className="h-16 w-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <MdLocalPharmacy className="h-8 w-8 text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">
            Access Denied
          </h2>
          <p className="text-slate-600">
            You don't have access to the Shop Portal.
          </p>
          <p className="text-sm text-slate-500 mt-2">
            Contact your administrator to request access.
          </p>
          <button
            onClick={() => navigate("/")}
            className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  const menuGroups = [
    {
      title: "Dashboard",
      items: [
        {
          path: "/shop/pharmacy",
          icon: FiHome,
          label: "Dashboard",
          exact: true,
          id: "dashboard",
        },
      ],
    },
    {
      title: "POS",
      items: [
        {
          path: "/shop/pharmacy/pos",
          icon: FiShoppingCart,
          label: "Point of Sale",
          id: "pos",
        },
        {
          path: "/shop/pharmacy/credit-customers",
          icon: FiCreditCard,
          label: "Credit Customers",
          id: "credit-customers",
        },
      ],
    },
    {
      title: "Inventory",
      items: [
        {
          path: "/shop/pharmacy/medicines",
          icon: FiPackage,
          label: "Inventory",
          id: "medicines",
        },
        {
          path: "/shop/pharmacy/suppliers",
          icon: FiUsers,
          label: "Suppliers",
          id: "suppliers",
        },
        {
          path: "/shop/pharmacy/companies",
          icon: FiGrid,
          label: "Companies",
          id: "companies",
        },
        {
          path: "/shop/pharmacy/purchase-orders",
          icon: FiFileText,
          label: "Purchase Orders",
          id: "purchase-orders",
        },
      ],
    },
    {
      title: "History",
      items: [
        {
          path: "/shop/pharmacy/sales-history",
          icon: FiFileText,
          label: "Sales History",
          id: "sales-history",
        },
        {
          path: "/shop/pharmacy/purchase-history",
          icon: FiFileText,
          label: "Purchase History",
          id: "purchase-history",
        },
        {
          path: "/shop/pharmacy/return-history",
          icon: FiFileText,
          label: "Return History",
          id: "return-history",
        },
      ],
    },
    {
      title: "Return",
      items: [
        {
          path: "/shop/pharmacy/sales-return",
          icon: FiCornerUpLeft,
          label: "Sales Return",
          id: "sales-return",
        },
        {
          path: "/shop/pharmacy/supplier-returns",
          icon: FiFileText,
          label: "Supplier Returns",
          id: "supplier-returns",
        },
      ],
    },
    {
      title: "Referral",
      items: [
        {
          path: "/shop/pharmacy/referrals",
          icon: FiFileText,
          label: "Referrals",
          id: "referrals",
        },
        {
          path: "/shop/pharmacy/prescriptions",
          icon: FiFileText,
          label: "Prescriptions",
          id: "prescriptions",
        },
      ],
    },
    {
      title: "Other",
      items: [
        {
          path: "/shop/pharmacy/add-invoice",
          icon: FiFileText,
          label: "Add Invoice",
          id: "add-invoice",
        },
        {
          path: "/shop/pharmacy/reports",
          icon: FiFileText,
          label: "Reports",
          id: "reports",
        },
        {
          path: "/shop/pharmacy/notifications",
          icon: FiBell,
          label: "Notifications",
          id: "notifications",
        },
        {
          path: "/shop/pharmacy/audit-logs",
          icon: FiActivity,
          label: "Audit Logs",
          id: "audit-logs",
        },
        {
          path: "/shop/pharmacy/expenses",
          icon: FiTrendingDown,
          label: "Expenses",
          id: "expenses",
        },
        {
          path: "/shop/pharmacy/settings",
          icon: FiSettings,
          label: "Settings",
          id: "settings",
        },
      ],
    },
  ];

  const isActive = (path, exact = false) => {
    if (exact) return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  const handleLogout = () => {
    localStorage.removeItem("shop_auth");
    localStorage.removeItem("portal");
    navigate("/shop/login");
  };

  const handleToggle = () => {
    const isDesktop =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(min-width: 768px)").matches;
    if (isDesktop) setSidebarOpen((v) => !v);
    else setMobileMenuOpen((v) => !v);
  };

  const filteredMenuGroups = menuGroups;

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur border-b border-slate-200">
        <div className="px-3 md:px-5 py-2">
          <div className="h-12 w-full rounded-full border border-purple-100 bg-purple-50/60 shadow-sm flex items-center justify-between px-2">
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
                {settings.companyLogo ? (
                  <img
                    src={settings.companyLogo}
                    alt="Logo"
                    className="h-7 w-7 rounded-md object-contain ring-1 ring-slate-200"
                  />
                ) : (
                  <MdLocalPharmacy className="h-7 w-7 text-purple-600" />
                )}
                <div className="text-sm md:text-base font-semibold tracking-wide text-slate-800 truncate">
                  {settings.companyName || "Abbottabad Pet Hospital"}
                  <span className="ml-2 text-xs font-medium text-purple-600 align-middle">
                    Petshop Pharmacy
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 pr-2">
              <div className="text-sm text-slate-600 hidden md:block">
                Welcome{" "}
                <span className="font-bold text-slate-900">
                  {shopUser.username}
                </span>
                <span className="mx-1">-</span>
                <span className="capitalize text-purple-600 font-medium">
                  {shopUser.role}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        <aside
          className={`
          ${sidebarOpen ? "w-56" : "w-20"} 
          ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
          fixed md:relative z-50 md:z-auto
          bg-white border-r border-slate-200 
          transition-all duration-300 
          flex flex-col h-full
          group/sidebar
        `}
        >
          <nav className="flex-1 py-4 overflow-y-auto custom-sidebar-scrollbar">
            {filteredMenuGroups.length === 0 ? (
              <div className="p-6 text-center">
                <div className="h-12 w-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <FiSettings className="h-6 w-6 text-slate-400" />
                </div>
                <p className="text-sm text-slate-500 font-medium">
                  No pages available
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Contact administrator for access
                </p>
              </div>
            ) : (
              filteredMenuGroups.map((group, groupIdx) => (
                <div
                  key={group.title}
                  className={`${groupIdx !== 0 ? "mt-6" : ""}`}
                >
                  {sidebarOpen && (
                    <div className="px-6 mb-2">
                      <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.1em]">
                        {group.title}
                      </h3>
                    </div>
                  )}
                  <div className="px-3 space-y-1">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const active = isActive(item.path, item.exact);

                      return (
                        <Link
                          key={item.path}
                          to={item.path}
                          onClick={() => setMobileMenuOpen(false)}
                          className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all ${
                            active
                              ? "bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-md shadow-purple-100"
                              : "text-slate-600 hover:bg-slate-50 hover:text-purple-600"
                          }`}
                          title={!sidebarOpen ? item.label : ""}
                        >
                          <div
                            className={`flex items-center justify-center ${
                              !sidebarOpen && "mx-auto"
                            }`}
                          >
                            <Icon
                              className={`${
                                active
                                  ? "w-5 h-5"
                                  : "w-5 h-5 text-slate-400 group-hover/sidebar:text-purple-500"
                              }`}
                              strokeWidth={active ? 2.5 : 2}
                            />
                          </div>
                          {sidebarOpen && (
                            <span
                              className={`text-[13px] ${
                                active ? "font-bold" : "font-semibold"
                              }`}
                            >
                              {item.label}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))
            )}

            <div className="px-3 mt-8 pb-4">
              <button
                onClick={handleLogout}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-red-600 hover:bg-red-50 transition-all border border-transparent hover:border-red-100 ${
                  !sidebarOpen ? "justify-center" : ""
                }`}
                title={!sidebarOpen ? "Logout" : ""}
              >
                <FiLogOut className="w-5 h-5" />
                {sidebarOpen && (
                  <span className="text-[13px] font-bold">Logout</span>
                )}
              </button>
            </div>
          </nav>
        </aside>

        <main className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
          <div className="p-4 md:p-6 w-full min-w-0">
            <DaySessionBanner
              portal="shop"
              userName={shopUser.name || "Shop Staff"}
            />
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
