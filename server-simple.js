import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// In-memory user database
const users = {};

// Ultra-simple CORS middleware
app.use((req, res, next) => {
  console.log(`📨 Incoming: ${req.method} ${req.path}`);
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,HEAD,OPTIONS,POST,PUT,DELETE,PATCH');
  res.header('Access-Control-Allow-Headers', 'Origin,X-Requested-With,Content-Type,Accept,Authorization');
  res.header('Access-Control-Allow-Credentials', 'false');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Root
app.get('/', (req, res) => {
  res.json({ message: 'Backend is working', status: 'OK' });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Backend is running' });
});

// Register
app.post('/api/auth/register', (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      return res.status(400).json({ 
        success: false,
        message: 'Email and password required' 
      });
    }

    if (password.length < 6) {
      return res.status(400).json({ 
        success: false,
        message: 'Password must be 6+ characters' 
      });
    }

    if (users[email]) {
      return res.status(400).json({ 
        success: false,
        message: 'User already exists' 
      });
    }

    const userId = Date.now().toString();
    users[email] = {
      id: userId,
      email,
      password,
      name: name || email.split('@')[0]
    };

    res.status(201).json({
      success: true,
      message: 'Registered successfully',
      token: `token-${userId}`,
      user: {
        id: userId,
        email,
        name: name || email.split('@')[0]
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Registration failed: ' + error.message 
    });
  }
});

// Login
app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ 
        success: false,
        message: 'Email and password required' 
      });
    }

    const user = users[email];
    if (!user || user.password !== password) {
      return res.status(401).json({ 
        success: false,
        message: 'Invalid credentials' 
      });
    }

    res.json({
      success: true,
      message: 'Login successful',
      token: `token-${user.id}`,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Login failed: ' + error.message 
    });
  }
});

// Get user profile
app.get('/api/auth/me', (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ 
        success: false,
        message: 'No token provided' 
      });
    }

    // Extract user ID from token (token format: token-{userId})
    const userId = token.split('-')[1];
    
    // Find user by ID
    let user = null;
    for (const email in users) {
      if (users[email].id === userId) {
        user = users[email];
        break;
      }
    }

    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        mobileNumber: user.mobileNumber || '',
        alternativeNumber: user.alternativeNumber || '',
        aadharNumber: user.aadharNumber || '',
        avatar: user.avatar || null
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Failed to get profile: ' + error.message 
    });
  }
});

// Update user profile
app.post('/api/auth/update-profile', (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ 
        success: false,
        message: 'No token provided' 
      });
    }

    // Extract user ID from token
    const userId = token.split('-')[1];
    
    // Find user by ID
    let user = null;
    let userEmail = null;
    for (const email in users) {
      if (users[email].id === userId) {
        user = users[email];
        userEmail = email;
        break;
      }
    }

    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    // Update user fields
    const { name, email, mobileNumber, alternativeNumber, aadharNumber, avatar } = req.body;
    
    if (name) user.name = name;
    if (email && email !== userEmail) {
      // Check if new email already exists
      if (users[email]) {
        return res.status(400).json({ 
          success: false,
          message: 'Email already in use' 
        });
      }
      // Move user to new email key
      users[email] = user;
      delete users[userEmail];
    }
    if (mobileNumber !== undefined) user.mobileNumber = mobileNumber;
    if (alternativeNumber !== undefined) user.alternativeNumber = alternativeNumber;
    if (aadharNumber !== undefined) user.aadharNumber = aadharNumber;
    if (avatar !== undefined) user.avatar = avatar;

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        mobileNumber: user.mobileNumber || '',
        alternativeNumber: user.alternativeNumber || '',
        aadharNumber: user.aadharNumber || '',
        avatar: user.avatar || null
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Profile update failed: ' + error.message 
    });
  }
});

// Forgot password
app.post('/api/auth/forgot-password', (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ 
        success: false,
        message: 'Email is required' 
      });
    }

    if (!users[email]) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    res.json({
      success: true,
      message: 'Password reset email sent (demo mode)'
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Forgot password failed: ' + error.message 
    });
  }
});

// Logout
app.post('/api/auth/logout', (req, res) => {
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

// 404
app.use((req, res) => {
  res.status(404).json({ 
    success: false,
    message: 'Not found' 
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    success: false,
    message: 'Server error' 
  });
});

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🔗 API URL: http://localhost:${PORT}/api`);
});

export default app;
