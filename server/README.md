# Pet Hospital Management System - Backend API

## 🏥 Overview

RESTful API server for Pet Hospital Management System built with Express.js and MongoDB.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Configure environment
copy .env.example .env
# Edit .env with your MongoDB connection string

# Start server
npm start

# Development mode (with auto-reload)
npm run dev

# Migrate data from localStorage
npm run migrate
```

## 📡 API Endpoints

### Health Check
```
GET /api/health
```

### Users
```
GET    /api/users              - Get all users
GET    /api/users/:username    - Get user by username
POST   /api/users              - Create new user
POST   /api/users/login        - User login
PUT    /api/users/:username    - Update user
DELETE /api/users/:username    - Delete user
```

### Pets
```
GET    /api/pets               - Get all pets
GET    /api/pets/:id           - Get pet by ID
GET    /api/pets/search/:query - Search pets
POST   /api/pets               - Create new pet
PUT    /api/pets/:id           - Update pet
DELETE /api/pets/:id           - Delete pet
```

### Appointments
```
GET    /api/appointments       - Get all appointments
GET    /api/appointments/:id   - Get appointment by ID
POST   /api/appointments       - Create appointment
PUT    /api/appointments/:id   - Update appointment
DELETE /api/appointments/:id   - Delete appointment
```

### Prescriptions
```
GET    /api/prescriptions                - Get all prescriptions
GET    /api/prescriptions/:id            - Get prescription by ID
GET    /api/prescriptions/patient/:id    - Get by patient ID
POST   /api/prescriptions                - Create prescription
PUT    /api/prescriptions/:id            - Update prescription
DELETE /api/prescriptions/:id            - Delete prescription
```

### Medicines
```
GET    /api/medicines          - Get all medicines
GET    /api/medicines/:id      - Get medicine by ID
POST   /api/medicines          - Create medicine
PUT    /api/medicines/:id      - Update medicine
DELETE /api/medicines/:id      - Delete medicine
```

### Lab Reports
```
GET    /api/lab-reports        - Get all reports
GET    /api/lab-reports/:id    - Get report by ID
POST   /api/lab-reports        - Create report
PUT    /api/lab-reports/:id    - Update report
DELETE /api/lab-reports/:id    - Delete report
```

### Lab Tests
```
GET    /api/lab-tests          - Get all tests
GET    /api/lab-tests/:id      - Get test by ID
POST   /api/lab-tests          - Create test
PUT    /api/lab-tests/:id      - Update test
DELETE /api/lab-tests/:id      - Delete test
```

### Inventory
```
GET    /api/inventory          - Get all items
GET    /api/inventory/:id      - Get item by ID
POST   /api/inventory          - Create item
PUT    /api/inventory/:id      - Update item
DELETE /api/inventory/:id      - Delete item
```

### Financials
```
GET    /api/financials         - Get all records
GET    /api/financials/:id     - Get record by ID
POST   /api/financials         - Create record
PUT    /api/financials/:id     - Update record
DELETE /api/financials/:id     - Delete record
```

### Settings
```
GET    /api/settings/:userId   - Get user settings
POST   /api/settings           - Create/update settings
PUT    /api/settings/:userId   - Update settings
```

## 📦 Response Format

### Success Response
```json
{
  "success": true,
  "data": { ... }
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error description"
}
```

## 🗄️ Database Schema

### Collections
- users
- pets
- appointments
- prescriptions
- medicines
- labreports
- labtests
- inventories
- financials
- settings

## 🔧 Configuration

### Environment Variables
```env
MONGODB_URI=mongodb://localhost:27017/pets_hospital
PORT=5000
NODE_ENV=development
JWT_SECRET=your_secret_key
CORS_ORIGIN=http://localhost:5173
```

## 🛠️ Development

```bash
# Install nodemon for auto-reload
npm install -g nodemon

# Run in development mode
npm run dev
```

## 📊 Database Indexes

All collections include optimized indexes for:
- Primary keys (id fields)
- Search fields (names, dates)
- Foreign keys (relationships)
- Status fields (filtering)

## 🔐 Security

- CORS enabled for specified origins
- Input validation on all endpoints
- Password hashing (bcrypt)
- JWT authentication ready
- MongoDB injection protection

## 🚀 Deployment

### Heroku
```bash
heroku create your-app-name
heroku config:set MONGODB_URI=your_mongodb_atlas_uri
git push heroku main
```

### Railway
```bash
railway login
railway init
railway up
```

### Render
1. Connect GitHub repository
2. Set environment variables
3. Deploy

## 📝 Notes

- All dates stored in ISO 8601 format
- IDs are custom strings (not MongoDB ObjectIds)
- Soft deletes not implemented (hard deletes)
- No authentication middleware yet (add if needed)

## 🆘 Troubleshooting

**Port already in use**
```bash
# Windows
netstat -ano | findstr :5000
taskkill /PID <PID> /F

# Mac/Linux
lsof -ti:5000 | xargs kill
```

**MongoDB connection failed**
- Check if MongoDB is running
- Verify connection string
- Check network/firewall settings

## 📚 Dependencies

- **express** - Web framework
- **mongoose** - MongoDB ODM
- **cors** - CORS middleware
- **dotenv** - Environment variables
- **bcryptjs** - Password hashing
- **jsonwebtoken** - JWT tokens
- **express-validator** - Input validation

---

**Version**: 1.0.0
**Last Updated**: November 2024
