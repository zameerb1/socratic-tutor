/**
 * Firebase Configuration
 *
 * To set up Firebase for this app:
 *
 * 1. Go to https://console.firebase.google.com/
 * 2. Create a new project (or use existing one)
 * 3. Add a web app to your project
 * 4. Copy your config values below
 * 5. Enable Email Link (Passwordless) Sign-In:
 *    - Go to Authentication > Sign-in method
 *    - Click "Email/Password"
 *    - Enable "Email link (passwordless sign-in)"
 * 6. Enable Firestore:
 *    - Go to Firestore Database
 *    - Create database (start in test mode for development)
 * 7. Add your domain to authorized domains:
 *    - Authentication > Settings > Authorized domains
 *    - Add: zameerb1.github.io
 */

const firebaseConfig = {
    apiKey: "AIzaSyBX3l74kPd0nBzmBBBmi2JqtwHEMmWSEN8",
    authDomain: "socratic-d9b82.firebaseapp.com",
    projectId: "socratic-d9b82",
    storageBucket: "socratic-d9b82.firebasestorage.app",
    messagingSenderId: "214378985848",
    appId: "1:214378985848:web:a3e58d30a2cad3becd308d",
    measurementId: "G-G0EJ4MRBHM"
};

// Initialize Firebase (only if config is set)
let firebaseApp = null;
let auth = null;
let db = null;
let storage = null;

if (firebaseConfig.apiKey !== "YOUR_API_KEY") {
    firebaseApp = firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();
    db = firebase.firestore();
    // Initialize Storage only if the SDK is loaded (admin.html loads it, student page does not)
    if (typeof firebase.storage === 'function') {
        storage = firebase.storage();
    }
    console.log('Firebase initialized');
} else {
    console.log('Firebase not configured - running in local mode');
}
