import { auth, db } from "./firebase-config.js";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";

import {
  doc,
  setDoc,
  getDoc
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

const authSection = document.getElementById("authSection");
const dashboard = document.getElementById("dashboard");

const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");

document.getElementById("showRegister").onclick = (e) => {
  e.preventDefault();
  loginForm.style.display = "none";
  registerForm.style.display = "block";
};

document.getElementById("showLogin").onclick = (e) => {
  e.preventDefault();
  registerForm.style.display = "none";
  loginForm.style.display = "block";
};

// REGISTER
document.getElementById("register").addEventListener("submit", async (e) => {
  e.preventDefault();

  const name = document.getElementById("regName").value.trim();
  const email = document.getElementById("regEmail").value.trim();
  const phone = document.getElementById("regPhone").value.trim();
  const password = document.getElementById("regPassword").value;

  if (password.length < 6) {
    alert("Password must be at least 6 characters");
    return;
  }

  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);

    await updateProfile(result.user, {
      displayName: name
    });

    await setDoc(doc(db, "users", result.user.uid), {
      name: name,
      email: email,
      phone: phone,
      balance: 0,
      role: "user",
      createdAt: new Date()
    });

    alert("Registration Successful!");

  } catch (error) {
    alert(error.message);
  }
});

// LOGIN
document.getElementById("login").addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("loginEmail").value;
  const password = document.getElementById("loginPassword").value;

  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    alert("Login Failed: " + error.message);
  }
});

// LOGOUT
document.getElementById("logoutBtn").addEventListener("click", async () => {
  await signOut(auth);
});

// AUTH STATE
onAuthStateChanged(auth, async (user) => {

  if (user) {
    authSection.style.display = "none";
    dashboard.style.display = "block";

    document.getElementById("userName").textContent =
      user.displayName || "User";

    try {
      const snap = await getDoc(doc(db, "users", user.uid));

      if (snap.exists()) {
        const data = snap.data();

        document.getElementById("userBalance").textContent =
          Number(data.balance || 0).toFixed(2);
      }
    } catch (error) {
      console.error("Profile loading failed:", error);
    }

  } else {
    authSection.style.display = "flex";
    dashboard.style.display = "none";
  }

});
