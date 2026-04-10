// Data Migration Utility - Transfer localStorage data to MongoDB
// Run this script to migrate existing data from localStorage to MongoDB

import connectDB from '../config/database.js';
import User from '../models/User.js';
import Pet from '../models/Pet.js';
import Appointment from '../models/Appointment.js';
import Prescription from '../models/Prescription.js';
import Medicine from '../models/Medicine.js';
import LabReport from '../models/LabReport.js';
import LabTest from '../models/LabTest.js';
import Inventory from '../models/Inventory.js';
import Financial from '../models/Financial.js';
import Settings from '../models/Settings.js';

// Sample localStorage data structure (you'll need to export this from your browser)
// Instructions:
// 1. Open your browser console on the Pet Hospital app
// 2. Run: console.log(JSON.stringify(localStorage))
// 3. Copy the output and save it to a file named 'localStorage-export.json'
// 4. Place the file in the same directory as this script
// 5. Run: npm run migrate

const migrateData = async () => {
  try {
    console.log('🚀 Starting data migration...\n');

    // Connect to MongoDB
    await connectDB();

    // Import localStorage data
    let localStorageData;
    try {
      const fs = await import('fs');
      const data = fs.readFileSync('./localStorage-export.json', 'utf8');
      localStorageData = JSON.parse(data);
      console.log('✅ localStorage data loaded successfully\n');
    } catch (error) {
      console.log('⚠️  No localStorage-export.json found. Using empty data.\n');
      console.log('To migrate existing data:');
      console.log('1. Open browser console on your Pet Hospital app');
      console.log('2. Run: copy(JSON.stringify(localStorage))');
      console.log('3. Save to server/utils/localStorage-export.json');
      console.log('4. Run this script again\n');
      localStorageData = {};
    }

    // Parse localStorage data
    const parseJSON = (key) => {
      try {
        return localStorageData[key] ? JSON.parse(localStorageData[key]) : [];
      } catch (error) {
        console.error(`Error parsing ${key}:`, error.message);
        return [];
      }
    };

    // Migrate Users
    console.log('📦 Migrating Users...');
    const users = parseJSON('admin_users') || [];
    if (users.length > 0) {
      for (const user of users) {
        try {
          await User.findOneAndUpdate(
            { username: user.username },
            user,
            { upsert: true, new: true }
          );
        } catch (error) {
          console.error(`Error migrating user ${user.username}:`, error.message);
        }
      }
      console.log(`✅ Migrated ${users.length} users\n`);
    } else {
      console.log('⚠️  No users found\n');
    }

    // Migrate Pets
    console.log('📦 Migrating Pets...');
    const pets = parseJSON('reception_pets') || [];
    if (pets.length > 0) {
      for (const pet of pets) {
        try {
          await Pet.findOneAndUpdate(
            { id: pet.id },
            pet,
            { upsert: true, new: true }
          );
        } catch (error) {
          console.error(`Error migrating pet ${pet.id}:`, error.message);
        }
      }
      console.log(`✅ Migrated ${pets.length} pets\n`);
    } else {
      console.log('⚠️  No pets found\n');
    }

    // Migrate Appointments
    console.log('📦 Migrating Appointments...');
    const appointments = parseJSON('reception_appointments') || [];
    if (appointments.length > 0) {
      for (const appointment of appointments) {
        try {
          await Appointment.findOneAndUpdate(
            { id: appointment.id },
            appointment,
            { upsert: true, new: true }
          );
        } catch (error) {
          console.error(`Error migrating appointment ${appointment.id}:`, error.message);
        }
      }
      console.log(`✅ Migrated ${appointments.length} appointments\n`);
    } else {
      console.log('⚠️  No appointments found\n');
    }

    // Migrate Prescriptions
    console.log('📦 Migrating Prescriptions...');
    const prescriptions = parseJSON('doctor_prescriptions') || [];
    if (prescriptions.length > 0) {
      for (const prescription of prescriptions) {
        try {
          await Prescription.findOneAndUpdate(
            { id: prescription.id },
            prescription,
            { upsert: true, new: true }
          );
        } catch (error) {
          console.error(`Error migrating prescription ${prescription.id}:`, error.message);
        }
      }
      console.log(`✅ Migrated ${prescriptions.length} prescriptions\n`);
    } else {
      console.log('⚠️  No prescriptions found\n');
    }

    // Migrate Medicines
    console.log('📦 Migrating Medicines...');
    const medicines = parseJSON('doctor_medicines') || [];
    if (medicines.length > 0) {
      for (const medicine of medicines) {
        try {
          await Medicine.findOneAndUpdate(
            { id: medicine.id },
            medicine,
            { upsert: true, new: true }
          );
        } catch (error) {
          console.error(`Error migrating medicine ${medicine.id}:`, error.message);
        }
      }
      console.log(`✅ Migrated ${medicines.length} medicines\n`);
    } else {
      console.log('⚠️  No medicines found\n');
    }

    // Migrate Lab Reports
    console.log('📦 Migrating Lab Reports...');
    const labReports = parseJSON('lab_reports') || [];
    if (labReports.length > 0) {
      for (const report of labReports) {
        try {
          await LabReport.findOneAndUpdate(
            { id: report.id },
            report,
            { upsert: true, new: true }
          );
        } catch (error) {
          console.error(`Error migrating lab report ${report.id}:`, error.message);
        }
      }
      console.log(`✅ Migrated ${labReports.length} lab reports\n`);
    } else {
      console.log('⚠️  No lab reports found\n');
    }

    // Migrate Lab Tests
    console.log('📦 Migrating Lab Tests...');
    const labTests = parseJSON('lab_catalog') || parseJSON('lab_tests') || [];
    if (labTests.length > 0) {
      for (const test of labTests) {
        try {
          await LabTest.findOneAndUpdate(
            { id: test.id },
            test,
            { upsert: true, new: true }
          );
        } catch (error) {
          console.error(`Error migrating lab test ${test.id}:`, error.message);
        }
      }
      console.log(`✅ Migrated ${labTests.length} lab tests\n`);
    } else {
      console.log('⚠️  No lab tests found\n');
    }

    // Migrate Inventory
    console.log('📦 Migrating Inventory...');
    const inventory = parseJSON('admin_inventory') || parseJSON('lab_inventory') || [];
    if (inventory.length > 0) {
      for (const item of inventory) {
        try {
          await Inventory.findOneAndUpdate(
            { id: item.id },
            item,
            { upsert: true, new: true }
          );
        } catch (error) {
          console.error(`Error migrating inventory item ${item.id}:`, error.message);
        }
      }
      console.log(`✅ Migrated ${inventory.length} inventory items\n`);
    } else {
      console.log('⚠️  No inventory items found\n');
    }

    // Migrate Financials
    console.log('📦 Migrating Financials...');
    const financials = parseJSON('admin_financials') || [];
    if (financials.length > 0) {
      for (const record of financials) {
        try {
          await Financial.findOneAndUpdate(
            { id: record.id },
            record,
            { upsert: true, new: true }
          );
        } catch (error) {
          console.error(`Error migrating financial record ${record.id}:`, error.message);
        }
      }
      console.log(`✅ Migrated ${financials.length} financial records\n`);
    } else {
      console.log('⚠️  No financial records found\n');
    }

    console.log('✅ Migration completed successfully!\n');
    console.log('📊 Summary:');
    console.log(`   Users: ${users.length}`);
    console.log(`   Pets: ${pets.length}`);
    console.log(`   Appointments: ${appointments.length}`);
    console.log(`   Prescriptions: ${prescriptions.length}`);
    console.log(`   Medicines: ${medicines.length}`);
    console.log(`   Lab Reports: ${labReports.length}`);
    console.log(`   Lab Tests: ${labTests.length}`);
    console.log(`   Inventory: ${inventory.length}`);
    console.log(`   Financials: ${financials.length}\n`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
};

// Run migration
migrateData();
