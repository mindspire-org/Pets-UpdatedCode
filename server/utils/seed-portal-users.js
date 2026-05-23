import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';

dotenv.config();

// One user per portal, all with password: 123
// Username = portal name (admin portal uses 'admin')
const users = [
  { 
    username: 'admin',     
    password: '123', 
    role: 'admin',     
    name: 'Admin User',
    portalAccess: ['admin', 'reception', 'doctor', 'lab', 'pharmacy', 'shop']
  },
  { 
    username: 'reception', 
    password: '123', 
    role: 'reception', 
    name: 'Reception Staff',
    portalAccess: ['reception']
  },
  { 
    username: 'doctor',    
    password: '123', 
    role: 'doctor',    
    name: 'Doctor',
    portalAccess: ['doctor']
  },
  { 
    username: 'lab',       
    password: '123', 
    role: 'lab',       
    name: 'Lab Technician',
    portalAccess: ['lab']
  },
  { 
    username: 'pharmacy',  
    password: '123', 
    role: 'pharmacy',  
    name: 'Pharmacy Staff',
    portalAccess: ['pharmacy']
  },
  { 
    username: 'shop',      
    password: '123', 
    role: 'shop',      
    name: 'Shop Manager',
    portalAccess: ['shop']
  },
];

const run = async () => {
  try {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/pets-hospital';
    await mongoose.connect(uri);
    console.log('✅ Connected to MongoDB\n');

    for (const u of users) {
      const existing = await User.findOne({ username: u.username });
      if (existing) {
        existing.password = u.password;
        existing.role = u.role;
        existing.name = u.name;
        existing.portalAccess = u.portalAccess;
        existing.isActive = true;
        await existing.save();
        console.log(`🔄 Updated : ${u.username.padEnd(12)} role=${u.role} portalAccess=[${u.portalAccess.join(', ')}]`);
      } else {
        await new User({ ...u, isActive: true }).save();
        console.log(`✅ Created : ${u.username.padEnd(12)} role=${u.role} portalAccess=[${u.portalAccess.join(', ')}]`);
      }
    }

    console.log('\n📋 Portal Login Credentials:');
    console.log('─────────────────────────────────────────');
    users.forEach(u =>
      console.log(`  ${u.role.padEnd(12)} → username: ${u.username.padEnd(12)} password: ${u.password}`)
    );
    console.log('─────────────────────────────────────────\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
};

run();
