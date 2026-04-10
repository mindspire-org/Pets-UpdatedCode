import React, { useState, useEffect } from 'react';
import { FiPackage, FiDollarSign, FiShoppingCart, FiTrendingUp, FiAlertCircle, FiCalendar } from 'react-icons/fi';
import { productsAPI, salesAPI } from '../../services/api';
import ExpenseCard from '../../components/ExpenseCard';
import DateRangePicker from '../../components/DateRangePicker';

export default function ShopDashboard() {
  const [stats, setStats] = useState({
    todaySales: 0,
    todayRevenue: 0,
    totalProducts: 0,
    lowStockCount: 0
  });
  const [recentSales, setRecentSales] = useState([]);
  const [lowStockProducts, setLowStockProducts] = useState([]);
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

  // Date filtering function
  const isDateInRange = (dateStr) => {
    if (!dateStr) return false;
    const date = new Date(dateStr).toISOString().slice(0,10);
    return date >= dateRange.fromDate && date <= dateRange.toDate;
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [products, lowStock, salesRange] = await Promise.all([
        productsAPI.getAll(),
        productsAPI.getLowStock(),
        salesAPI.getByDateRange(dateRange.fromDate, dateRange.toDate)
      ]);

      const allSales = Array.isArray(salesRange?.data) ? salesRange.data : [];
      const filteredSales = allSales
        .filter(sale => isDateInRange(sale.createdAt || sale.date))
        .slice()
        .sort((a, b) => new Date(b.createdAt || b.date || 0) - new Date(a.createdAt || a.date || 0));
      
      setRecentSales(filteredSales.slice(0, 5));
      setLowStockProducts(lowStock.data?.slice(0, 5) || []);
      
      // Update stats with filtered data
      const filteredRevenue = filteredSales.reduce((sum, sale) => sum + (sale.totalAmount || 0), 0);
      setStats({
        todaySales: filteredSales.length,
        todayRevenue: filteredRevenue,
        totalProducts: products.data?.length || 0,
        lowStockCount: lowStock.data?.length || 0
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          Shop Dashboard
        </h1>
        <p className="text-slate-500 mt-1">Pet Products & Sales Overview</p>
      </div>

      {/* Date Range Picker */}
      <div className="rounded-2xl bg-gradient-to-br from-white via-blue-50 to-purple-50 shadow-xl ring-1 ring-blue-200 border border-blue-100 p-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
              <FiCalendar className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="text-sm font-semibold text-blue-600">Date Range</div>
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

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90">Sales</p>
              <p className="text-3xl font-bold mt-1">{stats.todaySales}</p>
            </div>
            <FiShoppingCart className="w-12 h-12 opacity-80" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90">Revenue</p>
              <p className="text-3xl font-bold mt-1">Rs{stats.todayRevenue.toLocaleString()}</p>
            </div>
            <FiDollarSign className="w-12 h-12 opacity-80" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90">Total Products</p>
              <p className="text-3xl font-bold mt-1">{stats.totalProducts}</p>
            </div>
            <FiPackage className="w-12 h-12 opacity-80" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90">Low Stock Items</p>
              <p className="text-3xl font-bold mt-1">{stats.lowStockCount}</p>
            </div>
            <FiAlertCircle className="w-12 h-12 opacity-80" />
          </div>
        </div>

        <ExpenseCard 
          portal="shop" 
          title="Shop" 
          color="orange" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Sales */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <FiTrendingUp className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-slate-800">Recent Sales Today</h2>
          </div>
          
          {recentSales.length === 0 ? (
            <p className="text-slate-500 text-center py-8">No sales today yet</p>
          ) : (
            <div className="space-y-3">
              {recentSales.map((sale) => (
                <div key={sale._id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div>
                    <p className="font-medium text-slate-800">{sale.invoiceNumber}</p>
                    <p className="text-sm text-slate-500">
                      {sale.items?.length || 0} items • {sale.customerName || 'Walk-in'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-green-600">Rs{sale.totalAmount.toLocaleString()}</p>
                    <p className="text-xs text-slate-500">
                      {new Date(sale.createdAt).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Low Stock Alert */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <FiAlertCircle className="w-5 h-5 text-orange-600" />
            <h2 className="text-lg font-semibold text-slate-800">Low Stock Alert</h2>
          </div>
          
          {lowStockProducts.length === 0 ? (
            <p className="text-slate-500 text-center py-8">All products are well stocked</p>
          ) : (
            <div className="space-y-3">
              {lowStockProducts.map((product) => (
                <div key={product._id} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-200">
                  <div>
                    <p className="font-medium text-slate-800">{product.itemName}</p>
                    <p className="text-sm text-slate-500">{product.category}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-orange-600">{product.quantity} left</p>
                    <p className="text-xs text-slate-500">
                      Threshold: {product.lowStockThreshold}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
