/**
 * Firebase Configuration
 *
 * To set up Firebase for this app:
 *
 * 1. Go to https://console.firebase.google.com/
 * 2. Create a new project (or use existing one)
 * 3. Add a web app to your project
 * 4. Copy your config values below
 * 5. Enable Google Sign-In:
 *    - Go to Authentication > Sign-in method
 *    - Enable Google provider
 * 6. Enable Firestore:
 *    - Go to Firestore Database
 *    - Create database (start in test mode for development)
 * 7. Add your domain to authorized domains:
 *    - Authentication > Settings > Authorized domains
 *    - Add: zameerb1.github.io
 */

const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialize Firebase (only if config is set)
let firebaseApp = null;
let auth = null;
let db = null;

if (firebaseConfig.apiKey !== "YOUR_API_KEY") {
    firebaseApp = firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();
    db = firebase.firestore();
    console.log('Firebase initialized');
} else {
    console.log('Firebase not configured - running in local mode');
}
