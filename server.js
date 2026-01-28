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

// Download all contacts as plain text
app.get("/admin/contacts/download-txt", (req, res) => {
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
      const CONTACTS_HISTORY_DIR = path.join(__dirname, "assets", "contacts_history");
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
            .download-btn { display: inline-block; margin: 1rem 0; padding: 0.7rem 1.5rem; background: #ff6b3d; color: #fff; border: none; border-radius: 8px; font-size: 1rem; font-weight: 600; text-decoration: none; transition: background 0.2s; }
            .download-btn:hover { background: #ff8c5a; }
          </style>
        </head>
        <body>
          <h1>📧 Contact Form Submissions</h1>
          <p>Total: ${contacts.length}</p>
          <a class="download-btn" href="/admin/contacts/download-txt" id="downloadTxtBtn">⬇️ Download All as Text</a>
          <!-- Optionally, auto-download on page load for admin: uncomment below script if needed -->
          <!--
          <script>
            window.onload = function() {
              document.getElementById('downloadTxtBtn').click();
            };
          </script>
          -->
          <table>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Message</th>
              <th>Date</th>
            </tr>
            ${contacts.map(c => `
              <tr>
                <td>${c.name}</td>
                <td>${c.email}</td>
                <td>${c.message ? c.message.substring(0, 50) : ''}...</td>
                <td>${c.timestamp ? new Date(c.timestamp).toLocaleString() : ''}</td>
              </tr>
            `).join('')}
          </table>
        </body>
        </html>
      `;
      // Set a permissive Content Security Policy header for this route
      res.setHeader('Content-Security-Policy', "default-src 'self' data: blob: 'unsafe-inline' 'unsafe-eval' *;");
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
