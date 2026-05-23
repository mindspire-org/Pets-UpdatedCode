import React, { useState, useEffect } from "react";
import {
  FiBell,
  FiAlertCircle,
  FiPackage,
  FiActivity,
  FiClock,
  FiUser,
  FiInfo,
} from "react-icons/fi";
import { petshopNotificationsAPI } from "../../services/api";

export default function ShopNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setStatusFilter] = useState("all");

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await petshopNotificationsAPI.getAll({
        portal: "shop",
        limit: 500,
        sortOrder: "desc",
      });
      setNotifications(res.data.notifications || []);
    } catch (error) {
      console.error("Error fetching notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  const mapToUi = (note) => {
    const type = note.type;
    let icon = FiBell;
    if (type === "low_stock" || type === "out_of_stock") icon = FiPackage;
    if (type === "expired" || type === "expiring_soon") icon = FiClock;
    if (type === "referral") icon = FiUser;
    if (type === "sale") icon = FiActivity;
    if (type === "return_customer" || type === "return_supplier") icon = FiAlertCircle;

    return {
      id: note._id,
      type: note.type,
      severity: note.severity,
      title: note.title,
      message: note.message,
      icon,
      time: note.createdAt,
    };
  };

  const filteredNotifications =
    filter === "all"
      ? notifications
      : notifications.filter((n) => {
          if (filter === "stock")
            return ["out_of_stock", "low_stock"].includes(n.type);
          if (filter === "expiry")
            return ["expired", "expiring_soon"].includes(n.type);
          if (filter === "referral") return n.type === "referral";
          return true;
        });

  const getSeverityStyles = (severity) => {
    switch (severity) {
      case "high":
        return "bg-red-50 border-red-100 text-red-700";
      case "medium":
        return "bg-amber-50 border-amber-100 text-amber-700";
      case "info":
        return "bg-blue-50 border-blue-100 text-blue-700";
      default:
        return "bg-slate-50 border-slate-100 text-slate-700";
    }
  };

  const getIconStyles = (severity) => {
    switch (severity) {
      case "high":
        return "bg-red-100 text-red-600";
      case "medium":
        return "bg-amber-100 text-amber-600";
      case "info":
        return "bg-blue-100 text-blue-600";
      default:
        return "bg-slate-100 text-slate-600";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
            Shop Notifications
          </h1>
          <p className="text-slate-500 mt-1">
            Monitor sales, returns, and alerts
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchNotifications}
            className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-all flex items-center gap-2"
          >
            <FiActivity className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          { id: "all", label: "All Notifications", icon: FiBell },
          { id: "stock", label: "Stock Alerts", icon: FiPackage },
          { id: "expiry", label: "Expiry Alerts", icon: FiClock },
          { id: "referral", label: "Doctor Referrals", icon: FiUser },
        ].map((btn) => (
          <button
            key={btn.id}
            onClick={() => setStatusFilter(btn.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full font-medium transition-all ${
              filter === btn.id
                ? "bg-purple-600 text-white shadow-md"
                : "bg-white text-slate-600 border border-slate-200 hover:border-purple-300"
            }`}
          >
            <btn.icon className="w-4 h-4" />
            {btn.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden min-h-[400px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32">
            <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-4 text-slate-500 font-medium">Fetching alerts...</p>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
              <FiBell className="w-10 h-10 text-slate-300" />
            </div>
            <p className="text-lg font-bold text-slate-700">
              No notifications found
            </p>
            <p className="text-sm text-slate-500">You're all caught up!</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredNotifications.map(mapToUi).map((note) => (
              <div
                key={note.id}
                className="p-6 transition-all hover:bg-slate-50 group"
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`p-3 rounded-xl shrink-0 ${getIconStyles(
                      note.severity,
                    )}`}
                  >
                    <note.icon className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        {note.title}
                        {note.severity === "high" && (
                          <span className="px-2 py-0.5 bg-red-100 text-red-600 text-[10px] font-black uppercase rounded tracking-widest">
                            Urgent
                          </span>
                        )}
                      </h3>
                      <span className="text-xs text-slate-400 font-medium whitespace-nowrap">
                        {new Date(note.time).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-slate-600 text-sm leading-relaxed mb-3">
                      {note.message}
                    </p>
                    <div className="flex items-center gap-3">
                      <span
                        className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getSeverityStyles(
                          note.severity,
                        )}`}
                      >
                        {String(note.type || "").replace("_", " ")}
                      </span>
                      <button className="text-xs font-bold text-purple-600 hover:text-purple-700 opacity-0 group-hover:opacity-100 transition-opacity">
                        View Details →
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-100 flex items-center gap-4">
        <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-blue-600 shadow-sm shrink-0">
          <FiInfo className="w-6 h-6" />
        </div>
        <div>
          <p className="text-blue-900 font-bold">Pro-tip!</p>
          <p className="text-blue-700 text-sm">
            Notifications are backend-driven and stored in the database.
          </p>
        </div>
      </div>
    </div>
  );
}
