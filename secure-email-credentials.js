const CryptoJS = require('crypto-js');
const fs = require('fs');
const path = require('path');

class SecureEmailCredentials {
  constructor() {
    this.credentialsPath = path.join(__dirname, 'assets', 'email-credentials.enc');
    this.encryptionKey = CryptoJS.SHA256(
      process.env.ENCRYPTION_KEY || 
      'portfolio-2026-harshkumar-secure-key-abcxyzcvc-email-credentials'
    ).toString();
  }

  // Decrypt email credentials
  getCredentials() {
    try {
      // Check if encrypted file exists
      if (!fs.existsSync(this.credentialsPath)) {
        throw new Error('Encrypted credentials file not found');
      }

      // Read encrypted file
      const secureFile = JSON.parse(fs.readFileSync(this.credentialsPath, 'utf8'));
      
      // Verify checksum
      const expectedChecksum = CryptoJS.SHA256(secureFile.data + this.encryptionKey).toString();
      if (secureFile.checksum !== expectedChecksum) {
        throw new Error('Credentials file checksum validation failed - file may be corrupted');
      }

      // Decrypt data
      const decryptedBytes = CryptoJS.AES.decrypt(secureFile.data, this.encryptionKey);
      const decryptedData = decryptedBytes.toString(CryptoJS.enc.Utf8);
      
      if (!decryptedData) {
        throw new Error('Failed to decrypt credentials - invalid encryption key');
      }

      const credentials = JSON.parse(decryptedData);
      
      // Validate credentials structure
      if (!credentials.user || !credentials.password || !credentials.service) {
        throw new Error('Invalid credentials structure');
      }

      console.log(`✅ Email credentials loaded for user: ${credentials.user}`);
      return credentials;
      
    } catch (error) {
      console.error('❌ Error loading encrypted email credentials:', error.message);
      return null;
    }
  }

  // Verify credentials integrity
  verifyCredentials() {
    const credentials = this.getCredentials();
    return credentials !== null;
  }

  // Get user (for logging)
  getUser() {
    const credentials = this.getCredentials();
    return credentials ? credentials.user : null;
  }

  // Get password (for email service)
  getPassword() {
    const credentials = this.getCredentials();
    return credentials ? credentials.password : null;
  }

  // Get service
  getService() {
    const credentials = this.getCredentials();
    return credentials ? credentials.service : null;
  }
}

module.exports = SecureEmailCredentials;
