import React, { useState, useEffect, useRef } from "react";
import {
  FiCalendar, FiDollarSign, FiShoppingCart, FiTrendingUp,
  FiDownload, FiPackage, FiPrinter,
} from "react-icons/fi";
import {
  petshopPharmacySalesAPI,
  petshopPharmacyReportsAPI,
  petshopPharmacyMedicinesAPI,
  settingsAPI,
} from "../../../services/api";
import DateRangePicker from "../../../components/DateRangePicker";

export default function ShopPharmacyReports() {
  const [sales, setSales] = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState({
    startDate: new Date().toISOString().split("T")[0],
    endDate: new Date().toISOString().split("T")[0],
  });
  const [stats, setStats] = useState({
    totalSales: 0, totalRevenue: 0, averageOrderValue: 0,
    totalItems: 0, totalProfit: 0, totalCost: 0, profitMargin: 0,
  });
  const [activeTab, setActiveTab] = useState("sales");
  const [hospitalSettings, setHospitalSettings] = useState(null);

  useEffect(() => {
    settingsAPI.get(JSON.parse(localStorage.getItem("user") || "{}").username || "admin")
      .then((r) => setHospitalSettings(r.data)).catch(() => {});
    fetchData();
  }, [dateRange.startDate, dateRange.endDate]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [salesRes, medsRes] = await Promise.all([
        petshopPharmacySalesAPI.getByDateRange(dateRange.startDate, dateRange.endDate),
        petshopPharmacyMedicinesAPI.getAll(),
      ]);
      const allSales = salesRes.data || [];
      const allMeds = medsRes.data || [];
      setSales(allSales);
      setMedicines(allMeds);

      const totalRevenue = allSales.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
      const totalCost = allSales.reduce((sum, s) =>
        sum + (s.items || []).reduce((iSum, i) => iSum + ((i.purchasePrice || i.buyPerUnit || 0) * (i.quantity || 0)), 0), 0);
      const totalItems = allSales.reduce((sum, s) => sum + (s.items?.length || 0), 0);
      const totalProfit = totalRevenue - totalCost;

      setStats({
        totalSales: allSales.length,
        totalRevenue,
        averageOrderValue: allSales.length > 0 ? totalRevenue / allSales.length : 0,
        totalItems,
        totalProfit,
        totalCost,
        profitMargin: totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0,
      });
    } catch (err) {
      console.error("Error fetching reports:", err);
    } finally {
      setLoading(false);
    }
  };

  const currency = hospitalSettings?.currency || "PKR";

  // Medicine analysis
  const medicineAnalysis = (() => {
    const map = {};
    sales.forEach((sale) => {
      (sale.items || []).forEach((item) => {
        const name = item.medicineName || item.name || "Unknown";
        if (!map[name]) map[name] = { name, qty: 0, revenue: 0 };
        map[name].qty += item.quantity || 0;
        map[name].revenue += (item.totalPrice || item.total || 0);
      });
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  })();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Sales Reports</h1>
          <p className="text-slate-500 text-sm mt-1">Petshop pharmacy analytics and insights</p>
        </div>
      </div>

      {/* Date Range */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <DateRangePicker
          onDateChange={({ fromDate, toDate }) =>
            setDateRange({ startDate: fromDate, endDate: toDate })
          }
          defaultFromDate={dateRange.startDate}
          defaultToDate={dateRange.endDate}
          showAllButton={true}
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Sales", value: stats.totalSales, icon: FiShoppingCart, color: "blue" },
          { label: "Total Revenue", value: `${currency} ${stats.totalRevenue.toLocaleString()}`, icon: FiDollarSign, color: "green" },
          { label: "Total Profit", value: `${currency} ${stats.totalProfit.toLocaleString()}`, icon: FiTrendingUp, color: "purple" },
          { label: "Profit Margin", value: `${stats.profitMargin.toFixed(1)}%`, icon: FiPackage, color: "orange" },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className={`bg-gradient-to-br from-${s.color}-500 to-${s.color}-600 rounded-xl p-5 text-white`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90">{s.label}</p>
                  <p className="text-2xl font-bold mt-1">{s.value}</p>
                </div>
                <Icon className="w-10 h-10 opacity-80" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex border-b border-slate-200">
          {["sales", "medicines"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 text-sm font-medium capitalize transition-colors ${activeTab === tab ? "border-b-2 border-purple-600 text-purple-600" : "text-slate-500 hover:text-slate-700"}`}
            >
              {tab === "sales" ? "Sales Breakdown" : "Top Medicines"}
            </button>
          ))}
        </div>

        <div className="p-4">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
            </div>
          ) : activeTab === "sales" ? (
            sales.length === 0 ? (
              <p className="text-center text-slate-500 py-12">No sales in selected date range</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      {["Invoice #", "Date", "Customer", "Items", "Total", "Payment"].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sales.slice(0, 50).map((sale) => (
                      <tr key={sale._id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-purple-600">{sale.invoiceNumber || "—"}</td>
                        <td className="px-4 py-3 text-slate-600">{sale.createdAt ? new Date(sale.createdAt).toLocaleDateString() : "—"}</td>
                        <td className="px-4 py-3">{sale.customerName || "Walk-in"}</td>
                        <td className="px-4 py-3">{sale.items?.length || 0}</td>
                        <td className="px-4 py-3 font-semibold text-green-600">{currency} {(sale.totalAmount || 0).toLocaleString()}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-700">{sale.paymentMethod || "Cash"}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            medicineAnalysis.length === 0 ? (
              <p className="text-center text-slate-500 py-12">No medicine data available</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      {["#", "Medicine", "Qty Sold", "Revenue"].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {medicineAnalysis.map((med, i) => (
                      <tr key={med.name} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-slate-500">{i + 1}</td>
                        <td className="px-4 py-3 font-medium">{med.name}</td>
                        <td className="px-4 py-3">{med.qty}</td>
                        <td className="px-4 py-3 font-semibold text-green-600">{currency} {med.revenue.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
