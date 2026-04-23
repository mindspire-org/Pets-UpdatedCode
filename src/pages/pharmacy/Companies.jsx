import React, { useState, useEffect } from "react";
import {
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiSearch,
  FiX,
  FiPackage,
  FiCheckCircle,
  FiXCircle,
} from "react-icons/fi";
import { companiesAPI } from "../../services/api";

export default function Companies() {
  const [companies, setCompanies] = useState([]);
  const [filteredCompanies, setFilteredCompanies] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingCompany, setEditingCompany] = useState(null);
  const [companyToDelete, setCompanyToDelete] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState({ message: "", type: "success" });
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const [formData, setFormData] = useState({
    companyName: "",
    status: "active",
  });

  useEffect(() => {
    fetchCompanies();
  }, []);

  useEffect(() => {
    const q = searchQuery.toLowerCase();
    setFilteredCompanies(
      q
        ? companies.filter((c) =>
            (c.companyName || "").toLowerCase().includes(q)
          )
        : companies
    );
    setCurrentPage(1);
  }, [companies, searchQuery]);

  const fetchCompanies = async () => {
    try {
      setLoading(true);
      const response = await companiesAPI.getAll("pharmacy");
      setCompanies(response.data || []);
    } catch (error) {
      showToast("Error fetching companies", "error");
    } finally {
      setLoading(false);
    }
  };

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast({ message: "", type: "success" }), 3000);
  };

  const openModal = (company = null) => {
    if (company) {
      setEditingCompany(company);
      setFormData({
        companyName: company.companyName || "",
        status: company.status || "active",
      });
    } else {
      setEditingCompany(null);
      setFormData({ companyName: "", status: "active" });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingCompany(null);
    setFormData({ companyName: "", status: "active" });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.companyName.trim()) return;

    try {
      setSaving(true);
      if (editingCompany) {
        await companiesAPI.update(editingCompany._id, {
          companyName: formData.companyName.trim(),
          status: formData.status,
        });
        showToast("Company updated successfully");
      } else {
        await companiesAPI.create({
          companyName: formData.companyName.trim(),
          status: formData.status,
          portal: "pharmacy",
        });
        showToast("Company added successfully");
      }
      await fetchCompanies();
      closeModal();
    } catch (error) {
      showToast(error.message || "Error saving company", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!companyToDelete) return;
    try {
      await companiesAPI.delete(companyToDelete._id);
      showToast("Company deleted successfully");
      await fetchCompanies();
    } catch (error) {
      showToast("Error deleting company", "error");
    } finally {
      setShowDeleteModal(false);
      setCompanyToDelete(null);
    }
  };

  const activeCount = companies.filter((c) => c.status === "active").length;
  const inactiveCount = companies.filter((c) => c.status === "inactive").length;

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast.message && (
        <div
          className={`fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 text-white ${
            toast.type === "error" ? "bg-red-600" : "bg-green-600"
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
            Companies
          </h1>
          <p className="text-slate-500 mt-1">
            Manage pharmacy supplier companies
          </p>
        </div>
        <button
          onClick={() => openModal()}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
        >
          <FiPlus /> Add Company
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
          <p className="text-2xl font-bold text-slate-800">{companies.length}</p>
          <p className="text-sm text-slate-500 mt-1">Total</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{activeCount}</p>
          <p className="text-sm text-slate-500 mt-1">Active</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
          <p className="text-2xl font-bold text-red-500">{inactiveCount}</p>
          <p className="text-sm text-slate-500 mt-1">Inactive</p>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search companies..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <select
            value={itemsPerPage}
            onChange={(e) => {
              setItemsPerPage(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm text-slate-700"
          >
            {[10, 20, 50, 100].map((n) => (
              <option key={n} value={n}>
                Show {n}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Grid */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
          </div>
        ) : filteredCompanies.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <FiPackage className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">No companies found</p>
            {searchQuery && (
              <p className="text-sm mt-1">
                Try a different search term
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
              {filteredCompanies
                .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                .map((company) => (
                <div
                  key={company._id}
                  className="border border-slate-200 rounded-xl p-4 hover:shadow-md transition-shadow bg-slate-50/40"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-semibold text-slate-800 truncate">
                        {company.companyName}
                      </h3>
                      <div className="mt-2 flex items-center gap-1.5">
                        {company.status === "active" ? (
                          <FiCheckCircle className="w-3.5 h-3.5 text-green-500" />
                        ) : (
                          <FiXCircle className="w-3.5 h-3.5 text-red-400" />
                        )}
                        <span
                          className={`text-xs font-medium ${
                            company.status === "active"
                              ? "text-green-600"
                              : "text-red-500"
                          }`}
                        >
                          {company.status === "active" ? "Active" : "Inactive"}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-2">
                        Added{" "}
                        {new Date(company.createdAt).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                    <div className="flex gap-1 ml-2">
                      <button
                        onClick={() => openModal(company)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <FiEdit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setCompanyToDelete(company);
                          setShowDeleteModal(true);
                        }}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <FiTrash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {filteredCompanies.length > itemsPerPage && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200">
                <p className="text-sm text-slate-500">
                  Showing{" "}
                  <span className="font-medium text-slate-700">
                    {(currentPage - 1) * itemsPerPage + 1}
                  </span>{" "}
                  –{" "}
                  <span className="font-medium text-slate-700">
                    {Math.min(currentPage * itemsPerPage, filteredCompanies.length)}
                  </span>{" "}
                  of{" "}
                  <span className="font-medium text-slate-700">
                    {filteredCompanies.length}
                  </span>
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 border border-slate-300 rounded-lg text-sm hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  {Array.from(
                    { length: Math.ceil(filteredCompanies.length / itemsPerPage) },
                    (_, i) => i + 1
                  )
                    .filter((page) => {
                      const total = Math.ceil(filteredCompanies.length / itemsPerPage);
                      if (total <= 5) return true;
                      if (page === 1 || page === total) return true;
                      if (page >= currentPage - 1 && page <= currentPage + 1) return true;
                      return false;
                    })
                    .map((page, idx, arr) => (
                      <React.Fragment key={page}>
                        {idx > 0 && arr[idx - 1] !== page - 1 && (
                          <span className="px-1 text-slate-400 text-sm">…</span>
                        )}
                        <button
                          onClick={() => setCurrentPage(page)}
                          className={`px-3 py-1 rounded-lg text-sm border ${
                            currentPage === page
                              ? "bg-purple-600 text-white border-purple-600"
                              : "border-slate-300 hover:bg-slate-50"
                          }`}
                        >
                          {page}
                        </button>
                      </React.Fragment>
                    ))}
                  <button
                    onClick={() =>
                      setCurrentPage((p) =>
                        Math.min(Math.ceil(filteredCompanies.length / itemsPerPage), p + 1)
                      )
                    }
                    disabled={
                      currentPage >= Math.ceil(filteredCompanies.length / itemsPerPage)
                    }
                    className="px-3 py-1 border border-slate-300 rounded-lg text-sm hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="bg-gradient-to-r from-purple-600 to-blue-600 px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <h3 className="text-xl font-bold text-white">
                {editingCompany ? "Edit Company" : "Add New Company"}
              </h3>
              <button
                onClick={closeModal}
                className="text-white hover:bg-white/20 p-2 rounded-lg"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Company Name *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={formData.companyName}
                  onChange={(e) =>
                    setFormData({ ...formData, companyName: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Enter company name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Status
                </label>
                <div className="flex gap-3">
                  {["active", "inactive"].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setFormData({ ...formData, status: s })}
                      className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors capitalize ${
                        formData.status === s
                          ? s === "active"
                            ? "bg-green-600 border-green-600 text-white"
                            : "bg-red-500 border-red-500 text-white"
                          : "border-slate-300 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !formData.companyName.trim()}
                  className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {saving && (
                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  )}
                  {editingCompany ? "Update" : "Add"} Company
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && companyToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="bg-gradient-to-r from-red-500 to-red-600 px-6 py-4 rounded-t-2xl">
              <div className="flex items-center gap-3 text-white">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                  <FiTrash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Delete Company</h3>
                  <p className="text-xs opacity-80">This cannot be undone</p>
                </div>
              </div>
            </div>

            <div className="p-6">
              <p className="text-slate-600 mb-6">
                Delete{" "}
                <span className="font-semibold text-slate-800">
                  {companyToDelete.companyName}
                </span>
                ?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setCompanyToDelete(null);
                  }}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
