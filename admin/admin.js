import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  getIdTokenResult
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  getFirestore,
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { firebaseConfig } from "../firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const adminAuthBox = document.getElementById("adminAuthBox");
const adminDeniedBox = document.getElementById("adminDeniedBox");
const adminApp = document.getElementById("adminApp");
const adminMessage = document.getElementById("adminMessage");
const adminLogoutBtn = document.getElementById("adminLogoutBtn");

const adminLoginForm = document.getElementById("adminLoginForm");
const adminEmail = document.getElementById("adminEmail");
const adminPassword = document.getElementById("adminPassword");

const adminStats = document.getElementById("adminStats");
const pendingJobsList = document.getElementById("pendingJobsList");
const pendingTasksList = document.getElementById("pendingTasksList");
const pendingDepositsList = document.getElementById("pendingDepositsList");
const pendingWithdrawalsList = document.getElementById("pendingWithdrawalsList");
const usersList = document.getElementById("usersList");

let unsubscribers = [];
let currentAdminUser = null;

let pendingJobs = [];
let pendingTasks = [];
let pendingDeposits = [];
let pendingWithdrawals = [];
let allUsers = [];

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (match) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[match]));
}

function formatMoney(value) {
  const number = Number(value || 0);
  return `৳${number.toLocaleString("en-BD", { maximumFractionDigits: 2 })}`;
}

function toDate(ts) {
  if (!ts) return null;
  if (typeof ts.toDate === "function") return ts.toDate();
  if (ts.seconds) return new Date(ts.seconds * 1000);
  return null;
}

function formatTime(ts) {
  const d = toDate(ts);
  return d ? d.toLocaleString("bn-BD") : "—";
}

function truncate(text = "", limit = 180) {
  const s = String(text);
  return s.length > limit ? `${s.slice(0, limit)}...` : s;
}

function statusChip(status) {
  const safe = escapeHtml(status || "pending");
  return `<span class="chip ${safe}">${safe}</span>`;
}

function setMessage(text, type = "success") {
  adminMessage.textContent = text;
  adminMessage.className = `message ${type}`;
  adminMessage.classList.remove("hidden");
}

function clearMessage() {
  adminMessage.textContent = "";
  adminMessage.className = "message hidden";
}

function showAuthBox() {
  adminAuthBox.classList.remove("hidden");
  adminDeniedBox.classList.add("hidden");
  adminApp.classList.add("hidden");
  adminLogoutBtn.classList.add("hidden");
  clearMessage();
}

function showDeniedBox() {
  adminAuthBox.classList.add("hidden");
  adminDeniedBox.classList.remove("hidden");
  adminApp.classList.add("hidden");
  adminLogoutBtn.classList.remove("hidden");
  clearMessage();
}

function showAdminApp() {
  adminAuthBox.classList.add("hidden");
  adminDeniedBox.classList.add("hidden");
  adminApp.classList.remove("hidden");
  adminLogoutBtn.classList.remove("hidden");
}

function cleanListeners() {
  unsubscribers.forEach((unsub) => {
    try {
      unsub();
    } catch (error) {
      console.warn(error);
    }
  });
  unsubscribers = [];
}

function listenRef(unsub) {
  unsubscribers.push(unsub);
  return unsub;
}

function renderStats() {
  const cards = [
    { label: "Pending Jobs", value: pendingJobs.length },
    { label: "Pending Tasks", value: pendingTasks.length },
    { label: "Pending Deposits", value: pendingDeposits.length },
    { label: "Pending Withdrawals", value: pendingWithdrawals.length }
  ];

  adminStats.innerHTML = cards.map((item) => `
    <div class="stats-card">
      <div class="label">${escapeHtml(item.label)}</div>
      <div class="value">${escapeHtml(String(item.value))}</div>
    </div>
  `).join("");
}

function renderPendingJobs() {
  if (!pendingJobs.length) {
    pendingJobsList.innerHTML = `<div class="empty">No pending job.</div>`;
    return;
  }

  pendingJobsList.innerHTML = pendingJobs.map((job) => `
    <article class="item-card">
      <div class="item-top">
        <div>
          <h4>${escapeHtml(job.title)}</h4>
          <div class="meta">
            <span>Reward: ${formatMoney(job.reward)}</span>
            <span>Creator: ${escapeHtml(job.creatorName || job.creatorEmail || "Unknown")}</span>
          </div>
        </div>
        ${statusChip(job.status)}
      </div>
      <p>${escapeHtml(truncate(job.description || "", 240))}</p>
      <div class="meta">
        <span>Created: ${formatTime(job.createdAt)}</span>
      </div>
      <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:12px;">
        <button class="btn primary" type="button" data-collection="jobs" data-id="${job.id}" data-status="active">Approve</button>
        <button class="btn secondary" type="button" data-collection="jobs" data-id="${job.id}" data-status="rejected">Reject</button>
      </div>
    </article>
  `).join("");
}

function renderPendingTasks() {
  if (!pendingTasks.length) {
    pendingTasksList.innerHTML = `<div class="empty">No pending task.</div>`;
    return;
  }

  pendingTasksList.innerHTML = pendingTasks.map((task) => `
    <article class="item-card">
      <div class="item-top">
        <div>
          <h4>${escapeHtml(task.jobTitle || "Task")}</h4>
          <div class="meta">
            <span>Submitted by: ${escapeHtml(task.submittedByName || "Unknown")}</span>
            <span>Owner: ${escapeHtml(task.jobOwnerName || "Unknown")}</span>
          </div>
        </div>
        ${statusChip(task.status)}
      </div>
      <p><strong>Proof:</strong></p>
      <p>${escapeHtml(truncate(task.proof || "", 260))}</p>
      <div class="meta">
        <span>Created: ${formatTime(task.createdAt)}</span>
      </div>
      <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:12px;">
        <button class="btn primary" type="button" data-collection="tasks" data-id="${task.id}" data-status="approved">Approve</button>
        <button class="btn secondary" type="button" data-collection="tasks" data-id="${task.id}" data-status="rejected">Reject</button>
      </div>
    </article>
  `).join("");
}

function renderPendingDeposits() {
  if (!pendingDeposits.length) {
    pendingDepositsList.innerHTML = `<div class="empty">No pending deposit.</div>`;
    return;
  }

  pendingDepositsList.innerHTML = pendingDeposits.map((item) => `
    <article class="item-card">
      <div class="item-top">
        <div>
          <h4>${escapeHtml(item.method)} Deposit</h4>
          <div class="meta">
            <span>Amount: ${formatMoney(item.amount)}</span>
            <span>Txn: ${escapeHtml(item.transactionId || "-")}</span>
            <span>User: ${escapeHtml(item.name || item.email || "Unknown")}</span>
          </div>
        </div>
        ${statusChip(item.status)}
      </div>
      ${item.note ? `<p>${escapeHtml(truncate(item.note, 220))}</p>` : ""}
      <div class="meta">
        <span>Created: ${formatTime(item.createdAt)}</span>
      </div>
      <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:12px;">
        <button class="btn primary" type="button" data-collection="deposits" data-id="${item.id}" data-status="approved">Approve</button>
        <button class="btn secondary" type="button" data-collection="deposits" data-id="${item.id}" data-status="rejected">Reject</button>
      </div>
    </article>
  `).join("");
}

function renderPendingWithdrawals() {
  if (!pendingWithdrawals.length) {
    pendingWithdrawalsList.innerHTML = `<div class="empty">No pending withdrawal.</div>`;
    return;
  }

  pendingWithdrawalsList.innerHTML = pendingWithdrawals.map((item) => `
    <article class="item-card">
      <div class="item-top">
        <div>
          <h4>${escapeHtml(item.method)} Withdrawal</h4>
          <div class="meta">
            <span>Amount: ${formatMoney(item.amount)}</span>
            <span>Account: ${escapeHtml(item.accountNumber || "-")}</span>
            <span>User: ${escapeHtml(item.name || item.email || "Unknown")}</span>
          </div>
        </div>
        ${statusChip(item.status)}
      </div>
      ${item.note ? `<p>${escapeHtml(truncate(item.note, 220))}</p>` : ""}
      <div class="meta">
        <span>Created: ${formatTime(item.createdAt)}</span>
      </div>
      <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:12px;">
        <button class="btn primary" type="button" data-collection="withdrawals" data-id="${item.id}" data-status="approved">Approve</button>
        <button class="btn secondary" type="button" data-collection="withdrawals" data-id="${item.id}" data-status="rejected">Reject</button>
      </div>
    </article>
  `).join("");
}

function renderUsers() {
  if (!allUsers.length) {
    usersList.innerHTML = `<div class="empty">No users found.</div>`;
    return;
  }

  usersList.innerHTML = allUsers.map((user) => `
    <article class="item-card">
      <div class="item-top">
        <div>
          <h4>${escapeHtml(user.name || "No name")}</h4>
          <div class="meta">
            <span>Email: ${escapeHtml(user.email || "-")}</span>
            <span>UID: ${escapeHtml(user.uid || "-")}</span>
          </div>
        </div>
        <span class="chip active">Balance: ${formatMoney(user.balance || 0)}</span>
      </div>
      <div class="meta">
        <span>Created: ${formatTime(user.createdAt)}</span>
      </div>
    </article>
  `).join("");
}

function renderAll() {
  renderStats();
  renderPendingJobs();
  renderPendingTasks();
  renderPendingDeposits();
  renderPendingWithdrawals();
  renderUsers();
}

async function loadAdminData(uid) {
  const jobsUnsub = onSnapshot(
    query(collection(db, "jobs"), where("status", "==", "pending")),
    (snap) => {
      pendingJobs = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (toDate(b.createdAt)?.getTime() || 0) - (toDate(a.createdAt)?.getTime() || 0));
      renderAll();
    },
    (error) => setMessage(error.message, "error")
  );
  listenRef(jobsUnsub);

  const tasksUnsub = onSnapshot(
    query(collection(db, "tasks"), where("status", "==", "pending")),
    (snap) => {
      pendingTasks = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (toDate(b.createdAt)?.getTime() || 0) - (toDate(a.createdAt)?.getTime() || 0));
      renderAll();
    },
    (error) => setMessage(error.message, "error")
  );
  listenRef(tasksUnsub);

  const depositsUnsub = onSnapshot(
    query(collection(db, "deposits"), where("status", "==", "pending")),
    (snap) => {
      pendingDeposits = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (toDate(b.createdAt)?.getTime() || 0) - (toDate(a.createdAt)?.getTime() || 0));
      renderAll();
    },
    (error) => setMessage(error.message, "error")
  );
  listenRef(depositsUnsub);

  const withdrawalsUnsub = onSnapshot(
    query(collection(db, "withdrawals"), where("status", "==", "pending")),
    (snap) => {
      pendingWithdrawals = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (toDate(b.createdAt)?.getTime() || 0) - (toDate(a.createdAt)?.getTime() || 0));
      renderAll();
    },
    (error) => setMessage(error.message, "error")
  );
  listenRef(withdrawalsUnsub);

  const usersUnsub = onSnapshot(
    collection(db, "users"),
    (snap) => {
      allUsers = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (toDate(b.createdAt)?.getTime() || 0) - (toDate(a.createdAt)?.getTime() || 0));
      renderAll();
    },
    (error) => setMessage(error.message, "error")
  );
  listenRef(usersUnsub);
}

async function updateStatus(collectionName, id, status) {
  await updateDoc(doc(db, collectionName, id), { status });
  setMessage(`${collectionName} updated to ${status}.`, "success");
}

document.getElementById("pendingJobsList").addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-collection='jobs']");
  if (!btn) return;
  try {
    await updateStatus("jobs", btn.dataset.id, btn.dataset.status);
  } catch (error) {
    setMessage(error.message, "error");
  }
});

document.getElementById("pendingTasksList").addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-collection='tasks']");
  if (!btn) return;
  try {
    await updateStatus("tasks", btn.dataset.id, btn.dataset.status);
  } catch (error) {
    setMessage(error.message, "error");
  }
});

document.getElementById("pendingDepositsList").addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-collection='deposits']");
  if (!btn) return;
  try {
    await updateStatus("deposits", btn.dataset.id, btn.dataset.status);
  } catch (error) {
    setMessage(error.message, "error");
  }
});

document.getElementById("pendingWithdrawalsList").addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-collection='withdrawals']");
  if (!btn) return;
  try {
    await updateStatus("withdrawals", btn.dataset.id, btn.dataset.status);
  } catch (error) {
    setMessage(error.message, "error");
  }
});

adminLoginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearMessage();

  try {
    await signInWithEmailAndPassword(
      auth,
      adminEmail.value.trim(),
      adminPassword.value
    );
    adminLoginForm.reset();
  } catch (error) {
    setMessage(`Login failed: ${error.message}`, "error");
  }
});

adminLogoutBtn.addEventListener("click", async () => {
  try {
    await signOut(auth);
    setMessage("Logout successful.", "success");
  } catch (error) {
    setMessage(error.message, "error");
  }
});

onAuthStateChanged(auth, async (user) => {
  cleanListeners();
  currentAdminUser = user || null;
  pendingJobs = [];
  pendingTasks = [];
  pendingDeposits = [];
  pendingWithdrawals = [];
  allUsers = [];
  renderAll();

  if (!user) {
    showAuthBox();
    return;
  }

  try {
    const token = await getIdTokenResult(user, true);
    if (!token.claims.admin) {
      showDeniedBox();
      setMessage("You are logged in but not an admin.", "error");
      return;
    }
  } catch (error) {
    showDeniedBox();
    setMessage(`Admin check failed: ${error.message}`, "error");
    return;
  }

  showAdminApp();
  await loadAdminData(user.uid);
  renderAll();
});
