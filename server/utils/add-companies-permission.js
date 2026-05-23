import mongoose from 'mongoose';
import User from '../models/User.js';

// Simple script to add companies permission to all shop users
async function addCompaniesPermission() {
  try {
    console.log('Adding companies permission to all users...');
    
    // Update all users to include companies permission in shop sidebar
    const result = await User.updateMany(
      {},
      { 
        $addToSet: { 
          'sidebarPermissions.shop': 'companies' 
        }
      }
    );
    
    console.log(`Updated ${result.modifiedCount} users with companies permission`);
    
    // Also update admin users to have companies in their admin permissions
    const adminResult = await User.updateMany(
      { role: { $regex: /^admin$/i } },
      { 
        $addToSet: { 
          'sidebarPermissions.admin': 'companies' 
        }
      }
    );
    
    console.log(`Updated ${adminResult.modifiedCount} admin users`);
    
    // Show all users and their permissions
    const users = await User.find({}, 'username role sidebarPermissions portalAccess');
    console.log('\nAll users and their permissions:');
    users.forEach(user => {
      console.log(`${user.username} (${user.role}):`, {
        portalAccess: user.portalAccess,
        shopPermissions: user.sidebarPermissions?.shop
      });
    });
    
  } catch (error) {
    console.error('Error adding companies permission:', error);
  }
}

export default addCompaniesPermission;

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  // Connect to MongoDB
  mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/pets-hospital')
    .then(() => {
      console.log('Connected to MongoDB');
      return addCompaniesPermission();
    })
    .then(() => {
      console.log('Migration completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}