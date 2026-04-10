import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';

dotenv.config();

const users = [
  {
    username: 'admin',
    password: 'admin123',
    role: 'admin',
    name: 'Admin User',
    email: 'admin@petshospital.com',
    phone: '+92-300-1234567'
  },
  {
    username: 'reception',
    password: 'reception123',
    role: 'reception',
    name: 'Reception Staff',
    email: 'reception@petshospital.com',
    phone: '+92-300-2345678'
  },
  {
    username: 'doctor',
    password: 'doctor123',
    role: 'doctor',
    name: 'Dr. Ahmed Khan',
    email: 'doctor@petshospital.com',
    phone: '+92-300-3456789'
  },
  {
    username: 'lab',
    password: 'lab123',
    role: 'lab',
    name: 'Lab Technician',
    email: 'lab@petshospital.com',
    phone: '+92-300-4567890'
  },
  {
    username: 'pharmacy',
    password: 'pharmacy123',
    role: 'pharmacy',
    name: 'Pharmacy Staff',
    email: 'pharmacy@petshospital.com',
    phone: '+92-300-5678901'
  },
  {
    username: 'shop',
    password: 'shop123',
    role: 'shop',
    name: 'Pet Shop Manager',
    email: 'shop@petshospital.com',
    phone: '+92-300-6789012'
  }
];

const createAllUsers = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    for (const userData of users) {
      const existing = await User.findOne({ username: userData.username });
      
      if (existing) {
        console.log(`⚠️  ${userData.username} already exists - skipping`);
      } else {
        const user = new User({ ...userData, isActive: true });
        await user.save();
        console.log(`✅ Created user: ${userData.username} (${userData.role})`);
      }
    }

    console.log('\n🎉 All users created successfully!\n');
    console.log('📋 Login Credentials:');
    console.log('─────────────────────────────────────');
    users.forEach(u => {
      console.log(`${u.role.padEnd(12)} → ${u.username.padEnd(12)} / ${u.password}`);
    });
    console.log('─────────────────────────────────────\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

createAllUsers();
