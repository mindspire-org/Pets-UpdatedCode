import express from "express";
import Company from "../models/Company.js";

const router = express.Router();

// Get all companies (optionally filter by portal and status)
router.get("/", async (req, res) => {
  try {
    const { portal, status } = req.query;
    const query = {};
    
    if (portal && portal !== "all") {
      query.portal = portal;
    }
    
    if (status && status !== "all") {
      query.status = status;
    }
    
    const companies = await Company.find(query).sort({ companyName: 1 });
    res.json({ success: true, data: companies });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get company by ID
router.get("/:id", async (req, res) => {
  try {
    const company = await Company.findById(req.params.id);
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
    const { companyName, status, portal } = req.body;
    
    if (!companyName || !companyName.trim()) {
      return res
        .status(400)
        .json({ success: false, message: "Company name is required" });
    }
    
    // Check if company already exists
    const existing = await Company.findOne({
      companyName: companyName.trim(),
      portal: portal || "pharmacy"
    });
    
    if (existing) {
      return res
        .status(400)
        .json({ success: false, message: "Company already exists" });
    }
    
    const company = new Company({
      companyName: companyName.trim(),
      status: status || "active",
      portal: portal || "pharmacy"
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
    const { companyName, status } = req.body;
    
    const company = await Company.findById(req.params.id);
    if (!company) {
      return res
        .status(404)
        .json({ success: false, message: "Company not found" });
    }
    
    // Check if new name conflicts with existing company
    if (companyName && companyName.trim() !== company.companyName) {
      const existing = await Company.findOne({
        companyName: companyName.trim(),
        portal: company.portal,
        _id: { $ne: req.params.id }
      });
      
      if (existing) {
        return res
          .status(400)
          .json({ success: false, message: "Company name already exists" });
      }
    }
    
    if (companyName) company.companyName = companyName.trim();
    if (status) company.status = status;
    
    await company.save();
    res.json({ success: true, data: company });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Delete company
router.delete("/:id", async (req, res) => {
  try {
    const company = await Company.findByIdAndDelete(req.params.id);
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
    const { portal } = req.query;
    
    const searchQuery = {
      companyName: { $regex: query, $options: "i" }
    };
    
    if (portal && portal !== "all") {
      searchQuery.portal = portal;
    }
    
    const companies = await Company.find(searchQuery)
      .sort({ companyName: 1 })
      .limit(20);
      
    res.json({ success: true, data: companies });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
