import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiPackage, FiShoppingCart, FiAlertTriangle, FiClock, FiDollarSign, FiTrendingUp, FiFileText, FiCalendar } from 'react-icons/fi';
import { MdLocalPharmacy } from 'react-icons/md';
import { pharmacyMedicinesAPI, pharmacySalesAPI, pharmacyReportsAPI } from '../../services/api';
import ExpenseCard from '../../components/ExpenseCard';
import DateRangePicker from '../../components/DateRangePicker';

export default function PharmacyDashboard({
  basePath = '/pharmacy',
  apis,
} = {}) {
  const medicinesAPI = apis?.medicines || pharmacyMedicinesAPI;
  const salesAPI = apis?.sales || pharmacySalesAPI;
  const reportsAPI = apis?.reports || pharmacyReportsAPI;
  const [stats, setStats] = useState({
    totalMedicines: 0,
    lowStock: 0,
    expiring: 0,
    expired: 0,
    todaySales: 0,
    todayRevenue: 0,
    todayProfit: 0,
    todayCost: 0,
    inventoryValue: 0,
    inventoryCost: 0
  });
  const [recentSales, setRecentSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    fromDate: new Date().toISOString().slice(0,10),
    toDate: new Date().toISOString().slice(0,10)
  });

  useEffect(() => {
    fetchDashboardData();
  }, [dateRange.fromDate, dateRange.toDate]);

  const handleDateRangeChange = (newDateRange) => {
    setDateRange(newDateRange);
  };

  // Date filtering function - uses proper Date comparison to avoid timezone issues
  const isDateInRange = (dateStr) => {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    const start = new Date(dateRange.fromDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(dateRange.toDate);
    end.setHours(23, 59, 59, 999);
    return date >= start && date <= end;
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const today = new Date().toISOString().split('T')[0];
      
      // Fetch data with individual error handling
      let totalMedicines = 0, lowStock = 0, expiring = 0, expired = 0;
      let todaySales = 0, todayRevenue = 0, inventoryValue = 0, inventoryCost = 0;
      let todayCost = 0, todayProfit = 0;
      let sales = [];

      // Get medicines data
      try {
        const medicinesRes = await medicinesAPI.getAll();
        // Handle both { data: [...] } and { data: { data: [...] } } formats
        const medicines = medicinesRes?.data?.data || medicinesRes?.data || [];
        totalMedicines = medicines.length;
        
        // Calculate inventory stats manually
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(today.getDate() + 30);
        thirtyDaysFromNow.setHours(23, 59, 59, 999);
        
        // Calculate total inventory value and cost
        let totalInventoryValue = 0;
        let totalInventoryCost = 0;
        
        medicines.forEach(med => {
          const qty = Number(med.quantity) || 0;
          const purchasePrice = Number(med.purchasePrice) || 0;
          const salePrice = Number(med.salePrice) || 0;
          
          // Inventory value at sale price (potential revenue)
          totalInventoryValue += qty * salePrice;
          // Inventory cost at purchase price (actual investment)
          totalInventoryCost += qty * purchasePrice;
          
          // Low stock check - use minStock if available, fallback to lowStockThreshold, then default 10
          const threshold = med.minStock || med.lowStockThreshold || 10;
          if (qty <= threshold) {
            lowStock++;
          }
          
          // Expiry checks
          if (med.expiryDate) {
            const expiryDate = new Date(med.expiryDate);
            if (expiryDate < today) {
              expired++;
            } else if (expiryDate <= thirtyDaysFromNow) {
              expiring++;
            }
          }
        });
        
        inventoryValue = totalInventoryValue;
        inventoryCost = totalInventoryCost;
      } catch (error) {
        console.error('Error fetching medicines:', error);
      }

      // Get sales data
      try {
        const salesRes = await salesAPI.getAll();
        // Handle both { data: [...] } and { data: { data: [...] } } formats
        sales = salesRes?.data?.data || salesRes?.data || [];
        
        // Show recent 5 sales (unfiltered) for the Recent Sales table
        const sortedSales = sales.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setRecentSales(sortedSales.slice(0, 5));
        
        // Filter sales by date range for stats calculation
        const filteredSales = sales.filter(sale => isDateInRange(sale.createdAt));
        
        todaySales = filteredSales.length;
        todayRevenue = filteredSales.reduce((sum, sale) => sum + (sale.totalAmount || 0), 0);
        
        // Calculate profit and cost for the date range
        todayCost = 0;
        todayProfit = 0;
        
        filteredSales.forEach(sale => {
          // Use stored totalCost if available
          if (sale.totalCost > 0) {
            todayCost += sale.totalCost;
            todayProfit += (sale.totalAmount - sale.totalCost);
            return;
          }
          
          // Otherwise calculate from items
          sale.items?.forEach(item => {
            const qty = Number(item.quantity) || 0;
            const itemRevenue = Number(item.totalPrice) || 0;
            // Use stored purchasePrice from sale item (most accurate for historical data)
            const purchasePrice = Number(item.purchasePrice) || 0;
            const itemCost = qty * purchasePrice;
            
            todayCost += itemCost;
            todayProfit += (itemRevenue - itemCost);
          });
        });
      } catch (error) {
        console.error('Error fetching sales:', error);
      }

      setStats({
        totalMedicines,
        lowStock,
        expiring,
        expired,
        todaySales,
        todayRevenue,
        todayProfit,
        todayCost,
        inventoryValue,
        inventoryCost
      });

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const quickLinks = [
    { name: 'Medicine Inventory', path: `${basePath}/medicines`, icon: FiPackage, color: 'purple', description: 'Manage medicines & stock' },
    { name: 'Point of Sale', path: `${basePath}/pos`, icon: FiShoppingCart, color: 'blue', description: 'Sell medicines' },
    { name: 'Sales Reports', path: `${basePath}/reports`, icon: FiFileText, color: 'green', description: 'View sales analytics' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">
          Pharmacy Dashboard
        </h1>
        <p className="text-slate-600 text-lg">Manage medicines, sales, and inventory</p>
      </div>

      {/* Date Range Picker */}
      <div className="rounded-2xl bg-gradient-to-br from-white via-purple-50 to-blue-50 shadow-xl ring-1 ring-purple-200 border border-purple-100 p-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-600 rounded-xl flex items-center justify-center">
              <FiCalendar className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="text-sm font-semibold text-purple-600">Date Range</div>
              <div className="text-lg font-bold text-slate-800">
                {dateRange.fromDate === dateRange.toDate 
                  ? new Date(dateRange.fromDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
                  : `${new Date(dateRange.fromDate).toLocaleDateString()} - ${new Date(dateRange.toDate).toLocaleDateString()}`
                }
              </div>
            </div>
          </div>
          
          <DateRangePicker 
            onDateChange={handleDateRangeChange}
            defaultFromDate={dateRange.fromDate}
            defaultToDate={dateRange.toDate}
            showAllButton={true}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        </div>
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90">Total Medicines</p>
                  <p className="text-3xl font-bold mt-1">{stats.totalMedicines}</p>
                </div>
                <MdLocalPharmacy className="w-12 h-12 opacity-80" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90">Low Stock</p>
                  <p className="text-3xl font-bold mt-1">{stats.lowStock}</p>
                </div>
                <FiAlertTriangle className="w-12 h-12 opacity-80" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-xl p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90">Expiring Soon</p>
                  <p className="text-3xl font-bold mt-1">{stats.expiring}</p>
                </div>
                <FiClock className="w-12 h-12 opacity-80" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90">Expired</p>
                  <p className="text-3xl font-bold mt-1">{stats.expired}</p>
                </div>
                <FiPackage className="w-12 h-12 opacity-80" />
              </div>
            </div>
          </div>

          {/* Today's Performance */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <FiShoppingCart className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-600">Period Sales</p>
                  <p className="text-2xl font-bold text-slate-900">{stats.todaySales}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <FiDollarSign className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-600">Revenue</p>
                  <p className="text-2xl font-bold text-slate-900">PKR {stats.todayRevenue.toLocaleString()}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                  <FiDollarSign className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-600">Cost</p>
                  <p className="text-2xl font-bold text-slate-900">PKR {stats.todayCost.toLocaleString()}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                  <FiTrendingUp className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-600">Net Profit</p>
                  <p className="text-2xl font-bold text-emerald-600">PKR {stats.todayProfit.toLocaleString()}</p>
                </div>
              </div>
            </div>

            <ExpenseCard 
              portal="pharmacy" 
              title="Pharmacy" 
              color="blue" 
            />
          </div>

          {/* Inventory Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl shadow-sm border border-purple-200 p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <FiPackage className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-purple-700">Inventory Value (Potential Revenue)</p>
                  <p className="text-2xl font-bold text-purple-900">PKR {stats.inventoryValue.toLocaleString()}</p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-xl shadow-sm border border-orange-200 p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                  <FiTrendingUp className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-orange-700">Inventory Cost (Investment)</p>
                  <p className="text-2xl font-bold text-orange-900">PKR {stats.inventoryCost.toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h2 className="text-xl font-semibold text-slate-800 mb-4">Quick Access</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {quickLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-lg transition-all hover:-translate-y-1 group"
                >
                  <div className={`w-12 h-12 bg-${link.color}-100 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                    <link.icon className={`w-6 h-6 text-${link.color}-600`} />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-800 mb-1">{link.name}</h3>
                  <p className="text-sm text-slate-600">{link.description}</p>
                </Link>
              ))}
            </div>
          </div>

          {/* Recent Sales */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-800">Recent Sales</h2>
            </div>
            {recentSales.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <FiShoppingCart className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p>No sales yet today</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Invoice</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Customer</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Items</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Amount</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {recentSales.map((sale) => (
                      <tr key={sale._id} className="hover:bg-slate-50">
                        <td className="px-6 py-4">
                          <span className="font-medium text-blue-600">{sale.invoiceNumber}</span>
                        </td>
                        <td className="px-6 py-4 text-slate-600">{sale.customerName || 'Walk-in'}</td>
                        <td className="px-6 py-4 text-slate-600">{sale.items?.length || 0}</td>
                        <td className="px-6 py-4 font-semibold text-green-600">PKR {sale.totalAmount.toLocaleString()}</td>
                        <td className="px-6 py-4 text-slate-600">
                          {new Date(sale.createdAt).toLocaleTimeString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Alerts Section */}
          {(stats.lowStock > 0 || stats.expiring > 0 || stats.expired > 0) && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-6">
              <div className="flex items-start gap-3">
                <FiAlertTriangle className="w-6 h-6 text-orange-600 flex-shrink-0 mt-1" />
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-orange-900 mb-2">Attention Required</h3>
                  <div className="space-y-1 text-sm text-orange-800">
                    {stats.lowStock > 0 && (
                      <p>• {stats.lowStock} medicine(s) are running low on stock</p>
                    )}
                    {stats.expiring > 0 && (
                      <p>• {stats.expiring} medicine(s) are expiring within 30 days</p>
                    )}
                    {stats.expired > 0 && (
                      <p>• {stats.expired} medicine(s) have expired</p>
                    )}
                  </div>
                  <Link
                    to={`${basePath}/medicines`}
                    className="inline-block mt-3 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    View Inventory
                  </Link>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
