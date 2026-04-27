// ✅ 1. Added missing imports: onAuthStateChanged and signOut
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  updateProfile,
  onAuthStateChanged, 
  signOut 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyAlA1c10-_q6HFLveVXCVbsI8roeHxlAro",
  authDomain: "fittrack-750f5.firebaseapp.com",
  projectId: "fittrack-750f5",
  storageBucket: "fittrack-750f5.firebasestorage.app",
  messagingSenderId: "279603786258",
  appId: "1:279603786258:web:d8eabb441a6feaadbf5ecb"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// --- UI ELEMENT SELECTORS ---
const authButtons = document.getElementById('nav-auth-buttons');
const heroPrimaryBtn = document.getElementById('startTrialBtn');
const toggleBtns = document.querySelectorAll('.toggle-btn');
const authForms = document.querySelectorAll('.auth-form');
const togglePasswordBtns = document.querySelectorAll('.toggle-password');

// ✅ 2. SMART REDIRECT & NAVBAR LOGIC
// This handles the "Back to Dashboard" and "Smart Navbar"
onAuthStateChanged(auth, (user) => {
    if (user) {
        if (authButtons) {
            authButtons.innerHTML = `
                <a href="dashboard.html" class="btn btn-primary">Go to Dashboard</a>
                <button id="logoutBtn" class="btn btn-secondary" style="margin-left:10px">Logout</button>
            `;
            
            // Add Logout listener after creating the button
            document.getElementById('logoutBtn').addEventListener('click', () => {
                signOut(auth).then(() => window.location.reload());
            });
        }

        if (heroPrimaryBtn) {
            heroPrimaryBtn.innerText = "Back to Dashboard";
            heroPrimaryBtn.onclick = () => window.location.href = 'dashboard.html';
        }
    } else {
        if (authButtons) {
            authButtons.innerHTML = `
                <a href="login.html" class="btn btn-secondary">Login</a>
                <a href="signup.html" class="btn btn-primary" style="margin-left:10px">Sign Up</a>
            `;
        }
    }
    // Fade page in once auth status is confirmed
    document.body.style.opacity = "1";
});

// --- TOGGLE FORM LOGIC (Login vs Signup) ---
toggleBtns.forEach(btn => {
  btn.addEventListener('click', function() {
    const formType = this.dataset.form;
    toggleBtns.forEach(b => b.classList.remove('active'));
    this.classList.add('active');
    authForms.forEach(form => form.classList.remove('active'));
    const targetForm = document.getElementById(formType + 'Form');
    if (targetForm) targetForm.classList.add('active');
  });
});

// --- PASSWORD TOGGLE ---
togglePasswordBtns.forEach(btn => {
  btn.addEventListener('click', function(e) {
    e.preventDefault();
    const input = document.getElementById(this.dataset.target);
    if (input) input.type = input.type === 'password' ? 'text' : 'password';
  });
});

// --- SIGNUP LOGIC ---
const signupForm = document.getElementById("signupForm");
if (signupForm) {
    signupForm.addEventListener("submit", async function(e) {
        e.preventDefault();
        const fullname = document.getElementById('signup-fullname').value;
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;
        const confirm = document.getElementById('signup-confirm').value;

        if (password !== confirm) return alert('Passwords do not match!');
        if (password.length < 8) return alert('Min 8 characters!');

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            await updateProfile(userCredential.user, { displayName: fullname });
            window.location.href = "dashboard.html";
        } catch (error) { alert(error.message); }
    });
}

// --- LOGIN LOGIC ---
const loginForm = document.getElementById("loginForm");
if (loginForm) {
    loginForm.addEventListener("submit", async function (e) {
        e.preventDefault();
        const email = document.getElementById("login-email").value;
        const password = document.getElementById("login-password").value;
        try {
            await signInWithEmailAndPassword(auth, email, password);
            window.location.href = "dashboard.html";
        } catch (error) { alert(error.message); }
    });
}

// START FREE TRIAL: Logic for Sign Up / Dashboard
const startTrialBtn = document.getElementById('startTrialBtn');

if (startTrialBtn) {
    startTrialBtn.addEventListener('click', () => {
        // We check the user's status right now
        const user = auth.currentUser;

        if (user) {
            // If they are somehow logged in but on the landing page
            window.location.href = 'dashboard.html';
        } else {
            // This is the most likely case for this button
            window.location.href = 'signup.html';
        }
    });
}