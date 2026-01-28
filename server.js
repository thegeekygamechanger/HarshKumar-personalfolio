const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const bodyParser = require("body-parser");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static("."));

const CONTACTS_FILE = path.join(__dirname, "assets", "contacts.json");

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

// API endpoint to save contact responses
app.post("/api/save-contact", (req, res) => {
  try {
    const { name, email, message, timestamp } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Read existing contacts
    let contacts = [];
    if (fs.existsSync(CONTACTS_FILE)) {
      const data = fs.readFileSync(CONTACTS_FILE, "utf8");
      contacts = JSON.parse(data || "[]");
    }

    // Add new contact
    const newContact = {
      id: Date.now(),
      name,
      email,
      message,
      timestamp: timestamp || new Date().toISOString(),
    };

    contacts.push(newContact);

    // Save to file
    fs.writeFileSync(CONTACTS_FILE, JSON.stringify(contacts, null, 2));

    console.log(`✅ Contact saved: ${name} (${email})`);

    res.json({
      success: true,
      message: "Contact saved successfully",
      id: newContact.id,
    });
  } catch (error) {
    console.error("Error saving contact:", error);
    res.status(500).json({ error: "Failed to save contact" });
  }
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
app.get("/download-contacts", (req, res) => {
  try {
    if (fs.existsSync(CONTACTS_FILE)) {
      res.download(CONTACTS_FILE, "contacts.json");
    } else {
      res.status(404).json({ error: "Contacts file not found" });
    }
  } catch (error) {
    console.error("Error downloading contacts:", error);
    res.status(500).json({ error: "Failed to download contacts" });
  }
});

// Simple admin page to view contacts
app.get("/admin/contacts", (req, res) => {
  try {
    if (fs.existsSync(CONTACTS_FILE)) {
      const data = fs.readFileSync(CONTACTS_FILE, "utf8");
      const contacts = JSON.parse(data || "[]");
      let rows = contacts.map(c => `
        <tr>
          <td>${c.name}</td>
          <td>${c.email}</td>
          <td>${c.message ? c.message.substring(0, 50) : ''}...</td>
          <td>${c.timestamp ? new Date(c.timestamp).toLocaleString() : ''}</td>
        </tr>
      `).join('');
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Contact Submissions</title>
          <style>
            body { font-family: Manrope, sans-serif; padding: 2rem; background: #f7f3ef; }
            h1 { color: #ff6b3d; }
            table { border-collapse: collapse; width: 100%; background: white; border-radius: 12px; overflow: hidden; }
            th, td { padding: 1rem; text-align: left; border-bottom: 1px solid #ddd; }
            th { background: #ff6b3d; color: white; font-weight: 600; }
            tr:hover { background: #fafafa; }
          </style>
        </head>
        <body>
          <h1>📧 Contact Form Submissions</h1>
          <p>Total: ${contacts.length}</p>
          <table>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Message</th>
              <th>Date</th>
            </tr>
            ${rows}
          </table>
        </body>
        </html>
      `;
      res.send(html);
    }
  } catch (error) {
    res.status(500).send("Error loading contacts");
  }
});

// Initialize
initContactsFile();

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Portfolio server running on http://localhost:${PORT}`);
  console.log(`📧 Contacts will be saved to: ${CONTACTS_FILE}`);
});
