import mongoose from 'mongoose';

const sidebarItemSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    label: { type: String, required: true },
    path: { type: String, required: true },
    iconKey: { type: String },
    order: { type: Number, default: 0 },
    end: { type: Boolean, default: false },
    isVisible: { type: Boolean, default: true },
  },
  { _id: false },
);

const sidebarGroupSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    title: { type: String },
    order: { type: Number, default: 0 },
    items: { type: [sidebarItemSchema], default: [] },
  },
  { _id: false },
);

const sidebarConfigSchema = new mongoose.Schema(
  {
    portalId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    name: { type: String, required: true },
    version: { type: Number, default: 1 },
    groups: { type: [sidebarGroupSchema], default: [] },
  },
  { timestamps: true },
);

sidebarConfigSchema.index({ portalId: 1 });

const SidebarConfig = mongoose.model('SidebarConfig', sidebarConfigSchema);

export default SidebarConfig;
