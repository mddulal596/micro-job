/* ============================================================
   MICRO JOB APP.JS
   MATCHES index.html IDs
   AUTH + REAL WALLET + ESCROW + LIFETIME ACCESS
============================================================ */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  getIdTokenResult
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  collection,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  orderBy,
  limit
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const WORKER_API = "https://microjob-secure-api.mddulalhosen6.workers.dev";
const MIN_DEPOSIT = 300;
const MIN_WITHDRAW = 5000;

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const $ = id => document.getElementById(id);

let currentUser = null;
let isAdmin = false;
let workUnlocked = false;
let balances = { main: 0, deposit: 0 };
let listeners = [];
let busy = false;

/* -------------------- helpers -------------------- */
function money(v) {
  return "৳ " + (Number(v) || 0).toLocaleString("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function escapeHtml(s = "") {
  return String(s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

function showMsg(text, type = "success", boxId = "messageBox") {
  const el = $(boxId) || $("authMessage");
  if (!el) return;
  el.textContent = text;
  el.className = "message " + type;
  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), 4000);
}

function stopListeners() {
  listeners.forEach(u => { try { u(); } catch (e) {} });
  listeners = [];
}

/* -------------------- view switch -------------------- */
function showAuth() {
  $("authView")?.classList.remove("hidden");
  $("appView")?.classList.add("hidden");
  if ($("authView")) $("authView").style.display = "";
  if ($("appView")) $("appView").style.display = "none";
}

function showApp() {
  $("authView")?.classList.add("hidden");
  $("appView")?.classList.remove("hidden");
  if ($("authView")) $("authView").style.display = "none";
  if ($("appView")) $("appView").style.display = "";
}

function showLoginBox() {
  $("loginBox")?.classList.remove("hidden");
  $("registerBox")?.classList.add("hidden");
}

function showRegisterBox() {
  $("registerBox")?.classList.remove("hidden");
  $("loginBox")?.classList.add("hidden");
}

$("showRegister")?.addEventListener("click", e => {
  e.preventDefault();
  showRegisterBox();
});

$("showLogin")?.addEventListener("click", e => {
  e.preventDefault();
  showLoginBox();
});

/* -------------------- pages / bottom nav -------------------- */
function goPage(page) {
  if (!workUnlocked && (page === "jobs" || page === "post" || page === "tasks")) {
    showMsg("কাজ/জব পোস্ট করতে আগে ৳300+ Deposit Approve করুন।", "error");
    goPage("deposit");
    return;
  }

  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));

  const panelMap = {
    dashboard: "dashboardPanel",
    jobs: "jobsPanel",
    post: "postPanel",
    tasks: "tasksPanel",
    wallet: "walletPanel",
    deposit: "depositPanel",
    withdraw: "withdrawPanel",
    profile: "profilePanel"
  };

  const panel = $(panelMap[page] || "dashboardPanel");
  if (panel) panel.classList.add("active");

  document.querySelectorAll(`.nav-btn[data-go="${page}"]`).forEach(b => b.classList.add("active"));
  if (page === "dashboard") {
    document.querySelector(`.nav-btn[data-go="dashboard"]`)?.classList.add("active");
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.addEventListener("click", e => {
  const btn = e.target.closest("[data-go]");
  if (!btn) return;
  e.preventDefault();
  goPage(btn.getAttribute("data-go"));
});

/* -------------------- balance UI -------------------- */
function renderBalances() {
  const m = money(balances.main);
  const d = money(balances.deposit);
  const t = money(balances.main + balances.deposit);

  const map = {
    headerBalance: t,
    balanceAmount: t,
    mainBalanceAmount: m,
    depositBalanceAmount: d,
    walletBalance: t,
    walletMainBalance: m,
    walletDepositBalance: d,
    profileBalance: m,
    profileDepositBalance: d
  };

  Object.entries(map).forEach(([id, val]) => {
    if ($(id)) $(id).textContent = val;
  });

  updateJobCostHint();
}

async function fetchWallet() {
  if (!currentUser) return;
  try {
    const token = await currentUser.getIdToken();
    const res = await fetch(`${WORKER_API}/wallet/my`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    if (res.ok && data.success) {
      balances.main = Number(data.mainBalanceBDT) || 0;
      balances.deposit = Number(data.depositBalanceBDT) || 0;
      renderBalances();
    }
  } catch (err) {
    console.error("wallet fetch", err);
  }
}

/* -------------------- lifetime access -------------------- */
function listenAccess(uid) {
  const unsub = onSnapshot(doc(db, "userAccess", uid), snap => {
    const ok = snap.exists() && snap.data().workEnabled === true;
    workUnlocked = ok;
    updateActivationUI(ok);
  }, err => console.error(err));
  listeners.push(unsub);
}

function updateActivationUI(ok) {
  const card = $("activationCard");
  const icon = $("activationIcon");
  const title = $("activationTitle");
  const desc = $("activationDescription");
  const status = $("profileActivationStatus");

  if (card) {
    card.classList.toggle("locked", !ok);
    card.classList.toggle("unlocked", ok);
  }
  if (icon) icon.className = ok ? "fa-solid fa-unlock" : "fa-solid fa-lock";
  if (title) title.textContent = ok ? "Lifetime Access Active" : "Account Not Activated";
  if (desc) {
    desc.textContent = ok
      ? "আপনার Lifetime Work Access চালু আছে। Jobs ও Post Job ব্যবহার করতে পারবেন।"
      : "কাজ শুরু করতে কমপক্ষে ৳300 Deposit Request করুন। Admin Approve করলে Lifetime Work Access চালু হবে।";
  }
  if (status) status.textContent = ok ? "Activation: Unlocked (Lifetime)" : "Activation: Locked";
}

/* -------------------- auth -------------------- */
$("loginForm")?.addEventListener("submit", async e => {
  e.preventDefault();
  if (busy) return;

  const email = $("loginEmail")?.value.trim();
  const password = $("loginPassword")?.value;

  if (!email || !password) {
    return showMsg("ইমেইল ও পাসওয়ার্ড লিখুন।", "error", "authMessage");
  }

  busy = true;
  try {
    showMsg("লগইন হচ্ছে...", "success", "authMessage");
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    let msg = "লগইন ব্যর্থ।";
    if (err.code === "auth/user-not-found") msg = "অ্যাকাউন্ট পাওয়া যায়নি।";
    if (err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") msg = "ইমেইল/পাসওয়ার্ড ভুল।";
    showMsg(msg, "error", "authMessage");
  } finally {
    busy = false;
  }
});

$("registerForm")?.addEventListener("submit", async e => {
  e.preventDefault();
  if (busy) return;

  const name = $("regName")?.value.trim();
  const email = $("regEmail")?.value.trim();
  const password = $("regPassword")?.value;

  if (!name || !email || !password) {
    return showMsg("সব ঘর পূরণ করুন।", "error", "authMessage");
  }
  if (password.length < 6) {
    return showMsg("পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।", "error", "authMessage");
  }

  busy = true;
  try {
    showMsg("অ্যাকাউন্ট তৈরি হচ্ছে...", "success", "authMessage");
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(doc(db, "users", cred.user.uid), {
      name,
      email,
      uid: cred.user.uid,
      mainBalance: 0,
      depositBalance: 0,
      createdAt: serverTimestamp()
    });
    showMsg("অ্যাকাউন্ট তৈরি হয়েছে!", "success", "authMessage");
  } catch (err) {
    let msg = "সাইনআপ ব্যর্থ।";
    if (err.code === "auth/email-already-in-use") msg = "ইমেইলটি আগেই ব্যবহৃত হয়েছে।";
    if (err.code === "auth/invalid-email") msg = "সঠিক ইমেইল লিখুন।";
    showMsg(msg, "error", "authMessage");
  } finally {
    busy = false;
  }
});

$("logoutBtn")?.addEventListener("click", async () => {
  try {
    await signOut(auth);
  } catch (err) {
    showMsg("Logout সমস্যা: " + err.message, "error");
  }
});

onAuthStateChanged(auth, async user => {
  stopListeners();
  currentUser = user;
  isAdmin = false;
  workUnlocked = false;
  balances = { main: 0, deposit: 0 };

  if (!user) {
    showAuth();
    showLoginBox();
    return;
  }

  try {
    const token = await getIdTokenResult(user, true);
    isAdmin = token.claims.admin === true;
    if ($("adminLink")) {
      $("adminLink").classList.toggle("hidden", !isAdmin);
    }
  } catch (e) {
    isAdmin = false;
  }

  showApp();
  goPage("dashboard");

  if ($("welcomeText")) {
    $("welcomeText").textContent = "Welcome 👋";
  }
  if ($("profileEmail")) $("profileEmail").textContent = user.email || "-";
  if ($("profileDisplayName")) $("profileDisplayName").textContent = user.email?.split("@")[0] || "User";

  // ensure user doc
  try {
    const uref = doc(db, "users", user.uid);
    const usnap = await getDoc(uref);
    if (!usnap.exists()) {
      await setDoc(uref, {
        name: user.email?.split("@")[0] || "User",
        email: user.email || "",
        uid: user.uid,
        mainBalance: 0,
        depositBalance: 0,
        createdAt: serverTimestamp()
      });
    } else {
      const d = usnap.data();
      if ($("profileDisplayName")) $("profileDisplayName").textContent = d.name || "User";
      if ($("profileName")) $("profileName").value = d.name || "";
    }
  } catch (e) {
    console.error(e);
  }

  listenAccess(user.uid);
  await fetchWallet();
  startDataListeners(user.uid);
});

/* -------------------- live lists -------------------- */
function startDataListeners(uid) {
  // active jobs home + jobs page
  const qJobs = query(collection(db, "jobs"), where("status", "==", "active"), limit(50));
  listeners.push(onSnapshot(qJobs, snap => {
    const html = snap.empty
      ? `<div class="empty-state">এখন কোনো Active Job নেই।</div>`
      : snap.docs.map(d => jobCard(d.id, d.data(), true)).join("");
    if ($("homeJobsList")) $("homeJobsList").innerHTML = html;
    if ($("activeJobsList")) $("activeJobsList").innerHTML = html;
    fillTaskJobSelect(snap.docs);
  }));

  // my posted jobs
  const qMyJobs = query(collection(db, "jobs"), where("creatorUid", "==", uid), limit(50));
  listeners.push(onSnapshot(qMyJobs, snap => {
    if (!$("myJobsList")) return;
    $("myJobsList").innerHTML = snap.empty
      ? `<div class="empty-state">আপনি এখনো জব পোস্ট করেননি।</div>`
      : snap.docs.map(d => jobCard(d.id, d.data(), false)).join("");
  }));

  // my tasks
  const qTasks = query(collection(db, "tasks"), where("uid", "==", uid), limit(50));
  listeners.push(onSnapshot(qTasks, snap => {
    let completed = 0;
    let pending = 0;
    snap.docs.forEach(d => {
      const st = d.data().status;
      if (st === "approved") completed++;
      if (st === "pending") pending++;
    });
    if ($("completedJobsCount")) $("completedJobsCount").textContent = completed;
    if ($("pendingJobsCount")) $("pendingJobsCount").textContent = pending;

    if ($("myTasksList")) {
      $("myTasksList").innerHTML = snap.empty
        ? `<div class="empty-state">কোনো টাস্ক নেই।</div>`
        : snap.docs.map(d => {
            const t = d.data();
            return `<div class="job-card">
              <div class="job-header">
                <h4>${escapeHtml(t.jobTitle || "Task")}</h4>
                <span class="status-chip ${escapeHtml(t.status || "")}">${escapeHtml(t.status || "")}</span>
              </div>
              <p>${escapeHtml(t.proof || "")}</p>
            </div>`;
          }).join("");
    }
  }));

  // deposits history
  const qDep = query(collection(db, "deposits"), where("uid", "==", uid), limit(30));
  listeners.push(onSnapshot(qDep, snap => {
    if (!$("depositHistoryList")) return;
    $("depositHistoryList").innerHTML = snap.empty
      ? `<div class="empty-state">কোনো Deposit History নেই।</div>`
      : snap.docs.map(d => {
          const x = d.data();
          return `<div class="job-card">
            <div class="job-header">
              <h4>${money(x.amount)}</h4>
              <span class="status-chip ${escapeHtml(x.status || "")}">${escapeHtml(x.status || "")}</span>
            </div>
            <p>${escapeHtml(x.method || "")} • ${escapeHtml(x.transactionId || "")}</p>
          </div>`;
        }).join("");
  }));

  // withdraw history
  const qWd = query(collection(db, "withdrawals"), where("uid", "==", uid), limit(30));
  listeners.push(onSnapshot(qWd, snap => {
    if (!$("withdrawHistoryList")) return;
    $("withdrawHistoryList").innerHTML = snap.empty
      ? `<div class="empty-state">কোনো Withdraw History নেই।</div>`
      : snap.docs.map(d => {
          const x = d.data();
          return `<div class="job-card">
            <div class="job-header">
              <h4>${money(x.amount)}</h4>
              <span class="status-chip ${escapeHtml(x.status || "")}">${escapeHtml(x.status || "")}</span>
            </div>
            <p>${escapeHtml(x.method || "")} • ${escapeHtml(x.account || "")}</p>
          </div>`;
        }).join("");
  }));
}

function jobCard(id, job, canWork) {
  return `<div class="job-card">
    <div class="job-header">
      <h4>${escapeHtml(job.title || "")}</h4>
      <span class="reward-badge">${money(job.reward)}</span>
    </div>
    <p class="job-desc">${escapeHtml(job.description || "")}</p>
    <div class="job-footer">
      <small>Workers: ${escapeHtml(String(job.workers || job.workerCount || 1))} • Status: ${escapeHtml(job.status || "")}</small>
      ${canWork ? `<button type="button" class="btn-primary" style="margin-top:8px" onclick="window.quickApply('${id}','${escapeHtml(job.title || "")}')">কাজ করুন</button>` : ""}
    </div>
  </div>`;
}

function fillTaskJobSelect(docs) {
  const sel = $("taskJobSelect");
  if (!sel) return;
  const current = sel.value;
  sel.innerHTML = `<option value="">Select Job</option>` + docs.map(d => {
    const j = d.data();
    return `<option value="${d.id}">${escapeHtml(j.title || d.id)} (${money(j.reward)})</option>`;
  }).join("");
  if (current) sel.value = current;
}

window.quickApply = function (jobId, title) {
  goPage("tasks");
  if ($("taskJobSelect")) $("taskJobSelect").value = jobId;
  if ($("taskProof")) $("taskProof").focus();
  showMsg(`"${title}" সিলেক্ট হয়েছে। Proof লিখে Submit করুন।`);
};

/* -------------------- job cost calculator -------------------- */
function updateJobCostHint() {
  const reward = Number($("jobReward")?.value) || 0;
  const workers = Number($("jobWorkers")?.value) || 0;
  const total = reward * workers;
  const payFrom = $("jobPayFrom")?.value || "deposit";
  if ($("jobTotalCost")) $("jobTotalCost").textContent = money(total);

  const have = payFrom === "main" ? balances.main : balances.deposit;
  if ($("jobBalanceHint")) {
    $("jobBalanceHint").textContent = total <= 0
      ? "Reward ও Workers লিখুন।"
      : `Total ${money(total)} ${payFrom === "main" ? "Main" : "Deposit"} থেকে কাটা হবে। Available: ${money(have)}`;
  }
}

["jobReward", "jobWorkers", "jobPayFrom"].forEach(id => {
  $(id)?.addEventListener("input", updateJobCostHint);
  $(id)?.addEventListener("change", updateJobCostHint);
});

/* -------------------- POST JOB + ESCROW -------------------- */
$("jobForm")?.addEventListener("submit", async e => {
  e.preventDefault();
  if (!currentUser || busy) return;
  if (!workUnlocked) return showMsg("আগে Lifetime Access চালু করুন (৳300+ Deposit Approve)।", "error");

  const title = $("jobTitle")?.value.trim();
  const description = $("jobDescription")?.value.trim();
  const reward = Number($("jobReward")?.value);
  const workers = Number($("jobWorkers")?.value);
  const payFrom = $("jobPayFrom")?.value === "main" ? "main" : "deposit";
  const total = reward * workers;

  if (!title || !description || !(reward > 0) || !(workers > 0)) {
    return showMsg("সব তথ্য সঠিকভাবে দিন।", "error");
  }

  const available = payFrom === "main" ? balances.main : balances.deposit;
  if (available < total) {
    return showMsg(`পর্যাপ্ত ব্যালেন্স নেই। প্রয়োজন ${money(total)}`, "error");
  }

  busy = true;
  try {
    showMsg("জব তৈরি ও Escrow ফান্ডিং হচ্ছে...");

    const jobRef = await addDoc(collection(db, "jobs"), {
      title,
      description,
      reward,
      workers,
      workerCount: workers,
      creatorUid: currentUser.uid,
      creatorEmail: currentUser.email || "",
      creatorName: $("profileDisplayName")?.textContent || "User",
      status: "pending",
      payFrom,
      createdAt: serverTimestamp()
    });

    const token = await currentUser.getIdToken();
    const res = await fetch(`${WORKER_API}/jobs/fund-escrow`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        jobId: jobRef.id,
        rewardBDT: reward,
        workerCount: workers,
        fundSource: payFrom
      })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      // best-effort mark failed funding note; job stays pending for admin review
      throw new Error(data.message || data.error || "Escrow funding failed");
    }

    showMsg("জব সাবমিট হয়েছে! টাকা Escrow-তে লক হয়েছে। Admin Approve করলে Active হবে।");
    $("jobForm").reset();
    updateJobCostHint();
    await fetchWallet();
    goPage("post");
  } catch (err) {
    console.error(err);
    showMsg("জব পোস্ট ব্যর্থ: " + err.message, "error");
  } finally {
    busy = false;
  }
});

/* -------------------- TASK SUBMIT -------------------- */
$("taskForm")?.addEventListener("submit", async e => {
  e.preventDefault();
  if (!currentUser || busy) return;
  if (!workUnlocked) return showMsg("Lifetime Access লাগবে।", "error");

  const jobId = $("taskJobSelect")?.value;
  const proof = $("taskProof")?.value.trim();
  if (!jobId || !proof) return showMsg("Job ও Proof দিন।", "error");

  busy = true;
  try {
    const jobSnap = await getDoc(doc(db, "jobs", jobId));
    if (!jobSnap.exists() || jobSnap.data().status !== "active") {
      throw new Error("Job Active নেই।");
    }
    const job = jobSnap.data();
    const taskId = `${jobId}_${currentUser.uid}`;

    await setDoc(doc(db, "tasks", taskId), {
      jobId,
      jobTitle: job.title || "",
      proof,
      uid: currentUser.uid,
      workerEmail: currentUser.email || "",
      workerName: $("profileDisplayName")?.textContent || "Worker",
      status: "pending",
      createdAt: serverTimestamp()
    });

    showMsg("টাস্ক জমা হয়েছে! Admin Approve করলে পেমেন্ট হবে।");
    $("taskForm").reset();
  } catch (err) {
    console.error(err);
    showMsg("টাস্ক জমা ব্যর্থ: " + err.message, "error");
  } finally {
    busy = false;
  }
});

/* -------------------- DEPOSIT -------------------- */
$("depositForm")?.addEventListener("submit", async e => {
  e.preventDefault();
  if (!currentUser || busy) return;

  const method = $("depositMethod")?.value;
  const amount = Number($("depositAmount")?.value);
  const txn = $("depositTxn")?.value.trim();
  const note = $("depositNote")?.value.trim();

  if (!(amount >= MIN_DEPOSIT)) {
    return showMsg(`সর্বনিম্ন ডিপোজিট ৳${MIN_DEPOSIT}`, "error");
  }
  if (!txn) return showMsg("Transaction ID দিন।", "error");

  busy = true;
  try {
    await addDoc(collection(db, "deposits"), {
      uid: currentUser.uid,
      email: currentUser.email || "",
      name: $("profileDisplayName")?.textContent || "User",
      amount,
      method,
      transactionId: txn,
      note: note || "",
      status: "pending",
      createdAt: serverTimestamp()
    });
    showMsg("Deposit Request পাঠানো হয়েছে। Admin Approve করলে Balance + Lifetime Access হবে।");
    $("depositForm").reset();
    goPage("wallet");
  } catch (err) {
    showMsg("Deposit ব্যর্থ: " + err.message, "error");
  } finally {
    busy = false;
  }
});

/* -------------------- WITHDRAW -------------------- */
$("withdrawForm")?.addEventListener("submit", async e => {
  e.preventDefault();
  if (!currentUser || busy) return;

  const method = $("withdrawMethod")?.value;
  const amount = Number($("withdrawAmount")?.value);
  const account = $("withdrawAccount")?.value.trim();
  const note = $("withdrawNote")?.value.trim();

  if (!(amount >= MIN_WITHDRAW)) {
    return showMsg(`সর্বনিম্ন উত্তোলন ৳${MIN_WITHDRAW}`, "error");
  }
  if (balances.main < amount) {
    return showMsg("Main Balance অপর্যাপ্ত।", "error");
  }
  if (!account) return showMsg("Account Number দিন।", "error");

  busy = true;
  try {
    await addDoc(collection(db, "withdrawals"), {
      uid: currentUser.uid,
      email: currentUser.email || "",
      name: $("profileDisplayName")?.textContent || "User",
      amount,
      method,
      account,
      note: note || "",
      status: "pending",
      createdAt: serverTimestamp()
    });
    showMsg("Withdraw Request গৃহীত হয়েছে। Admin ম্যানুয়ালি যাচাই করবে।");
    $("withdrawForm").reset();
    goPage("wallet");
  } catch (err) {
    showMsg("Withdraw ব্যর্থ: " + err.message, "error");
  } finally {
    busy = false;
  }
});

/* -------------------- PROFILE UPDATE -------------------- */
$("profileForm")?.addEventListener("submit", async e => {
  e.preventDefault();
  if (!currentUser || busy) return;
  const name = $("profileName")?.value.trim();
  if (!name) return showMsg("নাম লিখুন।", "error");

  busy = true;
  try {
    await updateDoc(doc(db, "users", currentUser.uid), { name });
    if ($("profileDisplayName")) $("profileDisplayName").textContent = name;
    showMsg("প্রোফাইল আপডেট হয়েছে।");
  } catch (err) {
    // if update blocked by rules, try set merge via limited fields only fails — show error
    showMsg("প্রোফাইল আপডেট ব্যর্থ: " + err.message, "error");
  } finally {
    busy = false;
  }
});

/* -------------------- init -------------------- */
showAuth();
showLoginBox();
console.log("Micro Job app.js ready — matched to index.html");
