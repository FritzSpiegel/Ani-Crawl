import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

// Connect to MongoDB
const MONGO_URI = 'mongodb://127.0.0.1:27017/aniworld';

const userSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  email: String,
  passHash: String,
  verified: Boolean,
  isAdmin: { type: Boolean, default: false },
  verifyToken: String,
  verifyExpires: Date,
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

async function createAdmin() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: 'admin@mail' });
    
    // Hash the password
    const passHash = await bcrypt.hash('111', 10);

    if (existingAdmin) {
      console.log('Admin user exists, updating...');
      // Update existing admin
      await User.updateOne(
        { email: 'admin@mail' },
        { 
          passHash: passHash,
          verified: true,
          isAdmin: true,
          verifyToken: undefined,
          verifyExpires: undefined
        }
      );
      console.log('✅ Admin user updated successfully!');
    } else {
      // Create new admin user
      const admin = new User({
        firstName: 'Admin',
        lastName: 'User',
        email: 'admin@mail',
        passHash: passHash,
        verified: true,
        isAdmin: true,
        verifyToken: undefined,
        verifyExpires: undefined
      });

      await admin.save();
      console.log('✅ Admin user created successfully!');
    }
    console.log('📧 Email: admin@mail');
    console.log('� Password: 111');
    console.log('� Admin flag: true');
    
  } catch (error) {
    console.error('❌ Error creating admin user:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

createAdmin();