import mongoose from 'mongoose';
import User from '../models/User.js';

// Script to update existing shop users with companies permission
async function updateShopPermissions() {
  try {
    console.log('Connecting to database...');
    
    // Update admin users
    const adminResult = await User.updateMany(
      { 
        role: { $regex: /^admin$/i },
        'sidebarPermissions.shop': { $exists: true }
      },
      { 
        $addToSet: { 
          'sidebarPermissions.shop': 'companies' 
        }
      }
    );
    
    console.log(`Updated ${adminResult.modifiedCount} admin users`);
    
    // Update shop users
    const shopResult = await User.updateMany(
      { 
        role: { $regex: /^shop$/i },
        'sidebarPermissions.shop': { $exists: true }
      },
      { 
        $addToSet: { 
          'sidebarPermissions.shop': 'companies' 
        }
      }
    );
    
    console.log(`Updated ${shopResult.modifiedCount} shop users`);
    
    // Update users with shop portal access
    const portalAccessResult = await User.updateMany(
      { 
        portalAccess: 'shop',
        'sidebarPermissions.shop': { $exists: true }
      },
      { 
        $addToSet: { 
          'sidebarPermissions.shop': 'companies' 
        }
      }
    );
    
    console.log(`Updated ${portalAccessResult.modifiedCount} users with shop portal access`);
    
    console.log('Shop permissions update completed successfully!');
    
  } catch (error) {
    console.error('Error updating shop permissions:', error);
  }
}

// Run the update if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  updateShopPermissions().then(() => {
    process.exit(0);
  }).catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
}

export default updateShopPermissions;