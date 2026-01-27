# Harsh Kumar - Personal Portfolio

Modern, interactive personal portfolio with Material Design, smooth animations, and a fully functional contact form.

## Features

✨ **Modern Design**
- Material Design aesthetics with smooth hover effects
- Glassmorphism effects with backdrop blur
- Responsive layout for all devices
- Beautiful gradient animations

🚀 **Interactive Elements**
- Smooth scroll navigation
- Modal popups with animated canvas
- Social links dropdown
- Contact form with validation
- Animated thank you notifications

📧 **Contact Form**
- Real-time form validation
- Auto-saves to `assets/contacts.json`
- Thank you chip animation
- Backup localStorage storage

🎨 **Visual Polish**
- Opaque card backgrounds with hover highlights
- Glowing modal with shimmer effects
- Skill pills with fade animations
- Pulsing footer text

## Setup & Installation

### Quick Start (Frontend Only)
```bash
# Just open index.html in your browser
# Works as a static site without backend
```

### Full Setup (With Contact Form Backend)

#### 1. Install Dependencies
```bash
npm install
```

This will install:
- `express` - Web server
- `cors` - Cross-origin requests
- `body-parser` - Request parsing

#### 2. Start the Server
```bash
npm start
```

Server runs on `http://localhost:3000`

#### 3. Submit Contact Form
- Fill out the contact form
- Click "📤 Send Message"
- Response is saved to `assets/contacts.json`
- Thank you chip appears automatically

## File Structure

```
├── index.html              # Main HTML
├── styles.css              # All styling + animations
├── app.js                  # Frontend logic
├── server.js               # Backend server (Node.js)
├── package.json            # Dependencies
├── assets/
│   ├── contacts.json       # Saved contact responses
│   ├── resume.pdf          # Your resume
│   └── profile.png         # Your profile photo
└── README.md              # This file
```

## Configuration

### Update Profile Data

Edit the `__PROFILE_DATA__` object in `index.html`:

```javascript
window.__PROFILE_DATA__ = {
  name: "Your Name",
  role: "Your Role",
  email: "your-email@example.com",
  phone: "+1-234-567-8900",
  // ... more fields
};
```

### Customize Colors

Edit CSS variables in `styles.css`:

```css
:root {
  --accent: #ff6b3d;        /* Orange accent */
  --ink: #1d1b17;           /* Dark text */
  --bg: #f7f3ef;            /* Background */
  --surface: #ffffff;       /* Card background */
}
```

## Contact Responses

Submitted contact forms are automatically saved to `assets/contacts.json` in this format:

```json
[
  {
    "id": 1706307600000,
    "name": "John Doe",
    "email": "john@example.com",
    "message": "Great portfolio!",
    "timestamp": "2026-01-27T10:00:00.000Z"
  }
]
```

## Deployment

### Netlify (Recommended)
1. Connect your GitHub repo
2. Build command: `npm start`
3. Public directory: `.`
4. Enable backend functions for contact saving

### Vercel
1. Import project
2. Add environment variables if needed
3. Deploy with Node.js runtime

### Traditional Hosting
- Copy all files to your server
- Run `npm install && npm start`
- Access on your domain

## Browser Support

- ✅ Chrome/Edge (latest)
- ✅ Firefox (latest)
- ✅ Safari (with -webkit prefixes)
- ✅ Mobile browsers

## Performance

- Lazy loading with Intersection Observer
- Smooth animations at 60fps
- Optimized images and assets
- CSS animations for better performance

## Customization Tips

### Change Accent Color
Update `--accent` in `:root` of `styles.css`

### Add More Sections
1. Add HTML section
2. Add CSS styling
3. Initialize in `app.js`

### Modify Animations
Edit `@keyframes` in `styles.css`

## Troubleshooting

### Contact form not saving?
- Check browser console for errors
- Ensure server is running (`npm start`)
- Check that `assets/` directory exists

### Server won't start?
```bash
# Clear node_modules and reinstall
rm -rf node_modules
npm install
npm start
```

### Port 3000 already in use?
```bash
PORT=3001 npm start
```

## License

Personal portfolio - All rights reserved ©2026

## Support

For issues or questions, check the browser console for error messages.

---

**Built with ❤️ and 😊**
