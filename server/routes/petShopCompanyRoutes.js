import express from "express";
import PetShopCompany from "../models/PetShopCompany.js";

const router = express.Router();

// Get all pet shop companies (optionally filter by status)
router.get("/", async (req, res) => {
  try {
    const { status, businessType, specialization } = req.query;
    const query = { portal: 'shop' };
    
    if (status && status !== "all") {
      query.status = status;
    }
    
    if (businessType && businessType !== "all") {
      query.businessType = businessType;
    }
    
    if (specialization && specialization !== "all") {
      query.specializations = { $in: [specialization] };
    }
    
    const companies = await PetShopCompany.find(query).sort({ companyName: 1 });
    res.json({ success: true, data: companies });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get company by ID
router.get("/:id", async (req, res) => {
  try {
    const company = await PetShopCompany.findById(req.params.id);
    if (!company) {
      return res
        .status(404)
        .json({ success: false, message: "Company not found" });
    }
    res.json({ success: true, data: company });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create company
router.post("/", async (req, res) => {
  try {
    const { 
      companyName, 
      status, 
      contactPerson, 
      phone, 
      email, 
      address, 
      website,
      businessType,
      specializations,
      paymentTerms,
      creditLimit,
      taxId,
      notes
    } = req.body;
    
    if (!companyName || !companyName.trim()) {
      return res
        .status(400)
        .json({ success: false, message: "Company name is required" });
    }
    
    // Check if company already exists
    const existing = await PetShopCompany.findOne({
      companyName: companyName.trim(),
      portal: "shop"
    });
    
    if (existing) {
      return res
        .status(400)
        .json({ success: false, message: "Company already exists" });
    }
    
    const company = new PetShopCompany({
      companyName: companyName.trim(),
      status: status || "active",
      portal: "shop",
      contactPerson: contactPerson?.trim(),
      phone: phone?.trim(),
      email: email?.trim(),
      address: address?.trim(),
      website: website?.trim(),
      businessType: businessType || "distributor",
      specializations: Array.isArray(specializations) ? specializations.filter(s => s?.trim()) : [],
      paymentTerms: paymentTerms?.trim() || "Net 30",
      creditLimit: Number(creditLimit) || 0,
      taxId: taxId?.trim(),
      notes: notes?.trim()
    });
    
    await company.save();
    res.status(201).json({ success: true, data: company });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Update company
router.put("/:id", async (req, res) => {
  try {
    const { 
      companyName, 
      status, 
      contactPerson, 
      phone, 
      email, 
      address, 
      website,
      businessType,
      specializations,
      paymentTerms,
      creditLimit,
      taxId,
      notes
    } = req.body;
    
    const company = await PetShopCompany.findById(req.params.id);
    if (!company) {
      return res
        .status(404)
        .json({ success: false, message: "Company not found" });
    }
    
    // Check if new name conflicts with existing company
    if (companyName && companyName.trim() !== company.companyName) {
      const existing = await PetShopCompany.findOne({
        companyName: companyName.trim(),
        portal: "shop",
        _id: { $ne: req.params.id }
      });
      
      if (existing) {
        return res
          .status(400)
          .json({ success: false, message: "Company name already exists" });
      }
    }
    
    // Update fields
    if (companyName) company.companyName = companyName.trim();
    if (status) company.status = status;
    if (contactPerson !== undefined) company.contactPerson = contactPerson?.trim();
    if (phone !== undefined) company.phone = phone?.trim();
    if (email !== undefined) company.email = email?.trim();
    if (address !== undefined) company.address = address?.trim();
    if (website !== undefined) company.website = website?.trim();
    if (businessType) company.businessType = businessType;
    if (specializations !== undefined) {
      company.specializations = Array.isArray(specializations) ? specializations.filter(s => s?.trim()) : [];
    }
    if (paymentTerms !== undefined) company.paymentTerms = paymentTerms?.trim() || "Net 30";
    if (creditLimit !== undefined) company.creditLimit = Number(creditLimit) || 0;
    if (taxId !== undefined) company.taxId = taxId?.trim();
    if (notes !== undefined) company.notes = notes?.trim();
    
    await company.save();
    res.json({ success: true, data: company });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Delete company
router.delete("/:id", async (req, res) => {
  try {
    const company = await PetShopCompany.findByIdAndDelete(req.params.id);
    if (!company) {
      return res
        .status(404)
        .json({ success: false, message: "Company not found" });
    }
    res.json({ success: true, message: "Company deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Search companies
router.get("/search/:query", async (req, res) => {
  try {
    const { query } = req.params;
    const { status, businessType } = req.query;
    
    const searchQuery = {
      portal: "shop",
      $or: [
        { companyName: { $regex: query, $options: "i" } },
        { contactPerson: { $regex: query, $options: "i" } },
        { phone: { $regex: query, $options: "i" } },
        { email: { $regex: query, $options: "i" } }
      ]
    };
    
    if (status && status !== "all") {
      searchQuery.status = status;
    }
    
    if (businessType && businessType !== "all") {
      searchQuery.businessType = businessType;
    }
    
    const companies = await PetShopCompany.find(searchQuery)
      .sort({ companyName: 1 })
      .limit(20);
      
    res.json({ success: true, data: companies });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get business types
router.get("/meta/business-types", async (req, res) => {
  try {
    const businessTypes = ['manufacturer', 'distributor', 'wholesaler', 'retailer', 'importer', 'other'];
    res.json({ success: true, data: businessTypes });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get all specializations
router.get("/meta/specializations", async (req, res) => {
  try {
    const specializations = await PetShopCompany.distinct('specializations', { portal: 'shop' });
    res.json({ success: true, data: specializations.filter(s => s) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;