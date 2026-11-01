/* ============================================================
   MICRO JOB USER APP JS
   AUTHENTICATION + REAL MONEY BALANCE + ESCROW ENGINE
   LIGHT WHITE/PURPLE DESIGN COMPATIBLE
============================================================ */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { 
  getAuth, 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut 
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  addDoc, 
  collection, 
  query, 
  where, 
  onSnapshot, 
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

/* ------------------------------------------------------------
   CONSTANTS & INITIALIZATION
------------------------------------------------------------ */
const WORKER_API = "https://microjob-secure-api.mddulalhosen6.workers.dev";
const MIN_DEPOSIT_BDT = 300;
const MIN_WITHDRAW_BDT = 5000;

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const $ = id => document.getElementById(id);

let currentUser = null;
let userAccessUnlocked = false;
let realBalances = { mainBalanceBDT: 0, depositBalanceBDT: 0 };
let activeListeners = [];

/* ------------------------------------------------------------
   HELPERS & UI FORMATTING
------------------------------------------------------------ */
function escapeHtml(str = "") {
  return String(str).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[c]);
}

function money(amount) {
  const num = Number(amount) || 0;
  return "৳ " + num.toLocaleString("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function showToast(message, isError = false) {
  const toast = $("toastMessage") || createToastElement();
  toast.textContent = message;
  toast.style.background = isError ? "#ef4444" : "#10b981";
  toast.style.display = "block";
  setTimeout(() => { toast.style.display = "none"; }, 3500);
}

function createToastElement() {
  const el = document.createElement("div");
  el.id = "toastMessage";
  el.style.cssText = "position:fixed;bottom:70px;left:50%;transform:translateX(-50%);padding:12px 24px;color:#fff;border-radius:25px;font-weight:bold;z-index:9999;display:none;box-shadow:0 4px 12px rgba(0,0,0,0.15);font-size:14px;text-align:center;";
  document.body.appendChild(el);
  return el;
}

/* ------------------------------------------------------------
   AUTH TABS & FORM SWITCHING
------------------------------------------------------------ */
const loginTabBtn = $("loginTabBtn");
const signupTabBtn = $("signupTabBtn");
const loginFormView = $("loginFormView");
const signupFormView = $("signupFormView");

if (loginTabBtn && signupTabBtn) {
  loginTabBtn.addEventListener("click", () => {
    loginTabBtn.classList.add("active");
    signupTabBtn.classList.remove("active");
    if (loginFormView) loginFormView.style.display = "block";
    if (signupFormView) signupFormView.style.display = "none";
  });

  signupTabBtn.addEventListener("click", () => {
    signupTabBtn.classList.add("active");
    loginTabBtn.classList.remove("active");
    if (signupFormView) signupFormView.style.display = "block";
    if (loginFormView) loginFormView.style.display = "none";
  });
}

/* ------------------------------------------------------------
   SIGNUP HANDLER
------------------------------------------------------------ */
const signupForm = $("signupForm");
if (signupForm) {
  signupForm.addEventListener("submit", async e => {
    e.preventDefault();

    const name = $("signupNameInput")?.value.trim();
    const email = $("signupEmailInput")?.value.trim();
    const password = $("signupPasswordInput")?.value;
    const confirmPassword = $("signupConfirmPasswordInput")?.value;

    if (!name || !email || !password) {
      return showToast("সব ঘর সঠিকভাবে পূরণ করুন।", true);
    }
    if (password.length < 6) {
      return showToast("পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।", true);
    }
    if (confirmPassword && password !== confirmPassword) {
      return showToast("পাসওয়ার্ড নিশ্চিতকরণ মিলছে না।", true);
    }

    try {
      showToast("অ্যাকাউন্ট তৈরি হচ্ছে...");
      
      // 1. Create Firebase Auth User
      const userCred = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCred.user;

      // 2. Create User Document in Firestore
      await setDoc(doc(db, "users", user.uid), {
        name: name,
        email: email,
        mainBalance: 0,
        depositBalance: 0,
        createdAt: serverTimestamp()
      });

      showToast("অ্যাকাউন্ট সফলভাবে তৈরি হয়েছে!");
      signupForm.reset();

    } catch (err) {
      console.error("Signup Error:", err);
      let msg = "সাইনআপ ব্যর্থ হয়েছে।";
      if (err.code === "auth/email-already-in-use") msg = "এই ইমেইল দিয়ে আগেই অ্যাকাউন্ট খোলা হয়েছে।";
      if (err.code === "auth/invalid-email") msg = "সঠিক ইমেইল এড্রেস লিখুন।";
      if (err.code === "auth/weak-password") msg = "পাসওয়ার্ড আরও শক্ত করুন।";
      showToast(msg, true);
    }
  });
}

/* ------------------------------------------------------------
   LOGIN HANDLER
------------------------------------------------------------ */
const loginForm = $("loginForm");
if (loginForm) {
  loginForm.addEventListener("submit", async e => {
    e.preventDefault();

    const email = $("loginEmailInput")?.value.trim();
    const password = $("loginPasswordInput")?.value;

    if (!email || !password) {
      return showToast("ইমেইল ও পাসওয়ার্ড লিখুন।", true);
    }

    try {
      showToast("লগইন হচ্ছে...");
      await signInWithEmailAndPassword(auth, email, password);
      showToast("লগইন সফল হয়েছে!");
      loginForm.reset();
    } catch (err) {
      console.error("Login Error:", err);
      let msg = "লগইন ব্যর্থ হয়েছে। পাসওয়ার্ড বা ইমেইল ভুল।";
      if (err.code === "auth/user-not-found") msg = "এই ইমেইলে কোনো অ্যাকাউন্ট পাওয়া যায়নি।";
      if (err.code === "auth/wrong-password") msg = "পাসওয়ার্ড ভুল হয়েছে।";
      showToast(msg, true);
    }
  });
}

/* ------------------------------------------------------------
   LOGOUT HANDLER
------------------------------------------------------------ */
const logoutBtn = $("logoutBtn") || $("userLogoutBtn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    try {
      await signOut(auth);
      showToast("লগআউট সফল হয়েছে।");
    } catch (err) {
      showToast("লগআউট সমস্যা: " + err.message, true);
    }
  });
}

/* ------------------------------------------------------------
   REAL MONEY WALLET FETCH (FROM CLOUDFLARE D1 WORKER)
------------------------------------------------------------ */
async function fetchRealWalletBalance() {
  if (!currentUser) return;

  try {
    const token = await currentUser.getIdToken();
    const res = await fetch(`${WORKER_API}/wallet/my`, {
      headers: { "Authorization": `Bearer ${token}` }
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        realBalances.mainBalanceBDT = data.mainBalanceBDT || 0;
        realBalances.depositBalanceBDT = data.depositBalanceBDT || 0;
        updateBalanceUI();
      }
    }
  } catch (err) {
    console.error("Real wallet fetch error:", err);
  }
}

function updateBalanceUI() {
  const mainEl = $("mainBalanceVal") || $("userMainBalance");
  const depEl = $("depositBalanceVal") || $("userDepositBalance");
  const totalEl = $("totalBalanceVal");

  if (mainEl) mainEl.textContent = money(realBalances.mainBalanceBDT);
  if (depEl) depEl.textContent = money(realBalances.depositBalanceBDT);
  if (totalEl) totalEl.textContent = money(realBalances.mainBalanceBDT + realBalances.depositBalanceBDT);
}

/* ------------------------------------------------------------
   LIFETIME WORK ACCESS CHECK
------------------------------------------------------------ */
function listenToUserAccess(uid) {
  const accessRef = doc(db, "userAccess", uid);
  const unsub = onSnapshot(accessRef, docSnap => {
    const exists = typeof docSnap.exists === "function" ? docSnap.exists() : Boolean(docSnap.exists);
    if (exists && docSnap.data()?.workEnabled === true) {
      userAccessUnlocked = true;
      updateAccessLockUI(true);
    } else {
      userAccessUnlocked = false;
      updateAccessLockUI(false);
    }
  }, err => {
    console.error("User access check error:", err);
  });
  activeListeners.push(unsub);
}

function updateAccessLockUI(unlocked) {
  const lockNotice = $("workLockBanner");
  const postJobBtn = $("navPostJobBtn");

  if (lockNotice) {
    lockNotice.style.display = unlocked ? "none" : "block";
  }
  if (postJobBtn) {
    postJobBtn.style.opacity = unlocked ? "1" : "0.5";
  }
}

/* ------------------------------------------------------------
   AUTHENTICATION STATE WATCHER
------------------------------------------------------------ */
onAuthStateChanged(auth, async user => {
  stopActiveListeners();
  currentUser = user;

  if (user) {
    if ($("userEmailDisplay")) $("userEmailDisplay").textContent = user.email;
    listenToUserAccess(user.uid);
    await fetchRealWalletBalance();
    loadAvailableJobs();
    loadMySubmittedTasks();
    showMainApp();
  } else {
    userAccessUnlocked = false;
    realBalances = { mainBalanceBDT: 0, depositBalanceBDT: 0 };
    showAuthScreen();
  }
});

function stopActiveListeners() {
  activeListeners.forEach(unsub => { try { unsub(); } catch(e){} });
  activeListeners = [];
}

function showMainApp() {
  if ($("authScreenSection")) $("authScreenSection").style.display = "none";
  if ($("mainAppSection")) $("mainAppSection").style.display = "block";
}

function showAuthScreen() {
  if ($("authScreenSection")) $("authScreenSection").style.display = "flex";
  if ($("mainAppSection")) $("mainAppSection").style.display = "none";
}

/* ------------------------------------------------------------
   JOB POSTING WITH ESCROW FUNDING
------------------------------------------------------------ */
const postJobForm = $("postJobForm");
if (postJobForm) {
  postJobForm.addEventListener("submit", async e => {
    e.preventDefault();

    if (!userAccessUnlocked) {
      return showToast("কাজ বা জব পোস্ট করতে কমপক্ষে ৳৩০০ ডিপোজিট অনুমোদন আবশ্যক।", true);
    }

    const title = $("jobTitleInput")?.value.trim();
    const description = $("jobDescInput")?.value.trim();
    const rewardBDT = Number($("jobRewardInput")?.value);
    const workerCount = Number($("jobWorkerCountInput")?.value);
    const fundSource = $("jobFundSourceSelect")?.value || "deposit";

    if (!title || !description || rewardBDT <= 0 || workerCount <= 0) {
      return showToast("সব তথ্য সঠিকভাবে পূরণ করুন।", true);
    }

    const totalBudget = rewardBDT * workerCount;
    const availableBalance = fundSource === "main" ? realBalances.mainBalanceBDT : realBalances.depositBalanceBDT;

    if (availableBalance < totalBudget) {
      return showToast(`আপনার নির্বাচিত ${fundSource.toUpperCase()} ওয়ালেটে পর্যাপ্ত ব্যালেন্স নেই। প্রয়োজন: ${money(totalBudget)}`, true);
    }

    try {
      showToast("জব পোস্ট ও Escrow ফান্ডিং হচ্ছে...");

      const jobRef = await addDoc(collection(db, "jobs"), {
        title,
        description,
        reward: rewardBDT,
        workerCount,
        creatorUid: currentUser.uid,
        creatorEmail: currentUser.email,
        status: "pending",
        createdAt: serverTimestamp()
      });

      const token = await currentUser.getIdToken();
      const res = await fetch(`${WORKER_API}/jobs/fund-escrow`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          jobId: jobRef.id,
          rewardBDT,
          workerCount,
          fundSource
        })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || "Escrow ফান্ডিং ব্যর্থ হয়েছে");
      }

      showToast("জব পোস্ট সফল হয়েছে এবং Escrow-তে টাকা লক রাখা হয়েছে!");
      postJobForm.reset();
      await fetchRealWalletBalance();

    } catch (err) {
      console.error("Job posting error:", err);
      showToast("ভুল হয়েছে: " + err.message, true);
    }
  });
}

/* ------------------------------------------------------------
   TASK SUBMISSION (DETERMINISTIC ID)
------------------------------------------------------------ */
window.submitTaskProof = async function(jobId, jobTitle) {
  if (!userAccessUnlocked) {
    return showToast("কাজ করতে কমপক্ষে ৳৩০০ ডিপোজিট অনুমোদন আবশ্যক।", true);
  }

  const proofText = prompt(`"${jobTitle}" কাজের জন্য আপনার প্রমান/ডেসক্রিপশন লিখুন:`);
  if (!proofText || !proofText.trim()) return;

  const taskId = `${jobId}_${currentUser.uid}`;

  try {
    showToast("কাজ জমা দেওয়া হচ্ছে...");
    await setDoc(doc(db, "tasks", taskId), {
      jobId,
      jobTitle,
      proof: proofText.trim(),
      uid: currentUser.uid,
      workerEmail: currentUser.email,
      workerName: currentUser.displayName || currentUser.email.split("@")[0],
      status: "pending",
      createdAt: serverTimestamp()
    });

    showToast("কাজ সফলভাবে জমা দেওয়া হয়েছে! অ্যাডমিন অ্যাপ্রুভালের জন্য অপেক্ষা করুন।");
  } catch (err) {
    console.error("Task submit error:", err);
    showToast("কাজ জমা দিতে সমস্যা হয়েছে: " + err.message, true);
  }
};

/* ------------------------------------------------------------
   DEPOSIT REQUEST SUBMISSION (MIN ৳300)
------------------------------------------------------------ */
const depositForm = $("depositForm");
if (depositForm) {
  depositForm.addEventListener("submit", async e => {
    e.preventDefault();

    const amount = Number($("depositAmountInput")?.value);
    const method = $("depositMethodSelect")?.value;
    const txId = $("depositTxIdInput")?.value.trim();

    if (amount < MIN_DEPOSIT_BDT) {
      return showToast(`সর্বনিম্ন ডিপোজিট পরিমাণ ৳${MIN_DEPOSIT_BDT} টাকা।`, true);
    }
    if (!txId) {
      return showToast("Transaction ID সঠিকভাবে দিন।", true);
    }

    try {
      showToast("ডিপোজিট রিকোয়েস্ট পাঠানো হচ্ছে...");
      await addDoc(collection(db, "deposits"), {
        uid: currentUser.uid,
        email: currentUser.email,
        name: currentUser.displayName || currentUser.email.split("@")[0],
        amount,
        method,
        transactionId: txId,
        status: "pending",
        createdAt: serverTimestamp()
      });

      showToast("ডিপোজিট রিকোয়েস্ট জমা হয়েছে! অ্যাডমিন যাচাই করে লাইফটাইম অ্যাক্সেস ও ব্যালেন্স যুক্ত করবেন।");
      depositForm.reset();
    } catch (err) {
      console.error("Deposit error:", err);
      showToast("ডিপোজিট সাবমিট ব্যর্থ: " + err.message, true);
    }
  });
}

/* ------------------------------------------------------------
   WITHDRAWAL REQUEST SUBMISSION (MIN ৳5000 FROM MAIN)
------------------------------------------------------------ */
const withdrawForm = $("withdrawForm");
if (withdrawForm) {
  withdrawForm.addEventListener("submit", async e => {
    e.preventDefault();

    const amount = Number($("withdrawAmountInput")?.value);
    const method = $("withdrawMethodSelect")?.value;
    const account = $("withdrawAccountInput")?.value.trim();

    if (amount < MIN_WITHDRAW_BDT) {
      return showToast(`সর্বনিম্ন উত্তোলন পরিমাণ ৳${MIN_WITHDRAW_BDT} টাকা।`, true);
    }
    if (realBalances.mainBalanceBDT < amount) {
      return showToast("আপনার Main Balance-এ পর্যাপ্ত টাকা নেই।", true);
    }
    if (!account) {
      return showToast("একাউন্ট নম্বর সঠিকভাবে দিন।", true);
    }

    try {
      showToast("উত্তোলনের আবেদন পাঠানো হচ্ছে...");
      await addDoc(collection(db, "withdrawals"), {
        uid: currentUser.uid,
        email: currentUser.email,
        name: currentUser.displayName || currentUser.email.split("@")[0],
        amount,
        method,
        account,
        status: "pending",
        createdAt: serverTimestamp()
      });

      showToast("উত্তোলন আবেদন সফল হয়েছে! অ্যাডমিন এটি ম্যানুয়ালি রিভিউ করবেন।");
      withdrawForm.reset();
    } catch (err) {
      console.error("Withdraw error:", err);
      showToast("উত্তোলন আবেদন ব্যর্থ: " + err.message, true);
    }
  });
}

/* ------------------------------------------------------------
   DATA LOADERS (JOBS & TASKS)
------------------------------------------------------------ */
function loadAvailableJobs() {
  const jobsListEl = $("availableJobsList");
  if (!jobsListEl) return;

  const q = query(collection(db, "jobs"), where("status", "==", "active"));
  const unsub = onSnapshot(q, snap => {
    if (snap.empty) {
      jobsListEl.innerHTML = `<div class="empty-state">বর্তমানে কোনো কাজ খালি নেই।</div>`;
      return;
    }

    jobsListEl.innerHTML = snap.docs.map(docSnap => {
      const job = docSnap.data();
      return `
        <div class="job-card">
          <div class="job-header">
            <h4>${escapeHtml(job.title)}</h4>
            <span class="reward-badge">${money(job.reward)}</span>
          </div>
          <p class="job-desc">${escapeHtml(job.description)}</p>
          <div class="job-footer">
            <small>ওয়ার্কার প্রয়োজন: ${job.workerCount} জন</small>
            <button class="primary-btn-sm" onclick="window.submitTaskProof('${docSnap.id}', '${escapeHtml(job.title)}')">
              কাজ করুন
            </button>
          </div>
        </div>
      `;
    }).join("");
  }, err => console.error("Jobs load error:", err));

  activeListeners.push(unsub);
}

function loadMySubmittedTasks() {
  const myTasksEl = $("myTasksList");
  if (!myTasksEl || !currentUser) return;

  const q = query(collection(db, "tasks"), where("uid", "==", currentUser.uid));
  const unsub = onSnapshot(q, snap => {
    if (snap.empty) {
      myTasksEl.innerHTML = `<div class="empty-state">আপনার কোনো জমা দেওয়া কাজ নেই।</div>`;
      return;
    }

    myTasksEl.innerHTML = snap.docs.map(docSnap => {
      const task = docSnap.data();
      return `
        <div class="task-card">
          <div class="task-header">
            <strong>${escapeHtml(task.jobTitle)}</strong>
            <span class="status-chip ${task.status}">${escapeHtml(task.status)}</span>
          </div>
          <p class="task-proof">প্রমাণ: ${escapeHtml(task.proof)}</p>
        </div>
      `;
    }).join("");
  }, err => console.error("Tasks load error:", err));

  activeListeners.push(unsub);
}

console.log("Micro Job App - Authentication & Escrow Engine Ready");
