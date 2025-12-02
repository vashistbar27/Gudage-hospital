const mongoose = require('mongoose');

async function testConnection() {
  try {
    console.log('🔗 Testing MongoDB connection...');
    
    // Connect to MongoDB
    await mongoose.connect('mongodb://localhost:27017/medicover', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('✅ SUCCESS: MongoDB connected successfully!');
    console.log('📊 Database: medicover');
    console.log('🌐 Host: localhost:27017');

    // Test by creating a sample document
    const testSchema = new mongoose.Schema({
      name: String,
      timestamp: { type: Date, default: Date.now }
    });

    const TestModel = mongoose.model('Test', testSchema);
    
    // Create a test document
    const testDoc = await TestModel.create({ 
      name: 'Medicover Test Connection' 
    });
    
    console.log('✅ SUCCESS: Test document created:', testDoc);

    // List all databases
    const adminDb = mongoose.connection.db.admin();
    const databases = await adminDb.listDatabases();
    
    console.log('\n📋 Available databases:');
    databases.databases.forEach(db => {
      console.log(`   - ${db.name} (Size: ${(db.sizeOnDisk / 1024 / 1024).toFixed(2)} MB)`);
    });

    // Close connection
    await mongoose.connection.close();
    console.log('\n🎉 MongoDB test completed successfully!');
    console.log('🚀 Your database is ready for the Medicover project!');

  } catch (error) {
    console.log('❌ ERROR: MongoDB connection failed!');
    console.log('💡 Error details:', error.message);
    console.log('\n🔧 Troubleshooting tips:');
    console.log('1. Make sure MongoDB Compass is connected to localhost:27017');
    console.log('2. Make sure mongod process is running');
    console.log('3. Try: mongod --dbpath="C:\\data\\db" in another terminal');
  }
}

// Run the test
testConnection();