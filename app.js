import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  getIdTokenResult
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  addDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const authView = document.getElementById("authView");
const appView = document.getElementById("appView");
const messageBox = document.getElementById("messageBox");
const userBadge = document.getElementById("userBadge");
const adminLink = document.getElementById("adminLink");
const logoutBtn = document.getElementById("logoutBtn");

const dashboardStats = document.getElementById("dashboardStats");
const profileEmail = document.getElementById("profileEmail");
const profileBalance = document.getElementById("profileBalance");
const profileNameInput = document.getElementById("profileName");

const activeJobsList = document.getElementById("activeJobsList");
const myJobsList = document.getElementById("myJobsList");
const myTasksList = document.getElementById("myTasksList");
const taskJobSelect = document.getElementById("taskJobSelect");
const depositHistoryList = document.getElementById("depositHistoryList");
const withdrawHistoryList = document.getElementById("withdrawHistoryList");

const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const profileForm = document.getElementById("profileForm");
const jobForm = document.getElementById("jobForm");
const taskForm = document.getElementById("taskForm");
const depositForm = document.getElementById("depositForm");
const withdrawForm = document.getElementById("withdrawForm");

const loginEmail = document.getElementById("loginEmail");
const loginPassword = document.getElementById("loginPassword");
const regName = document.getElementById("regName");
const regEmail = document.getElementById("regEmail");
const regPassword = document.getElementById("regPassword");

const jobTitle = document.getElementById("jobTitle");
const jobDescription = document.getElementById("jobDescription");
const jobReward = document.getElementById("jobReward");

const taskProof = document.getElementById("taskProof");

const depositMethod = document.getElementById("depositMethod");
const depositAmount = document.getElementById("depositAmount");
const depositTxn = document.getElementById("depositTxn");
const depositNote = document.getElementById("depositNote");

const withdrawMethod = document.getElementById("withdrawMethod");
const withdrawAmount = document.getElementById("withdrawAmount");
const withdrawAccount = document.getElementById("withdrawAccount");
const withdrawNote = document.getElementById("withdrawNote");

const tabs = document.querySelectorAll(".tab");

let currentUser = null;
let currentProfile = null;
let isAdmin = false;

let activeJobs = [];
let myJobs = [];
let myTasks = [];
let myDeposits = [];
let myWithdrawals = [];

let unsubscribers = [];

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

function getDisplayName() {
  return (
    currentProfile?.name ||
    currentUser?.displayName ||
    currentUser?.email?.split("@")?.[0] ||
    "User"
  );
}

function setMessage(text, type = "success") {
  if (!messageBox) return;
  messageBox.textContent = text;
  messageBox.className = `message ${type}`;
  messageBox.classList.remove("hidden");
}

function clearMessage() {
  if (!messageBox) return;
  messageBox.textContent = "";
  messageBox.className = "message hidden";
}

function showAuthView() {
  authView.classList.remove("hidden");
  appView.classList.add("hidden");
  userBadge.classList.add("hidden");
  adminLink.classList.add("hidden");
  logoutBtn.classList.add("hidden");
  clearMessage();
}

function showAppView() {
  authView.classList.add("hidden");
  appView.classList.remove("hidden");
  logoutBtn.classList.remove("hidden");
  if (isAdmin) adminLink.classList.remove("hidden");
  else adminLink.classList.add("hidden");
}

function showPanel(name) {
  tabs.forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.panel === name);
  });

  document.querySelectorAll(".panel").forEach((panel) => {
    panel.classList.remove("active");
  });

  const target = document.getElementById(`${name}Panel`);
  if (target) target.classList.add("active");
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

async function ensureUserDoc(user) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    await setDoc(ref, {
      uid: user.uid,
      name: user.displayName || "",
      email: user.email || "",
      balance: 0,
      createdAt: serverTimestamp()
    });
  }
}

function renderTopbar() {
  if (!currentUser) {
    userBadge.classList.add("hidden");
    return;
  }

  userBadge.textContent = `${getDisplayName()}${isAdmin ? " • Admin" : ""}`;
  userBadge.classList.remove("hidden");

  if (isAdmin) adminLink.classList.remove("hidden");
  else adminLink.classList.add("hidden");
}

function renderProfile() {
  const email = currentProfile?.email || currentUser?.email || "-";
  const balance = Number(currentProfile?.balance || 0);

  profileEmail.textContent = email;
  profileBalance.textContent = formatMoney(balance);

  if (document.activeElement !== profileNameInput) {
    profileNameInput.value = currentProfile?.name || currentUser?.displayName || "";
  }
}

function renderStats() {
  const cards = [
    { label: "Balance", value: formatMoney(currentProfile?.balance || 0) },
    { label: "Active Jobs", value: activeJobs.length },
    { label: "My Jobs", value: myJobs.length },
    { label: "My Tasks", value: myTasks.length },
    { label: "Deposit Pending", value: myDeposits.filter((x) => x.status === "pending").length },
    { label: "Withdraw Pending", value: myWithdrawals.filter((x) => x.status === "pending").length }
  ];

  dashboardStats.innerHTML = cards.map((item) => `
    <div class="stats-card">
      <div class="label">${escapeHtml(item.label)}</div>
      <div class="value">${escapeHtml(String(item.value))}</div>
    </div>
  `).join("");
}

function renderTaskSelect() {
  const previous = taskJobSelect.value;

  if (!activeJobs.length) {
    taskJobSelect.innerHTML = `<option value="">No active jobs available</option>`;
    taskJobSelect.disabled = true;
    return;
  }

  taskJobSelect.disabled = false;
  taskJobSelect.innerHTML = `
    <option value="">Select an active job</option>
    ${activeJobs.map((job) => `
      <option value="${job.id}">
        ${escapeHtml(job.title)} — ${formatMoney(job.reward)}
      </option>
    `).join("")}
  `;

  if (activeJobs.some((job) => job.id === previous)) {
    taskJobSelect.value = previous;
  }
}

function renderActiveJobs() {
  if (!activeJobs.length) {
    activeJobsList.innerHTML = `<div class="empty">No active jobs yet.</div>`;
    return;
  }

  activeJobsList.innerHTML = activeJobs.map((job) => `
    <article class="item-card">
      <div class="item-top">
        <div>
          <h4>${escapeHtml(job.title)}</h4>
          <div class="meta">
            <span>Reward: ${formatMoney(job.reward)}</span>
            <span>By: ${escapeHtml(job.creatorName || job.creatorEmail || "Unknown")}</span>
          </div>
        </div>
        ${statusChip(job.status)}
      </div>

      <div class="item-body">
        <p>${escapeHtml(truncate(job.description || "", 220))}</p>
      </div>

      <div class="meta">
        <span>Created: ${formatTime(job.createdAt)}</span>
      </div>

      <div style="margin-top:12px;">
        <button class="btn secondary small-btn" type="button" data-use-job="${job.id}">Submit Task</button>
      </div>
    </article>
  `).join("");
}

function renderMyJobs() {
  if (!myJobs.length) {
    myJobsList.innerHTML = `<div class="empty">You have not posted any job yet.</div>`;
    return;
  }

  myJobsList.innerHTML = myJobs.map((job) => `
    <article class="item-card">
      <div class="item-top">
        <div>
          <h4>${escapeHtml(job.title)}</h4>
          <div class="meta">
            <span>Reward: ${formatMoney(job.reward)}</span>
            <span>Created: ${formatTime(job.createdAt)}</span>
          </div>
        </div>
        ${statusChip(job.status)}
      </div>
      <p>${escapeHtml(truncate(job.description || "", 220))}</p>
    </article>
  `).join("");
}

function renderMyTasks() {
  if (!myTasks.length) {
    myTasksList.innerHTML = `<div class="empty">No task submitted yet.</div>`;
    return;
  }

  myTasksList.innerHTML = myTasks.map((task) => `
    <article class="item-card">
      <div class="item-top">
        <div>
          <h4>${escapeHtml(task.jobTitle || "Task")}</h4>
          <div class="meta">
            <span>Submitted: ${formatTime(task.createdAt)}</span>
            <span>Owner: ${escapeHtml(task.jobOwnerName || "Unknown")}</span>
          </div>
        </div>
        ${statusChip(task.status)}
      </div>
      <p><strong>Proof:</strong></p>
      <p>${escapeHtml(truncate(task.proof || "", 260))}</p>
    </article>
  `).join("");
}

function renderDeposits() {
  if (!myDeposits.length) {
    depositHistoryList.innerHTML = `<div class="empty">No deposit request yet.</div>`;
    return;
  }

  depositHistoryList.innerHTML = myDeposits.map((item) => `
    <article class="item-card">
      <div class="item-top">
        <div>
          <h4>${escapeHtml(item.method)} Deposit</h4>
          <div class="meta">
            <span>Amount: ${formatMoney(item.amount)}</span>
            <span>Txn: ${escapeHtml(item.transactionId || "-")}</span>
          </div>
        </div>
        ${statusChip(item.status)}
      </div>
      <div class="meta">
        <span>Created: ${formatTime(item.createdAt)}</span>
      </div>
      ${item.note ? `<p>${escapeHtml(truncate(item.note, 200))}</p>` : ""}
    </article>
  `).join("");
}

function renderWithdrawals() {
  if (!myWithdrawals.length) {
    withdrawHistoryList.innerHTML = `<div class="empty">No withdrawal request yet.</div>`;
    return;
  }

  withdrawHistoryList.innerHTML = myWithdrawals.map((item) => `
    <article class="item-card">
      <div class="item-top">
        <div>
          <h4>${escapeHtml(item.method)} Withdrawal</h4>
          <div class="meta">
            <span>Amount: ${formatMoney(item.amount)}</span>
            <span>Account: ${escapeHtml(item.accountNumber || "-")}</span>
          </div>
        </div>
        ${statusChip(item.status)}
      </div>
      <div class="meta">
        <span>Created: ${formatTime(item.createdAt)}</span>
      </div>
      ${item.note ? `<p>${escapeHtml(truncate(item.note, 200))}</p>` : ""}
    </article>
  `).join("");
}

function renderAll() {
  renderTopbar();
  renderProfile();
  renderStats();
  renderTaskSelect();
  renderActiveJobs();
  renderMyJobs();
  renderMyTasks();
  renderDeposits();
  renderWithdrawals();
}

function resetState() {
  currentUser = null;
  currentProfile = null;
  isAdmin = false;
  activeJobs = [];
  myJobs = [];
  myTasks = [];
  myDeposits = [];
  myWithdrawals = [];
  cleanListeners();
  renderAll();
}

function attachActiveJobActions() {
  activeJobsList.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-use-job]");
    if (!btn) return;

    const jobId = btn.dataset.useJob;
    taskJobSelect.value = jobId;
    showPanel("tasks");
    document.getElementById("tasksPanel").scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

attachActiveJobActions();

tabs.forEach((tab) => {
  tab.addEventListener("click", () => showPanel(tab.dataset.panel));
});

logoutBtn.addEventListener("click", async () => {
  try {
    await signOut(auth);
    setMessage("Logout successful.", "success");
  } catch (error) {
    setMessage(error.message, "error");
  }
});

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearMessage();

  try {
    await signInWithEmailAndPassword(
      auth,
      loginEmail.value.trim(),
      loginPassword.value
    );
    setMessage("Login successful.", "success");
    loginForm.reset();
  } catch (error) {
    setMessage(`Login failed: ${error.message}`, "error");
  }
});

registerForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearMessage();

  const name = regName.value.trim();
  const email = regEmail.value.trim();
  const password = regPassword.value;

  try {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(credential.user, { displayName: name });

    await setDoc(doc(db, "users", credential.user.uid), {
      uid: credential.user.uid,
      name,
      email,
      balance: 0,
      createdAt: serverTimestamp()
    });

    setMessage("Account created successfully.", "success");
    registerForm.reset();
  } catch (error) {
    setMessage(`Registration failed: ${error.message}`, "error");
  }
});

profileForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearMessage();

  if (!currentUser) return;

  const name = profileNameInput.value.trim();

  try {
    await updateProfile(auth.currentUser, { displayName: name });
    await updateDoc(doc(db, "users", currentUser.uid), {
      name
    });
    setMessage("Profile updated successfully.", "success");
  } catch (error) {
    setMessage(`Profile update failed: ${error.message}`, "error");
  }
});

jobForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearMessage();

  if (!currentUser) return;

  const title = jobTitle.value.trim();
  const description = jobDescription.value.trim();
  const reward = Number(jobReward.value);

  if (!title || !description || !Number.isFinite(reward) || reward <= 0) {
    setMessage("Please enter valid job data.", "error");
    return;
  }

  try {
    await addDoc(collection(db, "jobs"), {
      title,
      description,
      reward,
      createdBy: currentUser.uid,
      creatorName: getDisplayName(),
      creatorEmail: currentUser.email || "",
      status: "pending",
      createdAt: serverTimestamp()
    });

    jobForm.reset();
    setMessage("Job submitted. Waiting for admin approval.", "success");
  } catch (error) {
    setMessage(`Job submit failed: ${error.message}`, "error");
  }
});

taskForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearMessage();

  if (!currentUser) return;

  const jobId = taskJobSelect.value;
  const proof = taskProof.value.trim();

  if (!jobId || !proof) {
    setMessage("Please select a job and write proof.", "error");
    return;
  }

  const selectedJob = activeJobs.find((job) => job.id === jobId);
  if (!selectedJob) {
    setMessage("Selected job not found or no longer active.", "error");
    return;
  }

  try {
    await addDoc(collection(db, "tasks"), {
      jobId: selectedJob.id,
      jobTitle: selectedJob.title,
      jobOwnerUid: selectedJob.createdBy,
      jobOwnerName: selectedJob.creatorName || selectedJob.creatorEmail || "Unknown",
      submittedBy: currentUser.uid,
      submittedByName: getDisplayName(),
      proof,
      status: "pending",
      createdAt: serverTimestamp()
    });

    taskProof.value = "";
    setMessage("Task submitted. Waiting for admin approval.", "success");
  } catch (error) {
    setMessage(`Task submit failed: ${error.message}`, "error");
  }
});

depositForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearMessage();

  if (!currentUser) return;

  const amount = Number(depositAmount.value);
  if (!Number.isFinite(amount) || amount <= 0) {
    setMessage("Enter a valid deposit amount.", "error");
    return;
  }

  try {
    await addDoc(collection(db, "deposits"), {
      uid: currentUser.uid,
      name: getDisplayName(),
      email: currentUser.email || "",
      method: depositMethod.value,
      amount,
      transactionId: depositTxn.value.trim(),
      note: depositNote.value.trim(),
      status: "pending",
      createdAt: serverTimestamp()
    });

    depositForm.reset();
    setMessage("Deposit request sent. Waiting for admin approval.", "success");
  } catch (error) {
    setMessage(`Deposit request failed: ${error.message}`, "error");
  }
});

withdrawForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearMessage();

  if (!currentUser) return;

  const amount = Number(withdrawAmount.value);
  if (!Number.isFinite(amount) || amount <= 0) {
    setMessage("Enter a valid withdraw amount.", "error");
    return;
  }

  try {
    await addDoc(collection(db, "withdrawals"), {
      uid: currentUser.uid,
      name: getDisplayName(),
      email: currentUser.email || "",
      method: withdrawMethod.value,
      amount,
      accountNumber: withdrawAccount.value.trim(),
      note: withdrawNote.value.trim(),
      status: "pending",
      createdAt: serverTimestamp()
    });

    withdrawForm.reset();
    setMessage("Withdrawal request sent. Waiting for admin approval.", "success");
  } catch (error) {
    setMessage(`Withdraw request failed: ${error.message}`, "error");
  }
});

async function bindDataListeners(uid) {
  const profileUnsub = onSnapshot(doc(db, "users", uid), (snap) => {
    if (snap.exists()) {
      currentProfile = snap.data();
      renderAll();
    }
  }, (error) => setMessage(error.message, "error"));
  listenRef(profileUnsub);

  const activeJobsUnsub = onSnapshot(
    query(collection(db, "jobs"), where("status", "==", "active")),
    (snap) => {
      activeJobs = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (toDate(b.createdAt)?.getTime() || 0) - (toDate(a.createdAt)?.getTime() || 0));
      renderAll();
    },
    (error) => setMessage(error.message, "error")
  );
  listenRef(activeJobsUnsub);

  const myJobsUnsub = onSnapshot(
    query(collection(db, "jobs"), where("createdBy", "==", uid)),
    (snap) => {
      myJobs = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (toDate(b.createdAt)?.getTime() || 0) - (toDate(a.createdAt)?.getTime() || 0));
      renderAll();
    },
    (error) => setMessage(error.message, "error")
  );
  listenRef(myJobsUnsub);

  const myTasksUnsub = onSnapshot(
    query(collection(db, "tasks"), where("submittedBy", "==", uid)),
    (snap) => {
      myTasks = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (toDate(b.createdAt)?.getTime() || 0) - (toDate(a.createdAt)?.getTime() || 0));
      renderAll();
    },
    (error) => setMessage(error.message, "error")
  );
  listenRef(myTasksUnsub);

  const depositsUnsub = onSnapshot(
    query(collection(db, "deposits"), where("uid", "==", uid)),
    (snap) => {
      myDeposits = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (toDate(b.createdAt)?.getTime() || 0) - (toDate(a.createdAt)?.getTime() || 0));
      renderAll();
    },
    (error) => setMessage(error.message, "error")
  );
  listenRef(depositsUnsub);

  const withdrawalsUnsub = onSnapshot(
    query(collection(db, "withdrawals"), where("uid", "==", uid)),
    (snap) => {
      myWithdrawals = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (toDate(b.createdAt)?.getTime() || 0) - (toDate(a.createdAt)?.getTime() || 0));
      renderAll();
    },
    (error) => setMessage(error.message, "error")
  );
  listenRef(withdrawalsUnsub);
}

onAuthStateChanged(auth, async (user) => {
  cleanListeners();

  if (!user) {
    resetState();
    showAuthView();
    return;
  }

  currentUser = user;

  try {
    await ensureUserDoc(user);
  } catch (error) {
    setMessage(`Profile setup failed: ${error.message}`, "error");
  }

  try {
    const token = await getIdTokenResult(user, true);
    isAdmin = !!token.claims.admin;
  } catch (error) {
    console.warn("Admin token check failed:", error);
    isAdmin = false;
  }

  await bindDataListeners(user.uid);
  showAppView();
  showPanel("dashboard");
  renderAll();
});
