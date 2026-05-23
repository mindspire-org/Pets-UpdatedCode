import express from "express";
import PetshopNotification from "../models/PetshopNotification.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const {
      portal = "shop",
      type,
      severity,
      isRead,
      startDate,
      endDate,
      page = 1,
      limit = 50,
      sortOrder = "desc",
    } = req.query;

    const filter = { portal };

    if (type) filter.type = type;
    if (severity) filter.severity = severity;
    if (isRead === "true") filter.isRead = true;
    if (isRead === "false") filter.isRead = false;

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate + "T23:59:59.999Z");
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = { createdAt: sortOrder === "asc" ? 1 : -1 };

    const [items, totalCount] = await Promise.all([
      PetshopNotification.find(filter).sort(sort).skip(skip).limit(parseInt(limit)).lean(),
      PetshopNotification.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: {
        notifications: items,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / parseInt(limit)),
          totalCount,
          hasNext: skip + parseInt(limit) < totalCount,
          hasPrev: parseInt(page) > 1,
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const payload = {
      portal: req.body.portal || "shop",
      type: req.body.type,
      severity: req.body.severity,
      title: req.body.title,
      message: req.body.message,
      relatedId: req.body.relatedId || null,
      relatedModel: req.body.relatedModel || null,
      meta: req.body.meta || {},
      createdBy: req.body.createdBy || "System",
    };

    if (!payload.type || !payload.title || !payload.message) {
      return res.status(400).json({
        success: false,
        message: "type, title, and message are required",
      });
    }

    const note = new PetshopNotification(payload);
    await note.save();

    res.status(201).json({ success: true, data: note });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put("/:id/read", async (req, res) => {
  try {
    const note = await PetshopNotification.findByIdAndUpdate(
      req.params.id,
      { isRead: true, readAt: new Date() },
      { new: true },
    );

    if (!note) {
      return res.status(404).json({ success: false, message: "Notification not found" });
    }

    res.json({ success: true, data: note });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put("/mark-all-read", async (req, res) => {
  try {
    const { portal = "shop" } = req.body;
    const result = await PetshopNotification.updateMany(
      { portal, isRead: false },
      { $set: { isRead: true, readAt: new Date() } },
    );

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const deleted = await PetshopNotification.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Notification not found" });
    }
    res.json({ success: true, message: "Deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete("/", async (req, res) => {
  try {
    const { portal = "shop" } = req.query;
    const result = await PetshopNotification.deleteMany({ portal });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
