import React, { useState, useEffect } from "react";
import {
  FiBell, FiAlertCircle, FiPackage, FiCheck, FiTrash2, FiRefreshCw,
} from "react-icons/fi";
import {
  petshopNotificationsAPI,
  petshopPharmacyMedicinesAPI,
} from "../../../services/api";

export default function ShopPharmacyNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      // Fetch from petshop notifications API
      const [notifRes, medsRes] = await Promise.all([
        petshopNotificationsAPI.getAll({ portal: "shop" }),
        petshopPharmacyMedicinesAPI.getAll(),
      ]);

      const storedNotifs = notifRes.data || [];
      const medicines = medsRes.data || [];

      // Generate auto-notifications from medicine stock
      const autoNotifs = [];
      medicines.forEach((med) => {
        if ((med.quantity || 0) <= 0) {
          autoNotifs.push({
            _id: `auto-oos-${med._id}`,
            type: "stock",
            severity: "critical",
            title: "Out of Stock",
            message: `${med.medicineName || med.name} is out of stock`,
            isRead: false,
            createdAt: new Date().toISOString(),
            auto: true,
          });
        } else if ((med.quantity || 0) <= (med.lowStockThreshold || 10)) {
          autoNotifs.push({
            _id: `auto-low-${med._id}`,
            type: "stock",
            severity: "warning",
            title: "Low Stock",
            message: `${med.medicineName || med.name} has only ${med.quantity} units left`,
            isRead: false,
            createdAt: new Date().toISOString(),
            auto: true,
          });
        }
        if (med.expiryDate) {
          const daysToExpiry = Math.ceil((new Date(med.expiryDate) - new Date()) / (1000 * 60 * 60 * 24));
          if (daysToExpiry <= 0) {
            autoNotifs.push({
              _id: `auto-exp-${med._id}`,
              type: "expiry",
              severity: "critical",
              title: "Expired",
              message: `${med.medicineName || med.name} has expired`,
              isRead: false,
              createdAt: new Date().toISOString(),
              auto: true,
            });
          } else if (daysToExpiry <= 30) {
            autoNotifs.push({
              _id: `auto-expiring-${med._id}`,
              type: "expiry",
              severity: "warning",
              title: "Expiring Soon",
              message: `${med.medicineName || med.name} expires in ${daysToExpiry} days`,
              isRead: false,
              createdAt: new Date().toISOString(),
              auto: true,
            });
          }
        }
      });

      setNotifications([...storedNotifs, ...autoNotifs]);
    } catch (err) {
      console.error("Error fetching notifications:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkRead = async (notif) => {
    if (notif.auto) return;
    try {
      await petshopNotificationsAPI.markRead(notif._id);
      setNotifications((prev) => prev.map((n) => n._id === notif._id ? { ...n, isRead: true } : n));
    } catch (err) {
      console.error("Error marking read:", err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await petshopNotificationsAPI.markAllRead("shop");
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (err) {
      console.error("Error marking all read:", err);
    }
  };

  const handleDelete = async (notif) => {
    if (notif.auto) return;
    try {
      await petshopNotificationsAPI.delete(notif._id);
      setNotifications((prev) => prev.filter((n) => n._id !== notif._id));
    } catch (err) {
      console.error("Error deleting notification:", err);
    }
  };

  const filtered = filter === "all" ? notifications
    : filter === "unread" ? notifications.filter((n) => !n.isRead)
    : notifications.filter((n) => n.type === filter);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const severityColor = (severity) => {
    if (severity === "critical") return "bg-red-100 text-red-700 border-red-200";
    if (severity === "warning") return "bg-yellow-100 text-yellow-700 border-yellow-200";
    return "bg-blue-100 text-blue-700 border-blue-200";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Notifications</h1>
          <p className="text-slate-500 text-sm mt-1">
            {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? "s" : ""}` : "All caught up"}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleMarkAllRead} className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm hover:bg-slate-50">
            <FiCheck className="w-4 h-4" /> Mark All Read
          </button>
          <button onClick={fetchNotifications} className="flex items-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700">
            <FiRefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        {["all", "unread", "stock", "expiry"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${filter === f ? "bg-purple-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Notifications List */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <FiBell className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No notifications</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((notif) => (
            <div
              key={notif._id}
              className={`bg-white rounded-xl border p-4 flex items-start gap-4 transition-all ${notif.isRead ? "opacity-60" : ""} ${severityColor(notif.severity)}`}
            >
              <div className="flex-shrink-0 mt-0.5">
                {notif.type === "stock" ? <FiPackage className="w-5 h-5" /> : <FiAlertCircle className="w-5 h-5" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-sm">{notif.title}</p>
                  {!notif.isRead && <span className="w-2 h-2 bg-purple-600 rounded-full flex-shrink-0" />}
                </div>
                <p className="text-sm mt-0.5">{notif.message}</p>
                <p className="text-xs opacity-70 mt-1">{notif.createdAt ? new Date(notif.createdAt).toLocaleString() : ""}</p>
              </div>
              {!notif.auto && (
                <div className="flex items-center gap-1 flex-shrink-0">
                  {!notif.isRead && (
                    <button onClick={() => handleMarkRead(notif)} className="p-1.5 hover:bg-white/50 rounded" title="Mark read">
                      <FiCheck className="w-4 h-4" />
                    </button>
                  )}
                  <button onClick={() => handleDelete(notif)} className="p-1.5 hover:bg-white/50 rounded" title="Delete">
                    <FiTrash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
