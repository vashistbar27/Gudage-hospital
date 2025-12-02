import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import morgan from 'morgan';
import nodemailer from 'nodemailer';
import os from 'os'; // Import the os module
import authRoutes from './routes/auth.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Get your local IP address for network access
const networkInterfaces = os.networkInterfaces();
let localIP = '192.168.1.4'; // Default fallback

// Find the local IP address automatically
Object.keys(networkInterfaces).forEach((interfaceName) => {
  networkInterfaces[interfaceName].forEach((netInterface) => {
    if (netInterface.family === 'IPv4' && !netInterface.internal && netInterface.address.startsWith('192.168.')) {
      localIP = netInterface.address;
    }
  });
});

console.log(`🌐 Detected Local IP: ${localIP}`);

// Configure allowed origins for multi-device access
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  `http://${localIP}:5173`,
  `http://${localIP}:3000`,
  'http://localhost:5000',
  `http://${localIP}:5000`,
  'https://frontend-5e8w8456g-rinabartemp05-1146s-projects.vercel.app',
  'https://frontend-oukmc3i0x-rinabartemp05-1146s-projects.vercel.app'
  // Add Vercel or other deployment URLs if needed
];

// Middleware - Order matters!
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  }
}));

// CORS configuration for multi-device testing
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, postman)
    if (!origin) return callback(null, true);
    
    // Allow all localhost and local network IPs
    if (
      origin.includes('localhost') || 
      origin.includes('127.0.0.1') || 
      origin.includes(localIP) ||
      origin.includes('192.168.')
    ) {
      return callback(null, true);
    }
    
    // Check against allowed origins list
    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    }
    
    // For development, you can be more permissive
    if (process.env.NODE_ENV === 'development') {
      console.log(`⚠️  Allowing origin in dev: ${origin}`);
      return callback(null, true);
    }
    
    // Block in production
    const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
    console.log(`❌ Blocked origin: ${origin}`);
    return callback(new Error(msg), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  maxAge: 86400
}));

// Logging middleware
app.use(morgan(process.env.ENABLE_REQUEST_LOGGING === 'true' ? 'dev' : 'combined'));

// Increase payload size limit for profile picture uploads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// MongoDB Connection with better error handling
let isMongoConnected = false;

const connectToDatabase = async () => {
  if (process.env.MONGODB_URI && !process.env.MONGODB_URI.includes('xxxxx')) {
    const mongooseOptions = {
      serverSelectionTimeoutMS: 10000, // 10 seconds timeout
      socketTimeoutMS: 45000, // 45 seconds socket timeout
      connectTimeoutMS: 10000, // 10 seconds connection timeout
      maxPoolSize: 10, // Maintain up to 10 socket connections
      retryWrites: true,
      w: 'majority'
    };

    // Check if password placeholder is still in connection string
    if (process.env.MONGODB_URI.includes('YOUR_PASSWORD_HERE') || 
        process.env.MONGODB_URI.includes('<db_password>') ||
        process.env.MONGODB_URI.includes('your-actual-password')) {
      console.log('⚠️  MONGODB_URI contains password placeholder!');
      console.log('💡 Running in demo mode without database');
      return;
    }

    try {
      await mongoose.connect(process.env.MONGODB_URI, mongooseOptions);
      console.log('✅ MongoDB Connected Successfully');
      console.log(`📊 Database: ${mongoose.connection.name}`);
      console.log(`🌐 Host: ${mongoose.connection.host}`);
      isMongoConnected = true;
    } catch (err) {
      console.log('❌ MongoDB Connection Error:', err.message);
      
      // Specific error messages for common issues
      if (err.message.includes('ENOTFOUND') || err.message.includes('querySrv')) {
        console.log('💡 DNS Resolution Error - Try these fixes:');
        console.log('   1. Check MongoDB Atlas → Network Access → Add IP Address (0.0.0.0/0 for testing)');
        console.log('   2. Verify your internet connection');
        console.log('   3. Try using standard connection string instead of SRV');
      } else if (err.message.includes('authentication failed') || err.message.includes('bad auth')) {
        console.log('💡 Authentication Error - Check:');
        console.log('   1. Database username is correct');
        console.log('   2. Database password is correct (no placeholder)');
        console.log('   3. URL-encode special characters in password (@ → %40, # → %23)');
      } else {
        console.log('💡 Troubleshooting steps:');
        console.log('   1. Check MongoDB Atlas → Network Access → IP Whitelist');
        console.log('   2. Verify MONGODB_URI in .env file is correct');
        console.log('   3. Ensure database user password is correct');
        console.log('   4. Check your internet connection');
      }
      console.log('💡 Running in demo mode without database');
    }
  } else {
    console.log('ℹ️  MongoDB URI not configured - running in demo mode');
  }
};

// Connect to database
connectToDatabase();

// Email configuration with better error handling
let isEmailConfigured = false;
let transporter = null;

const setupEmail = () => {
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS && 
      !process.env.EMAIL_USER.includes('your-actual-email')) {
    transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: process.env.EMAIL_PORT || 587,
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      },
      tls: {
        rejectUnauthorized: false // For development only
      }
    });

    // Test email configuration
    transporter.verify((error, success) => {
      if (error) {
        console.log('❌ Email configuration error:', error.message);
        console.log('💡 Make sure you are using an App Password, not your regular Gmail password');
        console.log('💡 Enable 2FA and generate App Password: https://support.google.com/accounts/answer/185833');
        console.log('💡 Login notifications will be simulated');
      } else {
        console.log('✅ Email server is ready to send messages');
        isEmailConfigured = true;
      }
    });
  } else {
    console.log('ℹ️  Email not configured - login notifications will be simulated');
  }
};

setupEmail();

// Login notification endpoint with fallback
app.post('/api/auth/send-login-notification', async (req, res) => {
  try {
    const { email, timestamp, deviceType, browser, ipAddress, location, loginType } = req.body;

    if (!email) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email is required' 
      });
    }

    // Check if email is configured and working
    if (!isEmailConfigured || !transporter) {
      console.log(`📧 Email not configured, simulating notification for: ${email}`);
      return res.json({ 
        success: true, 
        message: 'Login notification simulated (email not configured)',
        simulated: true,
        data: {
          email,
          timestamp: timestamp || new Date().toISOString(),
          deviceType: deviceType || 'Unknown',
          browser: browser || 'Unknown',
          ipAddress: ipAddress || req.ip,
          location: location || 'Unknown',
          loginType: loginType || 'user'
        }
      });
    }

    const mailOptions = {
      from: `"${process.env.FROM_NAME || 'Medicover Security'}" <${process.env.FROM_EMAIL || process.env.EMAIL_USER}>`,
      to: email,
      subject: loginType === 'admin' ? 'Admin Login Detected - Medicover' : 'New Login Detected - Medicover',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #2563eb, #1d4ed8); padding: 30px; text-align: center; color: white;">
            <h1 style="margin: 0; font-size: 28px;">Medicover Healthcare</h1>
            <p style="margin: 5px 0 0 0; opacity: 0.9;">Security Notification</p>
          </div>
          
          <div style="padding: 30px;">
            <h2 style="color: #2563eb; margin-bottom: 20px;">
              ${loginType === 'admin' ? 'Admin Login Detected' : 'New Login Detected'}
            </h2>
            <p>We detected a new login to your ${loginType === 'admin' ? 'Medicover Admin' : 'Medicover'} account:</p>
            
            <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2563eb;">
              <p style="margin: 8px 0;"><strong>Time:</strong> ${new Date(timestamp || Date.now()).toLocaleString()}</p>
              <p style="margin: 8px 0;"><strong>Device:</strong> ${deviceType || 'Unknown'}</p>
              <p style="margin: 8px 0;"><strong>Browser:</strong> ${browser || 'Unknown'}</p>
              <p style="margin: 8px 0;"><strong>IP Address:</strong> ${ipAddress || req.ip}</p>
              <p style="margin: 8px 0;"><strong>Location:</strong> ${location || 'Unknown'}</p>
            </div>
            
            <p>If this was you, you can safely ignore this email.</p>
          </div>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    
    console.log(`✅ Login notification sent to: ${email} (${loginType || 'user'})`);
    
    res.json({ 
      success: true, 
      message: 'Login notification sent successfully' 
    });
    
  } catch (error) {
    console.error('❌ Error sending login notification:', error.message);
    
    // Even if email fails, return success so login can continue
    res.json({ 
      success: true, 
      message: 'Login continued (email notification failed)',
      simulated: true,
      error: error.message
    });
  }
});

// Health check with service status
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Medicover Healthcare API Server is Running!',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    server_ip: localIP,
    client_ip: req.ip,
    services: {
      database: isMongoConnected ? 'Connected' : 'Not connected (Demo Mode)',
      email: isEmailConfigured ? 'Configured' : 'Not configured (Simulated)',
      jwt: process.env.JWT_SECRET ? 'Configured' : 'Not configured'
    },
    urls: {
      local: `http://localhost:${PORT}`,
      network: `http://${localIP}:${PORT}`,
      frontend: `http://${localIP}:5173`
    },
    demo: 'Ready for presentation!'
  });
});

// Test endpoint - temporary route to verify backend is reachable
app.get('/api/test', (req, res) => {
  res.json({ 
    message: "Backend Working Perfectly!",
    server_ip: localIP,
    client_ip: req.ip,
    timestamp: new Date().toISOString(),
    headers: req.headers,
    access_urls: [
      `http://localhost:${PORT}/api/test`,
      `http://${localIP}:${PORT}/api/test`,
      `http://localhost:5173 -> Frontend`,
      `http://${localIP}:5173 -> Frontend (Mobile Access)`
    ]
  });
});

// Services endpoint
app.get('/api/services', (req, res) => {
  res.json({
    success: true,
    services: [
      { id: 1, name: 'Doctor at Home', description: 'Professional doctors at your doorstep', icon: '🏠' },
      { id: 2, name: 'Nursing Care', description: 'Qualified nursing services', icon: '👩‍⚕️' },
      { id: 3, name: 'Medicine Delivery', description: 'Fast medicine delivery', icon: '💊' },
      { id: 4, name: 'Lab Tests', description: 'Home sample collection', icon: '🧪' },
      { id: 5, name: 'Tele Consultation', description: 'Online doctor consultations', icon: '📱' },
      { id: 6, name: 'Health Attendant', description: 'Personal health assistants', icon: '👨‍⚕️' }
    ]
  });
});

// Users endpoint
app.get('/api/users', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Users API is working',
    data: [
      { id: 1, name: 'Demo User', email: 'user@demo.com', role: 'patient' },
      { id: 2, name: 'Demo Doctor', email: 'doctor@demo.com', role: 'doctor' },
      { id: 3, name: 'Admin Demo', email: 'admin@demo.com', role: 'admin' }
    ]
  });
});

// Appointments endpoint
app.get('/api/appointments', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Appointments API is working',
    data: [
      { id: 1, patient: 'John Doe', doctor: 'Dr. Smith', date: '2024-01-15', status: 'confirmed' },
      { id: 2, patient: 'Jane Smith', doctor: 'Dr. Johnson', date: '2024-01-16', status: 'pending' }
    ]
  });
});

// Cities endpoint
app.get('/api/cities', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Cities API is working',
    data: [
      'Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai', 
      'Kolkata', 'Pune', 'Ahmedabad', 'Jaipur', 'Lucknow'
    ]
  });
});

// Testimonials endpoint
app.get('/api/testimonials', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Testimonials API is working',
    data: [
      { id: 1, name: 'Rajesh Kumar', review: 'Excellent service! Doctor arrived within 30 minutes.', rating: 5 },
      { id: 2, name: 'Priya Sharma', review: 'Very professional nursing care for my mother.', rating: 4 },
      { id: 3, name: 'Amit Patel', review: 'Medicine delivery was fast and reliable.', rating: 5 }
    ]
  });
});

// Network info endpoint for debugging
app.get('/api/network-info', (req, res) => {
  const networkInfo = {};
  
  Object.keys(networkInterfaces).forEach(name => {
    networkInfo[name] = networkInterfaces[name].map(netInterface => ({
      address: netInterface.address,
      family: netInterface.family,
      internal: netInterface.internal
    }));
  });
  
  res.json({
    local_ip: localIP,
    server_port: PORT,
    client_ip: req.ip,
    network_interfaces: networkInfo,
    access_urls: {
      backend_local: `http://localhost:${PORT}`,
      backend_network: `http://${localIP}:${PORT}`,
      frontend_local: 'http://localhost:5173',
      frontend_network: `http://${localIP}:5173`,
      api_health: `http://${localIP}:${PORT}/api/health`,
      api_test: `http://${localIP}:${PORT}/api/test`
    },
    instructions: {
      mobile_access: `Use http://${localIP}:5173 on your mobile browser`,
      other_pc_access: `Use http://${localIP}:5173 on any device on same WiFi`
    }
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: '🚀 Medicover Healthcare API Server',
    version: '1.0.0',
    status: 'Running Successfully!',
    environment: process.env.NODE_ENV || 'development',
    network_access: `Available at http://${localIP}:${PORT}`,
    services: {
      database: isMongoConnected ? '✅ Connected' : '⚠️ Demo Mode',
      email: isEmailConfigured ? '✅ Configured' : '⚠️ Simulated',
      api: '✅ Running',
      cors: '✅ Multi-device Enabled'
    },
    endpoints: [
      'GET  /api/health - Service status',
      'GET  /api/test - Test connection',
      'GET  /api/network-info - Network debug info',
      'POST /api/auth/send-login-notification - Login alerts',
      'POST /api/auth/login - User login',
      'POST /api/auth/register - User registration',
      'POST /api/auth/update-profile - Profile updates',
      'GET  /api/auth/profile - Get profile',
      'GET  /api/services - Medical services',
      'GET  /api/users - Users list',
      'GET  /api/appointments - Appointments',
      'GET  /api/cities - Available cities',
      'GET  /api/testimonials - Customer reviews'
    ],
    mobile_access: `Access from mobile: http://${localIP}:5173`,
    demo: 'Ready for your project presentation! 🎉'
  });
});

// Auth Routes
app.use('/api/auth', authRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.originalUrl,
    method: req.method,
    server_ip: localIP,
    availableEndpoints: [
      'GET  /',
      'GET  /api/health',
      'GET  /api/test',
      'GET  /api/network-info',
      'POST /api/auth/send-login-notification',
      'POST /api/auth/register',
      'POST /api/auth/login',
      'GET  /api/services',
      'GET  /api/users',
      'GET  /api/appointments',
      'GET  /api/cities',
      'GET  /api/testimonials'
    ],
    help: `Check if you can access: http://${localIP}:${PORT}/api/health`
  });
});

// Error Handler
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
    server_ip: localIP
  });
});

// Start server
const HOST = '0.0.0.0';  // Listen on all network interfaces

app.listen(PORT, HOST, () => {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 MEDICOVER HEALTHCARE SERVER STARTED');
  console.log('='.repeat(60));
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔌 Port: ${PORT}`);
  console.log(`🌐 Host: ${HOST}`);
  console.log(`📡 Local IP: ${localIP}`);
  console.log('');
  console.log('🔗 ACCESS URLs:');
  console.log(`   Local:      http://localhost:${PORT}`);
  console.log(`   Network:    http://${localIP}:${PORT}`);
  console.log('');
  console.log('📱 FRONTEND URLs (for mobile/other devices):');
  console.log(`   Local:      http://localhost:5173`);
  console.log(`   Network:    http://${localIP}:5173`);
  console.log('');
  console.log('✅ TEST ENDPOINTS:');
  console.log(`   Health:     http://${localIP}:${PORT}/api/health`);
  console.log(`   Test:       http://${localIP}:${PORT}/api/test`);
  console.log(`   Network:    http://${localIP}:${PORT}/api/network-info`);
  console.log('');
  console.log('🛠️  SERVICES STATUS:');
  console.log(`   Database:   ${isMongoConnected ? '✅ CONNECTED' : '⚠️ DEMO MODE'}`);
  console.log(`   Email:      ${isEmailConfigured ? '✅ CONFIGURED' : '⚠️ SIMULATED'}`);
  console.log(`   JWT:        ${process.env.JWT_SECRET ? '✅ CONFIGURED' : '⚠️ NOT CONFIGURED'}`);
  console.log('');
  console.log('📢 INSTRUCTIONS:');
  console.log('   1. On mobile/other device, open browser');
  console.log(`   2. Visit: http://${localIP}:5173`);
  console.log('   3. Make sure device is on same WiFi network');
  console.log('='.repeat(60) + '\n');
});

export default app;