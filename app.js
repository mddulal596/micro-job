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
  getDoc,
  setDoc,
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

const $ = (id) => document.getElementById(id);

let currentUser = null;
let currentProfile = null;
let isAdmin = false;

let activeJobs = [];
let myJobs = [];
let myTasks = [];
let deposits = [];
let withdrawals = [];

let listeners = [];
let authVersion = 0;

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));
}

function money(value) {
  const n = Number(value || 0);
  return "৳ " + n.toLocaleString("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function dateText(value) {
  if (!value) return "—";

  const date = value.toDate
    ? value.toDate()
    : value.seconds
      ? new Date(value.seconds * 1000)
      : null;

  return date ? date.toLocaleString("bn-BD") : "—";
}

function nameText() {
  return (
    currentProfile?.name ||
    currentUser?.displayName ||
    currentUser?.email?.split("@")[0] ||
    "User"
  );
}

function showMessage(text, type = "success") {
  const box = $("messageBox");
  if (!box) return;

  box.textContent = text;
  box.className = "message " + type;
  box.classList.remove("hidden");

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

function clearMessage() {
  const box = $("messageBox");
  if (!box) return;

  box.textContent = "";
  box.className = "message hidden";
}

function showAuthMessage(text, type = "error") {
  const box = $("authMessage");
  if (!box) return;

  box.textContent = text;
  box.className = "message " + type;
  box.classList.remove("hidden");
}

function clearAuthMessage() {
  const box = $("authMessage");
  if (!box) return;

  box.textContent = "";
  box.className = "message hidden";
}

function chip(status) {
  const safe = escapeHtml(status || "pending");
  return `<span class="chip ${safe}">${safe}</span>`;
}

function sortDocs(snapshot) {
  return snapshot.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => {
      const x = a.createdAt?.seconds || 0;
      const y = b.createdAt?.seconds || 0;
      return y - x;
    });
}

const mainPanels = [
  "dashboard",
  "jobs",
  "post",
  "tasks",
  "wallet",
  "deposit",
  "withdraw",
  "profile"
];

function showPanel(name) {
  if (!mainPanels.includes(name)) return;

  mainPanels.forEach((panel) => {
    const el = $(panel + "Panel");
    if (el) el.classList.toggle("active", panel === name);
  });

  const navName = (name === "deposit" || name === "withdraw") ? "wallet" : name;

  document.querySelectorAll(".nav-btn").forEach((button) => {
    button.classList.toggle("active", button.dataset.go === navName);
  });

  clearMessage();

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-go]");
  if (!button) return;
  showPanel(button.dataset.go);
});

$("showRegister").addEventListener("click", (e) => {
  e.preventDefault();
  $("loginBox").classList.add("hidden");
  $("registerBox").classList.remove("hidden");
  clearAuthMessage();
});

$("showLogin").addEventListener("click", (e) => {
  e.preventDefault();
  $("registerBox").classList.add("hidden");
  $("loginBox").classList.remove("hidden");
  clearAuthMessage();
});

$("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  clearAuthMessage();

  try {
    await signInWithEmailAndPassword(
      auth,
      $("loginEmail").value.trim(),
      $("loginPassword").value
    );

    $("loginForm").reset();
  } catch (error) {
    showAuthMessage("Login failed: " + error.message);
  }
});

$("registerForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  clearAuthMessage();

  const name = $("regName").value.trim();
  const email = $("regEmail").value.trim();
  const password = $("regPassword").value;

  if (!name || password.length < 6) {
    showAuthMessage("সঠিক নাম ও কমপক্ষে ৬ অক্ষরের পাসওয়ার্ড দিন।");
    return;
  }

  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);

    await updateProfile(result.user, {
      displayName: name
    });

    await setDoc(doc(db, "users", result.user.uid), {
      uid: result.user.uid,
      name,
      email,
      balance: 0,
      createdAt: serverTimestamp()
    });

    $("registerForm").reset();
  } catch (error) {
    showAuthMessage("Registration failed: " + error.message);
  }
});

$("logoutBtn").addEventListener("click", async () => {
  try {
    await signOut(auth);
  } catch (error) {
    showMessage(error.message, "error");
  }
});

$("profileForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!currentUser) return;

  const name = $("profileName").value.trim();

  if (!name) {
    showMessage("নাম লিখুন।", "error");
    return;
  }

  try {
    await updateProfile(auth.currentUser, { displayName: name });

    await updateDoc(doc(db, "users", currentUser.uid), {
      name
    });

    showMessage("Profile updated successfully.");
  } catch (error) {
    showMessage(error.message, "error");
  }
});

$("jobForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!currentUser) return;

  const title = $("jobTitle").value.trim();
  const description = $("jobDescription").value.trim();
  const reward = Number($("jobReward").value);

  if (!title || !description || !Number.isFinite(reward) || reward <= 0) {
    showMessage("সঠিক Job তথ্য দিন।", "error");
    return;
  }

  try {
    await addDoc(collection(db, "jobs"), {
      title,
      description,
      reward,
      createdBy: currentUser.uid,
      creatorName: nameText(),
      creatorEmail: currentUser.email || "",
      status: "pending",
      createdAt: serverTimestamp()
    });

    $("jobForm").reset();
    showMessage("Job submitted! Admin approval pending.");
  } catch (error) {
    showMessage(error.message, "error");
  }
});

$("taskForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!currentUser) return;

  const jobId = $("taskJobSelect").value;
  const proof = $("taskProof").value.trim();
  const job = activeJobs.find((j) => j.id === jobId);

  if (!job || !proof) {
    showMessage("Job ও Proof সঠিকভাবে দিন।", "error");
    return;
  }

  if (job.createdBy === currentUser.uid) {
    showMessage("নিজের Job-এ Task Submit করা যাবে না।", "error");
    return;
  }

  if (myTasks.some((t) => t.jobId === jobId && t.submittedBy === currentUser.uid)) {
    showMessage("এই Job-এ ইতিমধ্যে Task জমা দিয়েছেন।", "error");
    return;
  }

  try {
    await addDoc(collection(db, "tasks"), {
      jobId: job.id,
      jobTitle: job.title,
      jobOwnerUid: job.createdBy,
      jobOwnerName: job.creatorName || "Unknown",
      submittedBy: currentUser.uid,
      submittedByName: nameText(),
      proof,
      status: "pending",
      createdAt: serverTimestamp()
    });

    $("taskForm").reset();
    showMessage("Task submitted successfully.");
  } catch (error) {
    showMessage(error.message, "error");
  }
});

$("depositForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!currentUser) return;

  const amount = Number($("depositAmount").value);
  const transactionId = $("depositTxn").value.trim();

  if (!Number.isFinite(amount) || amount < 300) {
    showMessage("Minimum deposit amount is ৳300.", "error");
    return;
  }

  if (!transactionId) {
    showMessage("Transaction ID required.", "error");
    return;
  }

  try {
    await addDoc(collection(db, "deposits"), {
      uid: currentUser.uid,
      name: nameText(),
      email: currentUser.email || "",
      method: $("depositMethod").value,
      amount,
      transactionId,
      note: $("depositNote").value.trim(),
      status: "pending",
      createdAt: serverTimestamp()
    });

    $("depositForm").reset();
    showMessage("Deposit request submitted successfully.");
    showPanel("wallet");
  } catch (error) {
    showMessage(error.message, "error");
  }
});

$("withdrawForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!currentUser) return;

  const amount = Number($("withdrawAmount").value);
  const accountNumber = $("withdrawAccount").value.trim();

  if (!Number.isFinite(amount) || amount < 5000) {
    showMessage("Minimum withdraw amount is ৳5000.", "error");
    return;
  }

  if (!accountNumber) {
    showMessage("Account number required.", "error");
    return;
  }

  try {
    await addDoc(collection(db, "withdrawals"), {
      uid: currentUser.uid,
      name: nameText(),
      email: currentUser.email || "",
      method: $("withdrawMethod").value,
      amount,
      accountNumber,
      note: $("withdrawNote").value.trim(),
      status: "pending",
      createdAt: serverTimestamp()
    });

    $("withdrawForm").reset();
    showMessage("Withdrawal request submitted successfully.");
    showPanel("wallet");
  } catch (error) {
    showMessage(error.message, "error");
  }
});

function renderDashboard() {
  const balance = money(currentProfile?.balance || 0);

  $("headerBalance").textContent = balance;
  $("balanceAmount").textContent = balance;
  $("walletBalance").textContent = balance;
  $("profileBalance").textContent = balance;

  $("welcomeText").textContent = "Welcome, " + nameText() + " 👋";
  $("profileDisplayName").textContent = nameText();
  $("profileEmail").textContent = currentUser?.email || "—";

  if (document.activeElement !== $("profileName")) {
    $("profileName").value = currentProfile?.name || currentUser?.displayName || "";
  }

  $("completedJobsCount").textContent =
    myTasks.filter((t) => t.status === "approved").length;

  $("pendingJobsCount").textContent =
    myTasks.filter((t) => t.status === "pending").length;

  $("referralsCount").textContent = "0";
}

function jobCard(job) {
  const ownJob = job.createdBy === currentUser?.uid;
  const alreadySubmitted = myTasks.some((task) => task.jobId === job.id);

  return `
    <article class="job-card">
      <span class="chip active">active</span>

      <h3>${escapeHtml(job.title)}</h3>

      <p>${escapeHtml(job.description || "")}</p>

      <div class="job-meta">
        <span>
          <i class="fa-solid fa-user"></i>
          ${escapeHtml(job.creatorName || "User")}
        </span>

        <span class="job-price">${money(job.reward)}</span>
      </div>

      ${
        ownJob
          ? `<p class="muted">Your Posted Job</p>`
          : alreadySubmitted
            ? `<p class="muted">Task already submitted</p>`
            : `
              <button
                class="btn-primary"
                type="button"
                data-task-job="${escapeHtml(job.id)}"
              >
                Submit Task
              </button>
            `
      }
    </article>
  `;
}

function renderJobs() {
  const available = activeJobs.filter((job) => job.createdBy !== currentUser?.uid);

  const html = available.length
    ? available.map(jobCard).join("")
    : `<div class="empty">No jobs available.</div>`;

  $("homeJobsList").innerHTML = html;
  $("activeJobsList").innerHTML = html;

  const select = $("taskJobSelect");
  const previous = select.value;

  if (!available.length) {
    select.innerHTML = `<option value="">No active jobs</option>`;
    select.disabled = true;
  } else {
    select.disabled = false;
    select.innerHTML = `
      <option value="">Select Job</option>
      ${available.map((job) => `
        <option value="${escapeHtml(job.id)}">
          ${escapeHtml(job.title)} - ${money(job.reward)}
        </option>
      `).join("")}
    `;
  }

  if (available.some((job) => job.id === previous)) {
    select.value = previous;
  }

  $("myJobsList").innerHTML = myJobs.length
    ? myJobs.map((job) => `
      <article class="item-card">
        <div class="item-top">
          <h4>${escapeHtml(job.title)}</h4>
          ${chip(job.status)}
        </div>

        <div class="item-body">
          <p>${escapeHtml(job.description || "")}</p>
        </div>

        <div class="meta">
          <span>Reward: ${money(job.reward)}</span>
          <span>${dateText(job.createdAt)}</span>
        </div>
      </article>
    `).join("")
    : `<div class="empty">No posted jobs.</div>`;
}

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-task-job]");
  if (!button) return;

  const jobId = button.dataset.taskJob;
  showPanel("tasks");
  $("taskJobSelect").value = jobId;
});

function renderTasks() {
  $("myTasksList").innerHTML = myTasks.length
    ? myTasks.map((task) => `
      <article class="item-card">
        <div class="item-top">
          <h4>${escapeHtml(task.jobTitle || "Task")}</h4>
          ${chip(task.status)}
        </div>

        <div class="item-body">
          <p>${escapeHtml(task.proof || "")}</p>
        </div>

        <div class="meta">
          <span>${dateText(task.createdAt)}</span>
        </div>
      </article>
    `).join("")
    : `<div class="empty">No submitted tasks.</div>`;
}

function renderWallet() {
  $("depositHistoryList").innerHTML = deposits.length
    ? deposits.map((item) => `
      <article class="item-card">
        <div class="item-top">
          <h4>${escapeHtml(item.method)} Deposit</h4>
          ${chip(item.status)}
        </div>

        <div class="item-body">
          <p>Amount: ${money(item.amount)}</p>
          <p>Transaction ID: ${escapeHtml(item.transactionId || "")}</p>
          ${item.note ? `<p>Note: ${escapeHtml(item.note)}</p>` : ""}
        </div>

        <div class="meta">
          <span>${dateText(item.createdAt)}</span>
        </div>
      </article>
    `).join("")
    : `<div class="empty">No deposit history.</div>`;

  $("withdrawHistoryList").innerHTML = withdrawals.length
    ? withdrawals.map((item) => `
      <article class="item-card">
        <div class="item-top">
          <h4>${escapeHtml(item.method)} Withdrawal</h4>
          ${chip(item.status)}
        </div>

        <div class="item-body">
          <p>Amount: ${money(item.amount)}</p>
          <p>Account: ${escapeHtml(item.accountNumber || "")}</p>
          ${item.note ? `<p>Note: ${escapeHtml(item.note)}</p>` : ""}
        </div>

        <div class="meta">
          <span>${dateText(item.createdAt)}</span>
        </div>
      </article>
    `).join("")
    : `<div class="empty">No withdrawal history.</div>`;
}

function renderAll() {
  if (!currentUser) return;
  renderDashboard();
  renderJobs();
  renderTasks();
  renderWallet();
}

function stopListeners() {
  listeners.forEach((unsubscribe) => {
    try {
      unsubscribe();
    } catch (error) {
      console.error(error);
    }
  });
  listeners = [];
}

function listen(collectionName, field, value, callback) {
  const q = query(collection(db, collectionName), where(field, "==", value));

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      callback(sortDocs(snapshot));
      renderAll();
    },
    (error) => {
      showMessage(collectionName + ": " + error.message, "error");
    }
  );

  listeners.push(unsubscribe);
}

function startListeners(uid) {
  const profileUnsubscribe = onSnapshot(
    doc(db, "users", uid),
    (snapshot) => {
      if (snapshot.exists()) {
        currentProfile = snapshot.data();
        renderAll();
      }
    },
    (error) => {
      showMessage(error.message, "error");
    }
  );

  listeners.push(profileUnsubscribe);

  listen("jobs", "status", "active", (data) => {
    activeJobs = data;
  });

  listen("jobs", "createdBy", uid, (data) => {
    myJobs = data;
  });

  listen("tasks", "submittedBy", uid, (data) => {
    myTasks = data;
  });

  listen("deposits", "uid", uid, (data) => {
    deposits = data;
  });

  listen("withdrawals", "uid", uid, (data) => {
    withdrawals = data;
  });
}

async function ensureUserProfile(user) {
  const ref = doc(db, "users", user.uid);
  const snapshot = await getDoc(ref);

  if (!snapshot.exists()) {
    await setDoc(ref, {
      uid: user.uid,
      name: user.displayName || "",
      email: user.email || "",
      balance: 0,
      createdAt: serverTimestamp()
    });
  }
}

onAuthStateChanged(auth, async (user) => {
  const version = ++authVersion;

  stopListeners();

  currentUser = user;
  currentProfile = null;
  isAdmin = false;

  activeJobs = [];
  myJobs = [];
  myTasks = [];
  deposits = [];
  withdrawals = [];

  if (!user) {
    $("authView").classList.remove("hidden");
    $("appView").classList.add("hidden");
    $("adminLink").classList.add("hidden");
    $("loginBox").classList.remove("hidden");
    $("registerBox").classList.add("hidden");
    clearMessage();
    return;
  }

  try {
    await ensureUserProfile(user);
  } catch (error) {
    console.error("Profile setup:", error);
  }

  if (version !== authVersion) return;

  try {
    const token = await getIdTokenResult(user, true);
    isAdmin = token.claims.admin === true;
  } catch (error) {
    console.error("Admin check:", error);
  }

  if (version !== authVersion) return;

  $("adminLink").classList.toggle("hidden", !isAdmin);

  $("authView").classList.add("hidden");
  $("appView").classList.remove("hidden");

  clearAuthMessage();
  showPanel("dashboard");
  startListeners(user.uid);
  renderAll();
});
