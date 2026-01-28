const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const bodyParser = require("body-parser");
const bcrypt = require("bcryptjs");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { body, validationResult } = require("express-validator");
const mongoSanitize = require("mongo-sanitize");
const xss = require("xss");
const compression = require("compression");
const nodemailer = require("nodemailer");
const SecureEmailCredentials = require("./secure-email-credentials");

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy for Render.com and other reverse proxies
app.set('trust proxy', true);

// Performance middleware
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  level: 6,
  threshold: 1024
}));

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
    },
  },
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { error: "Too many requests from this IP, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
  trustProxy: true, // Important for Render.com
  keyGenerator: (req) => {
    return req.ip || req.connection.remoteAddress;
  }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 login attempts per windowMs
  message: { error: "Too many login attempts, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
  trustProxy: true, // Important for Render.com
  keyGenerator: (req) => {
    return req.ip || req.connection.remoteAddress;
  }
});

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? false : true,
  credentials: true,
  optionsSuccessStatus: 200
}));

// Body parsing middleware with security
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Input sanitization middleware
app.use((req, res, next) => {
  // Sanitize request body
  if (req.body) {
    req.body = sanitizeInput(req.body);
  }
  
  // Sanitize query parameters
  if (req.query) {
    req.query = sanitizeInput(req.query);
  }
  
  // Sanitize URL parameters
  if (req.params) {
    req.params = sanitizeInput(req.params);
  }
  
  next();
});

// Static files with security headers
app.use(express.static(".", {
  setHeaders: (res, path) => {
    if (path.endsWith('.html')) {
      res.setHeader('X-Content-Type-Options', 'nosniff');
    }
  }
}));

// Input sanitization function
function sanitizeInput(obj) {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeInput(item));
  }
  
  const sanitized = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      // Sanitize key
      const sanitizedKey = key.replace(/[^a-zA-Z0-9_]/g, '');
      
      // Sanitize value based on type
      if (typeof obj[key] === 'string') {
        // Prevent NoSQL injection
        let sanitizedValue = mongoSanitize(obj[key]);
        // Prevent XSS
        sanitizedValue = xss(sanitizedValue, {
          whiteList: {}, // No HTML tags allowed
          stripIgnoreTag: true,
          stripIgnoreTagBody: ['script']
        });
        // Limit length
        if (sanitizedValue.length > 10000) {
          sanitizedValue = sanitizedValue.substring(0, 10000);
        }
        sanitized[sanitizedKey] = sanitizedValue;
      } else if (typeof obj[key] === 'object') {
        sanitized[sanitizedKey] = sanitizeInput(obj[key]);
      } else {
        sanitized[sanitizedKey] = obj[key];
      }
    }
  }
  
  return sanitized;
}

const CONTACTS_FILE = path.join(__dirname, "assets", "contacts.json");
const ADMIN_CREDENTIALS_FILE = path.join(__dirname, "assets", "admin-credentials.json");
const PROFILE_FILE = path.join(__dirname, "assets", "profile.json");

// Initialize secure email credentials
const emailCredentials = new SecureEmailCredentials();

// Email configuration with encrypted credentials (for all environments)
let transporter = null;

// Initialize admin credentials if not exists
const initAdminCredentials = async () => {
  try {
    // Ensure assets directory exists
    const assetsDir = path.dirname(ADMIN_CREDENTIALS_FILE);
    if (!fs.existsSync(assetsDir)) {
      console.log('📁 Creating assets directory...');
      fs.mkdirSync(assetsDir, { recursive: true });
    }
    
    if (!fs.existsSync(ADMIN_CREDENTIALS_FILE)) {
      console.log('🔧 Creating default admin credentials...');
      
      const defaultCredentials = {
        username: 'admin',
        passwordHash: await bcrypt.hash('admin123', 12),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        updatedBy: 'system',
        updatedFrom: 'auto-setup'
      };
      
      fs.writeFileSync(ADMIN_CREDENTIALS_FILE, JSON.stringify(defaultCredentials, null, 2));
      console.log('✅ Default admin credentials created');
      console.log('👤 Username: admin');
      console.log('🔑 Password: admin123');
      console.log(`📁 File location: ${ADMIN_CREDENTIALS_FILE}`);
    } else {
      console.log('✅ Admin credentials file already exists');
    }
  } catch (error) {
    console.error('❌ Error initializing admin credentials:', error);
  }
};

// Initialize email transporter with encrypted credentials
const initializeEmailTransporter = () => {
  const credentials = emailCredentials.getCredentials();
  
  if (credentials) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: credentials.user,
        pass: credentials.password
      },
      pool: true, // Use connection pooling
      maxConnections: 1,
      maxMessages: 5,
      rateDelta: 1000, // 1000ms between messages
      rateLimit: 5, // max 5 messages per second
      connectionTimeout: 60000, // 60 seconds
      greetingTimeout: 30000, // 30 seconds
      socketTimeout: 60000 // 60 seconds
    });
    
    console.log(`🔐 Email transporter initialized with encrypted credentials for ${credentials.user}`);
    return true;
  } else {
    console.log('❌ Failed to initialize email transporter - invalid credentials');
    return false;
  }
};

// Verify email configuration on startup
const verifyEmailConfiguration = () => {
  if (transporter) {
    transporter.verify((error, success) => {
      if (error) {
        console.error('❌ Email configuration error:', error.message);
        console.log('📧 Email service will be disabled');
      } else {
        console.log('✅ Email server is ready to send messages');
      }
    });
  } else {
    console.log('📧 Email service not available - no valid credentials');
  }
};

// Email sending function with retry logic
const sendContactEmail = async (contactData, retryCount = 0) => {
  const maxRetries = 2;
  
  try {
    // Check if transporter is available
    if (!transporter) {
      throw new Error('Email transporter not initialized');
    }

    const credentials = emailCredentials.getCredentials();
    if (!credentials) {
      throw new Error('Email credentials not available');
    }

    const mailOptions = {
      from: `"Portfolio Contact Form" <${credentials.user}>`,
      to: credentials.user, // Send to the same email account
      subject: `📧 New Contact Message from ${contactData.name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
          <div style="background-color: #ff6b3d; color: white; padding: 20px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="margin: 0; font-size: 24px;">📧 New Contact Message</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Portfolio Contact Form Submission</p>
          </div>
          
          <div style="background-color: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <div style="margin-bottom: 20px;">
              <h3 style="color: #333; margin-bottom: 5px;">👤 Contact Information</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold; width: 120px;">Name:</td>
                  <td style="padding: 10px; border-bottom: 1px solid #eee;">${contactData.name}</td>
                </tr>
                <tr>
                  <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold;">Email:</td>
                  <td style="padding: 10px; border-bottom: 1px solid #eee;">
                    <a href="mailto:${contactData.email}" style="color: #ff6b3d; text-decoration: none;">${contactData.email}</a>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold;">Date:</td>
                  <td style="padding: 10px; border-bottom: 1px solid #eee;">${new Date(contactData.timestamp).toLocaleString()}</td>
                </tr>
                ${contactData.ip ? `
                <tr>
                  <td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold;">IP Address:</td>
                  <td style="padding: 10px; border-bottom: 1px solid #eee;">${contactData.ip}</td>
                </tr>
                ` : ''}
              </table>
            </div>
            
            <div style="margin-bottom: 20px;">
              <h3 style="color: #333; margin-bottom: 10px;">💬 Message</h3>
              <div style="background-color: #f8f9fa; padding: 15px; border-left: 4px solid #ff6b3d; border-radius: 5px;">
                <p style="margin: 0; line-height: 1.6; color: #333;">${contactData.message}</p>
              </div>
            </div>
            
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
              <p style="margin: 0; color: #666; font-size: 14px;">
                This message was sent from your portfolio website<br>
                <a href="http://localhost:3000" style="color: #ff6b3d; text-decoration: none;">View Portfolio</a>
              </p>
            </div>
          </div>
        </div>
      `,
      text: `
        New Contact Message from Portfolio Website
        
        Name: ${contactData.name}
        Email: ${contactData.email}
        Date: ${new Date(contactData.timestamp).toLocaleString()}
        ${contactData.ip ? `IP Address: ${contactData.ip}` : ''}
        
        Message:
        ${contactData.message}
        
        ---
        This message was sent from your portfolio website
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`❌ Email sending error (attempt ${retryCount + 1}):`, error.message);
    
    // Retry logic
    if (retryCount < maxRetries) {
      console.log(`🔄 Retrying email send in 2 seconds...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      return sendContactEmail(contactData, retryCount + 1);
    }
    
    // Final failure
    console.error('❌ All email retries failed');
    return { success: false, error: error.message };
  }
};

// Session storage (in production, use proper session management)
const sessions = new Map();

// Authentication middleware
const requireAuth = (req, res, next) => {
  const sessionId = req.headers.authorization || 
                    req.headers['x-session-id'] ||
                    req.cookies?.adminSession;
  
  console.log('🔍 requireAuth - Session ID:', sessionId);
  console.log('🔍 requireAuth - Cookie session:', req.cookies?.adminSession);
  console.log('🔍 requireAuth - Available sessions:', Array.from(sessions.keys()));
  
  if (!sessionId || !sessions.has(sessionId)) {
    console.log('❌ requireAuth - Authentication required');
    return res.status(401).json({ error: "Authentication required" });
  }
  
  const session = sessions.get(sessionId);
  if (session.expiresAt < Date.now()) {
    console.log('❌ requireAuth - Session expired');
    sessions.delete(sessionId);
    return res.status(401).json({ error: "Session expired" });
  }
  
  // Extend session
  session.expiresAt = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
  next();
};

// Ensure contacts file exists
const initContactsFile = () => {
  const assetsDir = path.join(__dirname, "assets");
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }
  if (!fs.existsSync(CONTACTS_FILE)) {
    fs.writeFileSync(CONTACTS_FILE, JSON.stringify([], null, 2));
  }
};

// Profile data with caching
let profileCache = null;
let profileCacheTime = 0;
const PROFILE_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

app.get("/api/profile", limiter, (req, res) => {
  try {
    // Check cache first
    const now = Date.now();
    if (profileCache && (now - profileCacheTime) < PROFILE_CACHE_DURATION) {
      return res.json({
        profile: profileCache,
        source: "cache",
        cachedAt: new Date(profileCacheTime).toISOString()
      });
    }

    // Read profile file
    if (!fs.existsSync(PROFILE_FILE)) {
      return res.status(404).json({ error: "Profile data not found" });
    }

    const profileData = JSON.parse(fs.readFileSync(PROFILE_FILE, "utf8"));
    
    // Update cache
    profileCache = profileData;
    profileCacheTime = now;

    res.json({
      profile: profileData,
      source: "file",
      loadedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error loading profile:", error);
    res.status(500).json({ error: "Failed to load profile data" });
  }
});

// Login page
app.get("/login", limiter, (req, res) => {
  res.sendFile(path.join(__dirname, "login.html"));
});

// Apply general rate limiting to all routes
app.use(limiter);

// Protected admin routes redirect to login if not authenticated
app.use("/admin", (req, res, next) => {
  // Skip authentication for static files (CSS, JS, images)
  if (req.url.includes('.') && !req.url.includes('.html')) {
    return next();
  }
  
  // Check for session in headers (API calls), query parameters, or cookies
  const sessionId = req.headers.authorization || 
                    req.headers['x-session-id'] || 
                    req.query.session ||
                    req.cookies?.adminSession;
  
  console.log('🔍 Admin middleware - Request URL:', req.url);
  console.log('🔍 Admin middleware - Session ID:', sessionId);
  console.log('🔍 Admin middleware - Cookie session:', req.cookies?.adminSession);
  console.log('🔍 Admin middleware - Available sessions:', Array.from(sessions.keys()));
  
  if (!sessionId || !sessions.has(sessionId)) {
    console.log('❌ Session not found, redirecting to login');
    return res.redirect('/login');
  }
  
  const session = sessions.get(sessionId);
  if (session.expiresAt < Date.now()) {
    console.log('❌ Session expired, redirecting to login');
    sessions.delete(sessionId);
    return res.redirect('/login');
  }
  
  console.log('✅ Session valid, proceeding to admin page');
  next();
});

// Authentication routes
app.post("/api/login", authLimiter, [
  body('username')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Username must be between 1 and 50 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores'),
  body('password')
    .isLength({ min: 1, max: 100 })
    .withMessage('Password must be between 1 and 100 characters')
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: "Validation failed", 
        details: errors.array() 
      });
    }

    const { username, password } = req.body;
    
    if (!fs.existsSync(ADMIN_CREDENTIALS_FILE)) {
      return res.status(500).json({ error: "Admin credentials not configured" });
    }
    
    const credentials = JSON.parse(fs.readFileSync(ADMIN_CREDENTIALS_FILE, "utf8"));
    
    if (username !== credentials.username) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    
    const isPasswordValid = await bcrypt.compare(password, credentials.passwordHash);
    
    if (!isPasswordValid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    
    // Create session
    const sessionId = Math.random().toString(36).substring(2) + Date.now().toString(36);
    sessions.set(sessionId, {
      username: credentials.username,
      createdAt: Date.now(),
      expiresAt: Date.now() + (24 * 60 * 60 * 1000), // 24 hours
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    // Set session in cookie and return in response
    res.cookie('adminSession', sessionId, { 
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });
    
    console.log(`✅ User logged in: ${username} from ${req.ip}`);
    
    res.json({
      success: true,
      message: "Login successful",
      sessionId,
      username: credentials.username
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
});

app.post("/api/logout", (req, res) => {
  try {
    const sessionId = req.headers.authorization || req.headers['x-session-id'];
    
    if (sessionId && sessions.has(sessionId)) {
      sessions.delete(sessionId);
    }
    
    res.json({ success: true, message: "Logged out successfully" });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ error: "Logout failed" });
  }
});

app.post("/api/change-password", requireAuth, authLimiter, [
  body('currentPassword')
    .isLength({ min: 1, max: 100 })
    .withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 6, max: 100 })
    .withMessage('New password must be between 6 and 100 characters')
    .matches(/^(?=.*[a-zA-Z])(?=.*\d)/)
    .withMessage('New password must contain at least one letter and one number')
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessages = errors.array().map(err => err.msg).join(', ');
      return res.status(400).json({ 
        error: errorMessages,
        details: errors.array() 
      });
    }

    const { currentPassword, newPassword } = req.body;
    
    // Check if admin credentials file exists
    if (!fs.existsSync(ADMIN_CREDENTIALS_FILE)) {
      console.error('❌ Admin credentials file not found during password change');
      return res.status(500).json({ error: "Admin credentials not available" });
    }
    
    // Get session ID from request
    const sessionId = req.headers.authorization || 
                      req.headers['x-session-id'] ||
                      req.cookies?.adminSession;
    
    let credentials;
    try {
      const credentialsData = fs.readFileSync(ADMIN_CREDENTIALS_FILE, "utf8");
      credentials = JSON.parse(credentialsData);
    } catch (error) {
      console.error('❌ Error reading admin credentials:', error);
      return res.status(500).json({ error: "Failed to read credentials" });
    }
    
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, credentials.passwordHash);
    
    if (!isCurrentPasswordValid) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }
    
    // Check if new password is same as current
    const isSamePassword = await bcrypt.compare(newPassword, credentials.passwordHash);
    if (isSamePassword) {
      return res.status(400).json({ error: "New password must be different from current password" });
    }
    
    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 12);
    
    // Get session info safely
    const sessionInfo = sessions.get(sessionId);
    const username = sessionInfo ? sessionInfo.username : 'admin';
    
    // Update credentials
    credentials.passwordHash = newPasswordHash;
    credentials.updatedAt = new Date().toISOString();
    
    if (sessionInfo) {
      credentials.updatedBy = sessionInfo.username;
    } else {
      credentials.updatedBy = 'admin';
    }
    credentials.updatedFrom = req.ip;
    
    // Write updated credentials with error handling
    try {
      fs.writeFileSync(ADMIN_CREDENTIALS_FILE, JSON.stringify(credentials, null, 2));
      console.log(`🔑 Password changed for user: ${username} from ${req.ip}`);
      console.log(`📁 Credentials file updated: ${ADMIN_CREDENTIALS_FILE}`);
    } catch (error) {
      console.error('❌ Error writing updated credentials:', error);
      return res.status(500).json({ error: "Failed to save new password" });
    }
    
    res.json({
      success: true,
      message: "Password changed successfully"
    });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({ error: "Failed to change password" });
  }
});

app.get("/api/auth-check", requireAuth, (req, res) => {
  res.json({ success: true, message: "Authenticated" });
});

// Download all contacts as plain text
app.get("/admin/contacts/download-txt", requireAuth, (req, res) => {
  try {
    if (fs.existsSync(CONTACTS_FILE)) {
      const data = fs.readFileSync(CONTACTS_FILE, "utf8");
      const contacts = JSON.parse(data || "[]");
      let text = contacts.map((c, i) => `#${i + 1}\nName: ${c.name}\nEmail: ${c.email}\nMessage: ${c.message}\nDate: ${c.timestamp ? new Date(c.timestamp).toLocaleString() : ''}\n---`).join("\n\n");
      res.setHeader("Content-Disposition", "attachment; filename=contacts.txt");
      res.setHeader("Content-Type", "text/plain");
      res.send(text);
    } else {
      res.status(404).send("Contacts file not found");
    }
  } catch (error) {
    res.status(500).send("Failed to download contacts as text");
  }
});

// API endpoint to save contact responses
app.post("/api/save-contact", limiter, [
  body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Name must be between 1 and 100 characters')
    .matches(/^[a-zA-Z\s\-'.]+$/)
    .withMessage('Name contains invalid characters'),
  body('email')
    .trim()
    .isEmail()
    .withMessage('Valid email is required')
    .normalizeEmail(),
  body('message')
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage('Message must be between 1 and 1000 characters')
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: "Validation failed", 
        details: errors.array() 
      });
    }

    const { name, email, message, timestamp } = req.body;
    const contactTimestamp = timestamp || new Date().toISOString();

    // Read existing contacts
    let contacts = [];
    if (fs.existsSync(CONTACTS_FILE)) {
      try {
        const data = fs.readFileSync(CONTACTS_FILE, "utf8");
        contacts = JSON.parse(data || "[]");
      } catch (parseError) {
        console.error('Error parsing contacts file:', parseError);
        contacts = [];
      }
    }

    // Add new contact with additional security info
    const newContact = {
      id: Date.now(),
      name: name.substring(0, 100), // Ensure max length
      email: email.toLowerCase().substring(0, 100), // Normalize and limit
      message: message.substring(0, 1000), // Ensure max length
      timestamp: contactTimestamp,
      ip: req.ip,
      userAgent: req.get('User-Agent') ? req.get('User-Agent').substring(0, 500) : 'Unknown'
    };

    contacts.push(newContact);

    // Save to file with error handling
    try {
      fs.writeFileSync(CONTACTS_FILE, JSON.stringify(contacts, null, 2));
    } catch (fileError) {
      console.error('Error saving contacts file:', fileError);
      return res.status(500).json({ error: "Failed to save contact" });
    }

    console.log(`✅ Contact saved: ${name} (${email}) from ${req.ip}`);

    // Send email notification (async, don't wait for it)
    sendContactEmail(newContact).then(emailResult => {
      if (emailResult.success) {
        console.log(`📧 Email notification sent for contact from ${name}`);
      } else {
        console.error(`❌ Failed to send email notification: ${emailResult.error}`);
      }
    }).catch(emailError => {
      console.error('❌ Email sending error:', emailError);
    });

    res.json({
      success: true,
      message: "Contact saved successfully",
      id: newContact.id,
      emailSent: true // Indicate that email was attempted
    });
  } catch (error) {
    console.error("Error saving contact:", error);
    res.status(500).json({ error: "Failed to save contact" });
  }
});

// Health check endpoint for Render.com
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development"
  });
});

// API endpoint to get all contacts (optional - for viewing)
app.get("/api/contacts", (req, res) => {
  try {
    if (fs.existsSync(CONTACTS_FILE)) {
      const data = fs.readFileSync(CONTACTS_FILE, "utf8");
      const contacts = JSON.parse(data || "[]");
      res.json(contacts);
    } else {
      res.json([]);
    }
  } catch (error) {
    console.error("Error reading contacts:", error);
    res.status(500).json({ error: "Failed to read contacts" });
  }
});

// Download contacts as JSON file
app.get("/download-contacts", requireAuth, (req, res) => {
  try {
    if (fs.existsSync(CONTACTS_FILE)) {
      res.download(CONTACTS_FILE, "contacts.json");
    } else {
      res.status(404).json({ error: "Contacts file not found" });
      const CONTACTS_HISTORY_DIR = path.join(__dirname, "assets", "contacts_history");
    }
  } catch (error) {
    console.error("Error downloading contacts:", error);
    res.status(500).json({ error: "Failed to download contacts" });
  }
});

// API endpoint to delete all contacts
app.delete("/api/contacts/delete-all", requireAuth, (req, res) => {
  try {
    if (!fs.existsSync(CONTACTS_FILE)) {
      return res.status(404).json({ error: "Contacts file not found" });
    }

    const data = fs.readFileSync(CONTACTS_FILE, "utf8");
    const contacts = JSON.parse(data || "[]");
    const deletedCount = contacts.length;
    
    // Clear the contacts file
    fs.writeFileSync(CONTACTS_FILE, JSON.stringify([], null, 2));
    
    console.log(`🗑️ All ${deletedCount} contacts deleted`);
    res.json({ 
      success: true, 
      message: "All contacts deleted successfully",
      deleted: deletedCount
    });
  } catch (error) {
    console.error("Error deleting all contacts:", error);
    res.status(500).json({ error: "Failed to delete all contacts" });
  }
});

// API endpoint to delete a specific contact
app.delete("/api/contacts/:id", requireAuth, (req, res) => {
  try {
    const contactId = parseInt(req.params.id);
    
    if (!fs.existsSync(CONTACTS_FILE)) {
      return res.status(404).json({ error: "Contacts file not found" });
    }

    const data = fs.readFileSync(CONTACTS_FILE, "utf8");
    let contacts = JSON.parse(data || "[]");
    
    const initialLength = contacts.length;
    contacts = contacts.filter(contact => contact.id !== contactId);
    
    if (contacts.length === initialLength) {
      return res.status(404).json({ error: "Contact not found" });
    }
    
    fs.writeFileSync(CONTACTS_FILE, JSON.stringify(contacts, null, 2));
    
    console.log(`🗑️ Contact deleted: ID ${contactId}`);
    res.json({ 
      success: true, 
      message: "Contact deleted successfully",
      remaining: contacts.length 
    });
  } catch (error) {
    console.error("Error deleting contact:", error);
    res.status(500).json({ error: "Failed to delete contact" });
  }
});

// Simple admin page to view contacts
app.get("/admin/contacts", requireAuth, (req, res) => {
  try {
    if (fs.existsSync(CONTACTS_FILE)) {
      const data = fs.readFileSync(CONTACTS_FILE, "utf8");
      const contacts = JSON.parse(data || "[]");
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Contact Submissions</title>
          <style>
            body { font-family: Manrope, sans-serif; padding: 2rem; background: #f7f3ef; }
            h1 { color: #ff6b3d; }
            .actions { display: flex; gap: 1rem; align-items: center; margin: 1rem 0; }
            .download-btn { display: inline-block; padding: 0.7rem 1.5rem; background: #ff6b3d; color: #fff; border: none; border-radius: 8px; font-size: 1rem; font-weight: 600; text-decoration: none; transition: background 0.2s; cursor: pointer; }
            .download-btn:hover { background: #ff8c5a; }
            .delete-all-btn { display: inline-block; padding: 0.7rem 1.5rem; background: #dc3545; color: #fff; border: none; border-radius: 8px; font-size: 1rem; font-weight: 600; cursor: pointer; transition: background 0.2s; }
            .delete-all-btn:hover { background: #c82333; }
            .delete-all-btn:disabled { background: #6c757d; cursor: not-allowed; }
            .delete-btn { padding: 0.5rem 1rem; background: #dc3545; color: #fff; border: none; border-radius: 6px; font-size: 0.9rem; cursor: pointer; transition: background 0.2s; }
            .delete-btn:hover { background: #c82333; }
            .delete-btn:disabled { background: #6c757d; cursor: not-allowed; }
            .download-single-btn { padding: 0.5rem 1rem; background: #28a745; color: #fff; border: none; border-radius: 6px; font-size: 0.9rem; cursor: pointer; transition: background 0.2s; margin-right: 0.5rem; }
            .download-single-btn:hover { background: #218838; }
            .download-single-btn:disabled { background: #6c757d; cursor: not-allowed; }
            .actions-cell { min-width: 200px; display: flex; gap: 0.5rem; }
            table { border-collapse: collapse; width: 100%; background: white; border-radius: 12px; overflow: hidden; }
            th, td { padding: 1rem; text-align: left; border-bottom: 1px solid #ddd; }
            th { background: #ff6b3d; color: white; font-weight: 600; }
            tr:hover { background: #fafafa; }
            .message-cell { max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            .toast { position: fixed; top: 20px; right: 20px; padding: 1rem 1.5rem; background: #28a745; color: white; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); z-index: 1000; opacity: 0; transition: opacity 0.3s; }
            .toast.show { opacity: 1; }
            .toast.error { background: #dc3545; }
          </style>
        </head>
        <body>
          <h1>📧 Contact Form Submissions</h1>
          <p>Total: <span id="totalCount">${contacts.length}</span></p>
          
          <div class="actions">
            <a class="download-btn" href="/admin/contacts/download-txt" id="downloadTxtBtn">⬇️ Download All as Text</a>
            <button class="delete-all-btn" id="deleteAllBtn" onclick="deleteAllContacts()">🗑️ Delete All</button>
            <button class="download-btn" onclick="showChangePasswordModal()">🔐 Change Password</button>
            <button class="download-btn" onclick="refreshPage()">🔄 Refresh</button>
            <button class="download-btn" onclick="logout()" style="background: #6c757d;">🚪 Logout</button>
          </div>
          
          <table>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Message</th>
              <th>Date</th>
              <th>Actions</th>
            </tr>
            ${contacts.map(c => `
              <tr id="contact-${c.id}">
                <td>${c.name}</td>
                <td>${c.email}</td>
                <td class="message-cell" title="${c.message || ''}">${c.message ? c.message.substring(0, 50) : ''}...</td>
                <td>${c.timestamp ? new Date(c.timestamp).toLocaleString() : ''}</td>
                <td class="actions-cell">
                  <button class="download-single-btn" onclick="downloadSingleContact(${c.id}, '${(c.name || 'Unknown').replace(/'/g, "\\'")}')" data-id="${c.id}">📥 Download</button>
                  <button class="delete-btn" onclick="deleteContact(${c.id})" data-id="${c.id}">🗑️ Delete</button>
                </td>
              </tr>
            `).join('')}
          </table>
          
          <div id="toast" class="toast"></div>
          
          <!-- Change Password Modal -->
          <div id="changePasswordModal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000; align-items: center; justify-content: center;">
            <div style="background: white; padding: 2rem; border-radius: 12px; max-width: 400px; width: 90%;">
              <h3 style="margin-bottom: 1.5rem; color: #ff6b3d;">🔐 Change Password</h3>
              
              <div style="margin-bottom: 1rem;">
                <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Current Password</label>
                <input type="password" id="currentPassword" style="width: 100%; padding: 0.75rem; border: 2px solid #e9ecef; border-radius: 8px;">
              </div>
              
              <div style="margin-bottom: 1.5rem;">
                <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">New Password</label>
                <input type="password" id="newPassword" style="width: 100%; padding: 0.75rem; border: 2px solid #e9ecef; border-radius: 8px;">
                <small style="color: #6c757d; font-size: 0.85rem; margin-top: 0.25rem; display: block;">
                  🔒 Must contain at least 6 characters, 1 letter, and 1 number
                </small>
              </div>
              
              <div style="display: flex; gap: 1rem; justify-content: flex-end;">
                <button onclick="hideChangePasswordModal()" style="padding: 0.75rem 1.5rem; background: #6c757d; color: white; border: none; border-radius: 6px; cursor: pointer;">Cancel</button>
                <button onclick="changePassword()" style="padding: 0.75rem 1.5rem; background: #ff6b3d; color: white; border: none; border-radius: 6px; cursor: pointer;">Change Password</button>
              </div>
            </div>
          </div>
          
          <script>
            // Get session from URL query parameter, localStorage, or sessionStorage (for refresh)
            const urlParams = new URLSearchParams(window.location.search);
            let sessionId = urlParams.get('session') || localStorage.getItem('adminSession');
            
            // Check if this is a refresh and restore from sessionStorage
            if (!sessionId && sessionStorage.getItem('tempSession')) {
              sessionId = sessionStorage.getItem('tempSession');
              localStorage.setItem('adminSession', sessionId);
              localStorage.setItem('adminUsername', sessionStorage.getItem('tempUsername') || 'admin');
              
              // Clear temporary storage
              sessionStorage.removeItem('tempSession');
              sessionStorage.removeItem('tempUsername');
            }
            
            const adminUsername = localStorage.getItem('adminUsername');
            
            // Store session if it came from URL
            if (urlParams.get('session') && !localStorage.getItem('adminSession')) {
              localStorage.setItem('adminSession', urlParams.get('session'));
            }
            
            // Set session headers for all API calls
            const originalFetch = window.fetch;
            window.fetch = function(url, options = {}) {
              options.headers = options.headers || {};
              if (sessionId) {
                options.headers['Authorization'] = sessionId;
              }
              return originalFetch(url, options);
            };
            
            // Logout function
            async function logout() {
              try {
                await fetch('/api/logout', { method: 'POST' });
              } catch (error) {
                console.error('Logout error:', error);
              } finally {
                localStorage.removeItem('adminSession');
                localStorage.removeItem('adminUsername');
                window.location.href = '/login';
              }
            }
            
            // Change password functions
            function showChangePasswordModal() {
              document.getElementById('changePasswordModal').style.display = 'flex';
            }
            
            function hideChangePasswordModal() {
              document.getElementById('changePasswordModal').style.display = 'none';
              document.getElementById('currentPassword').value = '';
              document.getElementById('newPassword').value = '';
            }
            
            async function changePassword() {
              const currentPassword = document.getElementById('currentPassword').value;
              const newPassword = document.getElementById('newPassword').value;
              
              if (!currentPassword || !newPassword) {
                showToast('Please fill in all fields', 'error');
                return;
              }
              
              if (newPassword.length < 6) {
                showToast('New password must be at least 6 characters', 'error');
                return;
              }
              
              if (!/(?=.*[a-zA-Z])(?=.*\d)/.test(newPassword)) {
                showToast('New password must contain at least one letter and one number', 'error');
                return;
              }
              
              try {
                const response = await fetch('/api/change-password', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ currentPassword, newPassword })
                });
                
                const result = await response.json();
                
                if (response.ok) {
                  showToast('Password changed successfully', 'success');
                  hideChangePasswordModal();
                } else {
                  showToast(result.error || 'Failed to change password', 'error');
                }
              } catch (error) {
                console.error('Change password error:', error);
                showToast('Network error. Please try again', 'error');
              }
            }
            
            async function deleteAllContacts() {
              const totalCount = ${contacts.length};
              
              if (totalCount === 0) {
                showToast('No contacts to delete', 'error');
                return;
              }
              
              if (!confirm('Are you sure you want to delete ALL ' + totalCount + ' contact messages? This action cannot be undone.')) {
                return;
              }
              
              const btn = document.getElementById('deleteAllBtn');
              btn.disabled = true;
              btn.textContent = 'Deleting All...';
              
              try {
                const response = await fetch('/api/contacts/delete-all', {
                  method: 'DELETE'
                });
                
                const result = await response.json();
                
                if (response.ok) {
                  // Clear the table
                  const tableBody = document.querySelector('table tbody');
                  if (tableBody) {
                    tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 2rem; color: #6c757d;">No contacts found</td></tr>';
                  }
                  
                  // Update total count
                  const totalCountEl = document.getElementById('totalCount');
                  totalCountEl.textContent = '0';
                  
                  // Hide individual action buttons since no contacts
                  document.querySelectorAll('.download-single-btn, .delete-btn').forEach(btn => {
                    btn.style.display = 'none';
                  });
                  
                  showToast('Successfully deleted ' + result.deleted + ' contacts', 'success');
                } else {
                  throw new Error(result.error || 'Failed to delete all contacts');
                }
              } catch (error) {
                console.error('Delete all error:', error);
                showToast('Failed to delete all contacts: ' + error.message, 'error');
              } finally {
                btn.disabled = false;
                btn.textContent = '🗑️ Delete All';
              }
            }
            
            async function downloadSingleContact(id, name) {
              const btn = document.querySelector('[data-id="' + id + '"].download-single-btn');
              btn.disabled = true;
              btn.textContent = 'Downloading...';
              
              try {
                // Get all contacts to find the specific one
                const response = await fetch('/api/contacts');
                const contacts = await response.json();
                const contact = contacts.find(c => c.id === id);
                
                if (!contact) {
                  throw new Error('Contact not found');
                }
                
                // Create text content for this specific contact
                const textContent = 'Contact Message #' + id + '\\n' +
                  'Name: ' + contact.name + '\\n' +
                  'Email: ' + contact.email + '\\n' +
                  'Message: ' + contact.message + '\\n' +
                  'Date: ' + (contact.timestamp ? new Date(contact.timestamp).toLocaleString() : '') + '\\n---';
                
                // Create blob and download
                const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = 'contact_' + name.replace(/[^a-zA-Z0-9]/g, '_') + '_' + id + '.txt';
                document.body.appendChild(link);
                link.click();
                
                // Cleanup
                setTimeout(() => {
                  window.URL.revokeObjectURL(url);
                  document.body.removeChild(link);
                }, 100);
                
                showToast('Contact message downloaded successfully', 'success');
              } catch (error) {
                console.error('Download error:', error);
                showToast('Failed to download contact: ' + error.message, 'error');
              } finally {
                btn.disabled = false;
                btn.textContent = '📥 Download';
              }
            }
            
            async function deleteContact(id) {
              if (!confirm('Are you sure you want to delete this contact message?')) {
                return;
              }
              
              const btn = document.querySelector('[data-id="' + id + '"]');
              btn.disabled = true;
              btn.textContent = 'Deleting...';
              
              try {
                const response = await fetch('/api/contacts/' + id, {
                  method: 'DELETE'
                });
                
                const result = await response.json();
                
                if (response.ok) {
                  // Remove row from table
                  const row = document.getElementById('contact-' + id);
                  row.style.transition = 'opacity 0.3s';
                  row.style.opacity = '0';
                  setTimeout(() => row.remove(), 300);
                  
                  // Update total count
                  const totalCount = document.getElementById('totalCount');
                  totalCount.textContent = result.remaining;
                  
                  // Show success toast
                  showToast('Contact deleted successfully', 'success');
                } else {
                  throw new Error(result.error || 'Failed to delete');
                }
              } catch (error) {
                console.error('Delete error:', error);
                showToast('Failed to delete contact: ' + error.message, 'error');
                btn.disabled = false;
                btn.textContent = '🗑️ Delete';
              }
            }
            
            function showToast(message, type = 'success') {
              const toast = document.getElementById('toast');
              toast.textContent = message;
              toast.className = 'toast show ' + (type === 'error' ? 'error' : '');
              
              setTimeout(() => {
                toast.classList.remove('show');
              }, 3000);
            }
            
            function refreshPage() {
              // Get current session
              const currentSession = localStorage.getItem('adminSession');
              const currentUsername = localStorage.getItem('adminUsername');
              
              // Store session temporarily
              sessionStorage.setItem('tempSession', currentSession);
              sessionStorage.setItem('tempUsername', currentUsername);
              
              // Reload page
              window.location.reload();
            }
            
            // Browser Navigation Security
            (function() {
              // Prevent back navigation
              history.pushState(null, null, location.href);
              window.onpopstate = function () {
                history.go(1);
                showNotification('⚠️ Back navigation disabled for security', 'error');
              };
              
              // Prevent forward navigation
              history.pushState(null, null, location.href);
              history.pushState(null, null, location.href);
              window.onpopstate = function () {
                if (confirm('🔒 Going back will require relogin. Continue?')) {
                  window.location.href = '/login';
                } else {
                  history.go(2);
                }
              };
              
              // Disable keyboard shortcuts
              document.addEventListener('keydown', function(e) {
                // Prevent Alt + Left/Right arrows
                if (e.altKey && (e.keyCode === 37 || e.keyCode === 39)) {
                  e.preventDefault();
                  showNotification('⚠️ Navigation shortcuts disabled', 'error');
                  return false;
                }
                
                // Prevent Backspace
                if (e.keyCode === 8 && !['input', 'textarea'].includes(e.target.tagName.toLowerCase())) {
                  e.preventDefault();
                  return false;
                }
                
                // Prevent F5 refresh (optional)
                if (e.keyCode === 116) {
                  e.preventDefault();
                  showNotification('⚠️ Refresh disabled for security', 'error');
                  return false;
                }
              });
              
              // Warn before closing
              window.addEventListener('beforeunload', function(e) {
                e.preventDefault();
                e.returnValue = '⚠️ Closing this tab will require relogin. Are you sure?';
              });
              
              // Disable right-click context menu
              document.addEventListener('contextmenu', function(e) {
                e.preventDefault();
                return false;
              });
              
              // Disable text selection (optional)
              document.addEventListener('selectstart', function(e) {
                if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
                  e.preventDefault();
                  return false;
                }
              });
              
              console.log('🔐 Browser navigation security enabled');
            })();
          </script>
        </body>
        </html>
      `;
      // Set proper headers for UTF-8 encoding and emoji support
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Security-Policy', "default-src 'self' data: blob: 'unsafe-inline' 'unsafe-eval' *;");
      res.send(html);
    }
  } catch (error) {
    res.status(500).send("Error loading contacts");
  }
});

// Initialize
initContactsFile();

// Initialize email service with secure credentials
initializeEmailTransporter();
verifyEmailConfiguration();

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global error:', err);
  
  // Don't leak error details in production
  const message = process.env.NODE_ENV === 'production' 
    ? 'Internal server error' 
    : err.message;
  
  res.status(err.status || 500).json({
    error: message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Security headers for all responses
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.removeHeader('X-Powered-By');
  next();
});

// Start server
const startServer = async () => {
  try {
    // Initialize admin credentials
    await initAdminCredentials();
    
    // Initialize email transporter
    initializeEmailTransporter();
    
    // Verify email configuration
    verifyEmailConfiguration();
    
    // Start the server
    const server = app.listen(PORT, () => {
      console.log(`🚀 Portfolio server running on http://localhost:${PORT}`);
      console.log(`📧 Contacts will be saved to: ${CONTACTS_FILE}`);
      console.log(`🔐 Admin credentials: ${ADMIN_CREDENTIALS_FILE}`);
      console.log(`🛡️ Security features enabled`);
      console.log(`📧 Email service: ${transporter ? '✅ Active' : '❌ Inactive'}`);
    });
    
    return server;
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
startServer();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});
