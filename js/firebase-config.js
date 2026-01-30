// Firebase Configuration
// Your web app's Firebase configuration

const firebaseConfig = {
  apiKey: "AIzaSyBGfDOIMqzJdkj-HwHsQlILylzeM_u_85o",
  authDomain: "voting-system-expo-forgia.firebaseapp.com",
  projectId: "voting-system-expo-forgia",
  storageBucket: "voting-system-expo-forgia.firebasestorage.app",
  messagingSenderId: "571688075742",
  appId: "1:571688075742:web:2a7adcd916464715089d4f"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Firestore
const db = firebase.firestore();

// Initialize Auth
const auth = firebase.auth();

// Export for use in other files
window.db = db;
window.auth = auth;
