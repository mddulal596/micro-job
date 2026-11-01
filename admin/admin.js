/* ==========================================
   MICRO JOB ADMIN PANEL
   REAL MONEY ENGINE INTEGRATED
   FIREBASE + CLOUDFLARE D1
========================================== */

import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";

import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  signOut,
  getIdTokenResult
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  getFirestore,
  collection,
  onSnapshot,
  doc,
  runTransaction,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import {
  firebaseConfig
} from "../firebase-config.js";

/* ==========================================
   CONFIG & INITIALIZATION
========================================== */

const WORKER_API = "https://microjob-secure-api.mddulalhosen6.workers.dev";
const MIN_DEPOSIT = 300;

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

const $ = id => document.getElementById(id);

let currentAdmin = null;
let listeners = [];
let authVersion = 0;
let busy = false;
let usersLoaded = false;
let activeTab = "jobs";

const records = { jobs: [], tasks: [], deposits: [], withdrawals: [], users: [] };
const filters = { jobs: "pending", tasks: "pending", deposits: "pending", withdrawals: "pending" };

const settings = {
  jobs: { panel: "adminJobsPanel", list: "adminJobsList", count: "pendingJobsCount", title: "Jobs" },
  tasks: { panel: "adminTasksPanel", list: "adminTasksList", count: "pendingTasksCount", title: "Tasks" },
  deposits: { panel: "adminDepositsPanel", list: "adminDepositsList", count: "pendingDepositsCount", title: "Deposits" },
  withdrawals: { panel: "adminWithdrawalsPanel", list: "adminWithdrawalsList", count: "pendingWithdrawalsCount", title: "Withdrawals" }
};

/* ==========================================
   HELPERS
========================================== */

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[c]);
}

function text(value) {
  if (value === null || value === undefined || value === "") return "—";
  return escapeHtml(String(value));
}

function money(value) {
  const amount = Number(value) || 0;
  return "৳ " + amount.toLocaleString("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function dateText(value) {
  if (!value) return "—";
  try {
    const date = typeof value.toDate === "function" ? value.toDate() : value.seconds ? new Date(value.seconds * 1000) : null;
    return date ? date.toLocaleString("bn-BD") : "—";
  } catch (e) {
    return "—";
  }
}

function row(label, value) {
  return `<p><strong>${escapeHtml(label)}:</strong> ${text(value)}</p>`;
}

function statusChip(status = "pending") {
  const safeStatus = escapeHtml(status);
  return `<span class="status-chip ${safeStatus}">${safeStatus}</span>`;
}

function emptyState(message) {
  return `<div class="empty-state">${escapeHtml(message)}</div>`;
}

function sortNewest(items) {
  return [...items].sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
}

function setMessage(value, type = "success") {
  const el = $("adminMessage");
  if (!el) return;
  el.textContent = value;
  el.className = "message " + type;
}

function clearMessage() {
  const el = $("adminMessage");
  if (!el) return;
  el.textContent = "";
  el.className = "message hidden";
}

function loginMessage(value) {
  const el = $("adminLoginMessage");
  if (el) el.textContent = value;
}

function showLogin() {
  $("adminLoginView").style.display = "flex";
  $("adminDashboardView").style.display = "none";
  $("adminLogoutBtn").style.display = "none";
}

function showDashboard() {
  $("adminLoginView").style.display = "none";
  $("adminDashboardView").style.display = "block";
  $("adminLogoutBtn").style.display = "inline-flex";
}

function stopListeners() {
  listeners.forEach(unsub => { try { unsubscribe(); } catch (e) {} });
  listeners = [];
}

function resetData() {
  Object.keys(records).forEach(k => { records[k] = []; });
  usersLoaded = false;
  updateCounts();
  renderAll();
}

/* ==========================================
   AUTHENTICATION
========================================== */

$("adminLoginForm").addEventListener("submit", async e => {
  e.preventDefault();
  const email = $("adminEmail").value.trim();
  const password = $("adminPassword").value;
  const btn = e.target.querySelector('button[type="submit"]');

  if (!email || !password) return loginMessage("ইমেইল ও পাসওয়ার্ড লিখুন।");
  btn.disabled = true;
  loginMessage("লগইন হচ্ছে...");

  try {
    await signInWithEmailAndPassword(auth, email, password);
    loginMessage("Admin অনুমতি যাচাই করা হচ্ছে...");
  } catch (err) {
    loginMessage("লগইন ব্যর্থ: " + err.message);
  } finally {
    btn.disabled = false;
  }
});

$("adminGoogleLoginBtn").addEventListener("click", async () => {
  const btn = $("adminGoogleLoginBtn");
  btn.disabled = true;
  loginMessage("Google Login চালু হচ্ছে...");

  try {
    await signInWithPopup(auth, googleProvider);
    loginMessage("Admin অনুমতি যাচাই করা হচ্ছে...");
  } catch (err) {
    if (["auth/popup-blocked", "auth/operation-not-supported-in-this-environment"].includes(err.code)) {
      try {
        await signInWithRedirect(auth, googleProvider);
      } catch (re) {
        loginMessage("Google Login ব্যর্থ: " + re.message);
      }
    } else {
      loginMessage("Google Login ব্যর্থ: " + err.message);
    }
  } finally {
    btn.disabled = false;
  }
});

getRedirectResult(auth).catch(err => loginMessage("Google Login ব্যর্থ: " + err.message));

$("adminLogoutBtn").addEventListener("click", async () => {
  try { await signOut(auth); } catch (e) { setMessage("Logout ব্যর্থ: " + e.message, "error"); }
});

onAuthStateChanged(auth, async user => {
  const version = ++authVersion;
  stopListeners();
  currentAdmin = null;
  resetData();
  clearMessage();

  if (!user) return showLogin();
  loginMessage("Admin অনুমতি যাচাই হচ্ছে...");

  try {
    const tokenResult = await getIdTokenResult(user, true);
    if (version !== authVersion) return;

    if (tokenResult.claims.admin !== true) {
      showLogin();
      loginMessage("এই অ্যাকাউন্টে Admin অনুমতি নেই।");
      await signOut(auth);
      return;
    }

    currentAdmin = user;
    loginMessage("");
    showDashboard();
    startListeners();
  } catch (err) {
    if (version !== authVersion) return;
    showLogin();
    loginMessage("Admin যাচাই করা যায়নি: " + err.message);
  }
});

/* ==========================================
   NAVIGATION & FILTERS
========================================== */

const panels = { jobs: "adminJobsPanel", tasks: "adminTasksPanel", deposits: "adminDepositsPanel", withdrawals: "adminWithdrawalsPanel", users: "adminUsersPanel" };

document.querySelectorAll("[data-admin-tab]").forEach(btn => {
  btn.addEventListener("click", () => {
    const selected = btn.dataset.adminTab;
    if (!panels[selected]) return;
    activeTab = selected;

    document.querySelectorAll("[data-admin-tab]").forEach(t => t.classList.toggle("active", t === btn));
    Object.entries(panels).forEach(([name, id]) => {
      const p = $(id);
      if (p) p.style.display = name === selected ? "block" : "none";
    });
  });
});

function updatePanelHeading(name) {
  const config = settings[name];
  if (!config) return;
  const panel = $(config.panel);
  if (!panel) return;
  const heading = panel.querySelector(".panel-heading h2");
  if (!heading) return;

  const selected = filters[name];
  const labels = { pending: "Pending", approved: "Approved", rejected: "Rejected", all: "All" };
  const icons = { jobs: "fa-briefcase", tasks: "fa-list-check", deposits: "fa-wallet", withdrawals: "fa-money-bill-transfer" };

  heading.innerHTML = `<i class="fa-solid ${icons[name]}"></i> ${selected === "all" ? "All " + config.title + " History" : labels[selected] + " " + config.title}`;
}

function createHistoryFilters() {
  Object.entries(settings).forEach(([name, config]) => {
    const panel = $(config.panel);
    const list = $(config.list);
    if (!panel || !list) return;

    const existing = panel.querySelector(".history-filters");
    if (existing) existing.remove();

    const wrapper = document.createElement("div");
    wrapper.className = "history-filters";
    wrapper.style.cssText = "display:flex;gap:8px;overflow-x:auto;padding:12px 0;margin:10px 0;";

    wrapper.innerHTML = `
      <button type="button" class="history-filter" data-history-collection="${name}" data-history-status="pending">Pending</button>
      <button type="button" class="history-filter" data-history-collection="${name}" data-history-status="approved">Approved</button>
      <button type="button" class="history-filter" data-history-collection="${name}" data-history-status="rejected">Rejected</button>
      <button type="button" class="history-filter" data-history-collection="${name}" data-history-status="all">All History</button>
    `;

    panel.insertBefore(wrapper, list);
    setFilterStyle(wrapper, filters[name]);
    updatePanelHeading(name);
  });
}

function setFilterStyle(wrapper, selected) {
  wrapper.querySelectorAll(".history-filter").forEach(btn => {
    const active = btn.dataset.historyStatus === selected;
    btn.style.cssText = `border:1px solid ${active ? '#5145e5' : '#e2e8f0'};background:${active ? '#5145e5' : '#ffffff'};color:${active ? '#ffffff' : '#475569'};border-radius:10px;padding:10px 13px;font-size:13px;font-weight:700;white-space:nowrap;flex-shrink:0;cursor:pointer;`;
  });
}

document.addEventListener("click", e => {
  const btn = e.target.closest("[data-history-collection][data-history-status]");
  if (!btn) return;
  const name = btn.dataset.historyCollection;
  const status = btn.dataset.historyStatus;
  if (!settings[name] || !["pending", "approved", "rejected", "all"].includes(status)) return;

  filters[name] = status;
  setFilterStyle(btn.parentElement, status);
  updatePanelHeading(name);
  renderCollection(name);
});

function updateCounts() {
  Object.entries(settings).forEach(([name, config]) => {
    const count = records[name].filter(item => item.status === "pending").length;
    const el = $(config.count);
    if (el) el.textContent = count;
  });
  if ($("totalUsersCount")) $("totalUsersCount").textContent = records.users.length;
}

/* ==========================================
   LISTENERS & RENDER
========================================== */

function startListeners() {
  stopListeners();
  ["jobs", "tasks", "deposits", "withdrawals"].forEach(name => {
    const unsub = onSnapshot(collection(db, name), snapshot => {
      records[name] = sortNewest(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })));
      updateCounts();
      renderCollection(name);
    }, err => console.error(name + " error:", err));
    listeners.push(unsub);
  });

  const usersUnsub = onSnapshot(collection(db, "users"), snapshot => {
    records.users = sortNewest(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })));
    usersLoaded = true;
    updateCounts();
    renderUsers();
    renderCollection("tasks");
  }, err => console.error("users error:", err));
  listeners.push(usersUnsub);
}

function findWorker(task) {
  let workerUid = task.uid || task.workerId || task.workerUid || task.userId || task.createdBy || "";
  if (!workerUid && typeof task.id === "string" && typeof task.jobId === "string") {
    const prefix = task.jobId + "_";
    if (task.id.startsWith(prefix)) workerUid = task.id.slice(prefix.length);
  }
  const matchedUser = records.users.find(u => u.id === workerUid || u.uid === workerUid);
  return {
    uid: workerUid,
    name: task.workerName || task.name || matchedUser?.name || matchedUser?.displayName || "তথ্য পাওয়া যায়নি",
    email: task.workerEmail || task.email || matchedUser?.email || "তথ্য পাওয়া যায়নি"
  };
}

function getFilteredData(name) {
  const selected = filters[name];
  if (selected === "all") return records[name];
  if (name === "jobs" && selected === "approved") {
    return records.jobs.filter(i => i.status === "active" || i.status === "approved");
  }
  return records[name].filter(i => i.status === selected);
}

function actionButtons(name, id, status, allowApprove = true) {
  if (status !== "pending") {
    return `<div class="admin-actions">${statusChip(status)} <span style="color:#64748b;font-size:13px;">Processed</span></div>`;
  }
  return `
    <div class="admin-actions">
      ${allowApprove ? `<button type="button" class="approve-btn" data-action="approve" data-collection="${escapeHtml(name)}" data-id="${escapeHtml(id)}"><i class="fa-solid fa-check"></i> Approve</button>` : ''}
      <button type="button" class="reject-btn" data-action="reject" data-collection="${escapeHtml(name)}" data-id="${escapeHtml(id)}"><i class="fa-solid fa-xmark"></i> Reject</button>
    </div>
  `;
}

function jobCard(job) {
  return `<article class="admin-item"><div class="admin-item-header"><div><h3 class="admin-item-title">${text(job.title)}</h3><div class="admin-item-subtitle">${dateText(job.createdAt)}</div></div>${statusChip(job.status)}</div><div class="admin-item-body">${row("Posted By", job.creatorName)}${row("Reward", money(job.reward))}${row("Job ID", job.id)}<p><strong>Description:</strong></p><div class="long-text">${text(job.description)}</div></div>${actionButtons("jobs", job.id, job.status)}</article>`;
}

function taskCard(task) {
  const worker = findWorker(task);
  return `<article class="admin-item"><div class="admin-item-header"><div><h3 class="admin-item-title">${text(task.jobTitle)}</h3><div class="admin-item-subtitle">${dateText(task.createdAt)}</div></div>${statusChip(task.status)}</div><div class="admin-item-body">${row("Worker", worker.name)}${row("Email", worker.email)}${row("Worker UID", worker.uid)}${row("Job ID", task.jobId)}${row("Task ID", task.id)}<p><strong>Proof:</strong></p><div class="long-text">${text(task.proof)}</div></div>${actionButtons("tasks", task.id, task.status)}</article>`;
}

function depositCard(deposit) {
  return `<article class="admin-item"><div class="admin-item-header"><div><h3 class="admin-item-title">${money(deposit.amount)}</h3><div class="admin-item-subtitle">${dateText(deposit.createdAt)}</div></div>${statusChip(deposit.status)}</div><div class="admin-item-body">${row("User", deposit.name)}${row("Method", deposit.method)}${row("TxID", deposit.transactionId)}${row("UID", deposit.uid)}</div>${actionButtons("deposits", deposit.id, deposit.status, Number(deposit.amount) >= MIN_DEPOSIT)}</article>`;
}

function withdrawalCard(item) {
  return `<article class="admin-item"><div class="admin-item-header"><div><h3 class="admin-item-title">${money(item.amount)}</h3><div class="admin-item-subtitle">${dateText(item.createdAt)}</div></div>${statusChip(item.status)}</div><div class="admin-item-body">${row("User", item.name)}${row("Account", item.account)}</div>${actionButtons("withdrawals", item.id, item.status, false)}</article>`;
}

function renderCollection(name) {
  const config = settings[name];
  if (!config) return;
  const container = $(config.list);
  if (!container) return;

  const data = getFilteredData(name);
  if (!data.length) {
    container.innerHTML = emptyState("কোনো " + filters[name].toUpperCase() + " " + config.title + " পাওয়া যায়নি।");
    return;
  }
  const renderers = { jobs: jobCard, tasks: taskCard, deposits: depositCard, withdrawals: withdrawalCard };
  container.innerHTML = data.map(renderers[name]).join("");
}

function renderUsers() {
  const container = $("adminUsersList");
  if (!records.users.length) return container.innerHTML = emptyState("কোনো User পাওয়া যায়নি।");
  container.innerHTML = records.users.map(u => `<article class="admin-item"><h3 class="admin-item-title">${text(u.name)}</h3><div class="admin-item-body">${row("Email", u.email)}${row("UID", u.uid || u.id)}</div></article>`).join("");
}

function renderAll() {
  Object.keys(settings).forEach(name => renderCollection(name));
  renderUsers();
}

/* ==========================================
   SECURE FIRESTORE + REAL D1 WALLET TRANSACTION
========================================== */

async function updateStatus(name, id, newStatus) {
  if (!currentAdmin) throw new Error("Admin Login প্রয়োজন।");

  const expectedStatuses = {
    jobs: ["active", "rejected"],
    tasks: ["approved", "rejected"],
    deposits: ["approved", "rejected"],
    withdrawals: ["rejected"]
  };

  if (!expectedStatuses[name] || !expectedStatuses[name].includes(newStatus)) {
    throw new Error("Invalid action.");
  }

  const reference = doc(db, name, id);

  let depositAmount = 0;
  let targetUid = null;
  let taskId = id;
  let jobId = null;
  let workerUid = null;

  // 1. Firestore Security Transaction
  await runTransaction(db, async transaction => {
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists()) throw new Error("রিকোয়েস্ট পাওয়া যায়নি।");

    const data = snapshot.data();
    if (data.status !== "pending") throw new Error("রিকোয়েস্ট ইতিমধ্যে প্রসেস হয়েছে।");

    if (name === "deposits" && newStatus === "approved") {
      depositAmount = Number(data.amount);
      if (!Number.isFinite(depositAmount) || depositAmount < MIN_DEPOSIT) {
        throw new Error("কমপক্ষে ৳৩০০ Deposit প্রয়োজন।");
      }
      if (!data.uid) throw new Error("User UID পাওয়া যায়নি।");
      targetUid = data.uid;

      const accessReference = doc(db, "userAccess", data.uid);
      const accessSnapshot = await transaction.get(accessReference);

      if (accessSnapshot.exists() && accessSnapshot.data().workEnabled !== true) {
        throw new Error("Existing Access Document Active নয়।");
      }

      transaction.update(reference, { status: "approved" });

      if (!accessSnapshot.exists()) {
        transaction.set(accessReference, {
          workEnabled: true,
          verifiedDepositId: id,
          activatedAt: serverTimestamp()
        });
      }
    } else if (name === "tasks" && newStatus === "approved") {
      jobId = data.jobId;
      const workerInfo = findWorker(data);
      workerUid = workerInfo.uid;
      transaction.update(reference, { status: "approved" });
    } else {
      transaction.update(reference, { status: newStatus });
    }
  });

  // 2. Real Money Engine Call (Cloudflare D1 Database)
  const idToken = await currentAdmin.getIdToken();

  if (name === "deposits" && newStatus === "approved") {
    const apiRes = await fetch(`${WORKER_API}/admin/deposits/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${idToken}` },
      body: JSON.stringify({ depositId: id, targetUid: targetUid, amountBDT: depositAmount })
    });
    const apiResult = await apiRes.json();
    if (!apiRes.ok || !apiResult.success) {
      throw new Error("Firestore Approved কিন্তু D1 Balance Credit ব্যর্থ: " + (apiResult.message || "Server Error"));
    }
  }

  if (name === "tasks" && newStatus === "approved") {
    if (jobId && workerUid) {
      const apiRes = await fetch(`${WORKER_API}/admin/tasks/approve-payout`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${idToken}` },
        body: JSON.stringify({ taskId: id, jobId: jobId, workerUid: workerUid })
      });
      const apiResult = await apiRes.json();
      if (!apiRes.ok || !apiResult.success) {
        throw new Error("Task Approved কিন্তু Worker Payout ব্যর্থ: " + (apiResult.message || "Server Error"));
      }
    }
  }
}

/* ==========================================
   APPROVE / REJECT CLICK HANDLER
========================================== */

document.addEventListener("click", async event => {
  const button = event.target.closest("[data-action][data-collection][data-id]");
  if (!button || busy) return;

  const action = button.dataset.action;
  const name = button.dataset.collection;
  const id = button.dataset.id;

  if (!settings[name] || !["approve", "reject"].includes(action)) return;

  let newStatus = action === "reject" ? "rejected" : name === "jobs" ? "active" : "approved";

  if (name === "withdrawals" && action === "approve") {
    return setMessage("Withdrawal Approval ম্যানুয়ালি প্রসেস করুন।", "error");
  }

  if (!window.confirm(`আপনি কি এই ${name} রিকোয়েস্ট ${action.toUpperCase()} করতে চান?`)) return;

  busy = true;
  button.disabled = true;
  clearMessage();

  try {
    await updateStatus(name, id, newStatus);
    setMessage(`সফলভাবে ${newStatus} প্রসেস করা হয়েছে।`, "success");
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (err) {
    console.error("Admin action error:", err);
    setMessage("সমস্যা হয়েছে: " + err.message, "error");
    button.disabled = false;
  } finally {
    busy = false;
  }
});

/* ==========================================
   INIT
========================================== */

createHistoryFilters();
showLogin();
resetData();
console.log("Admin Panel - Real Money Engine Ready");
