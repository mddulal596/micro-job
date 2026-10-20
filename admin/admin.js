/* ==========================================
   MICRO JOB ADMIN PANEL
   FIREBASE SPARK TESTING MODE
========================================== */

import { initializeApp } from
  "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";

import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  getIdTokenResult
} from
  "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  getFirestore,
  collection,
  query,
  where,
  onSnapshot,
  doc,
  runTransaction,
  serverTimestamp
} from
  "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import { firebaseConfig } from "../firebase-config.js";


/* ==========================================
   FIREBASE INITIALIZATION
========================================== */

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);

const db = getFirestore(app);


/* ==========================================
   CONSTANTS
========================================== */

const MIN_DEPOSIT = 300;

const $ = (id) => document.getElementById(id);


/* ==========================================
   STATE
========================================== */

let currentAdmin = null;

let listeners = [];

let authVersion = 0;

let busy = false;

let pendingJobs = [];

let pendingTasks = [];

let pendingDeposits = [];

let pendingWithdrawals = [];

let allUsers = [];


/* ==========================================
   HELPER FUNCTIONS
========================================== */

function escapeHtml(value = "") {
  return String(value).replace(
    /[&<>"']/g,
    (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[character]
  );
}


function money(value) {
  const amount = Number(value) || 0;

  return "৳" + amount.toLocaleString("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}


function dateText(value) {
  if (!value) {
    return "—";
  }

  try {
    const date =
      typeof value.toDate === "function"
        ? value.toDate()
        : value.seconds
          ? new Date(value.seconds * 1000)
          : null;

    return date
      ? date.toLocaleString("bn-BD")
      : "—";

  } catch (error) {
    return "—";
  }
}


function safeText(value) {
  if (value === null || value === undefined) {
    return "—";
  }

  return escapeHtml(String(value));
}


function chip(status = "pending") {
  const safe = escapeHtml(status);

  return `
    <span class="status-chip ${safe}">
      ${safe}
    </span>
  `;
}


function emptyState(text) {
  return `
    <div class="empty-state">
      ${escapeHtml(text)}
    </div>
  `;
}


function setMessage(text, type = "success") {
  const element = $("adminMessage");

  if (!element) return;

  element.textContent = text;

  element.className = "message " + type;
}


function clearMessage() {
  const element = $("adminMessage");

  if (!element) return;

  element.textContent = "";

  element.className = "message hidden";
}


function setLoginMessage(text) {
  const element = $("adminLoginMessage");

  if (!element) return;

  element.textContent = text;
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
  listeners.forEach((unsubscribe) => {
    try {
      unsubscribe();
    } catch (error) {
      console.error(error);
    }
  });

  listeners = [];
}


function resetData() {
  pendingJobs = [];

  pendingTasks = [];

  pendingDeposits = [];

  pendingWithdrawals = [];

  allUsers = [];

  updateCounts();

  renderAll();
}


/* ==========================================
   ADMIN LOGIN
========================================== */

$("adminLoginForm").addEventListener(
  "submit",
  async (event) => {
    event.preventDefault();

    const email = $("adminEmail").value.trim();

    const password = $("adminPassword").value;

    const submitButton =
      $("adminLoginForm").querySelector(
        'button[type="submit"]'
      );

    if (!email || !password) {
      setLoginMessage(
        "ইমেইল এবং পাসওয়ার্ড লিখুন।"
      );

      return;
    }

    submitButton.disabled = true;

    setLoginMessage("লগইন হচ্ছে...");

    try {
      await signInWithEmailAndPassword(
        auth,
        email,
        password
      );

      setLoginMessage(
        "অ্যাকাউন্ট যাচাই করা হচ্ছে..."
      );

    } catch (error) {
      console.error("Admin login error:", error);

      setLoginMessage(
        "লগইন ব্যর্থ হয়েছে। ইমেইল ও পাসওয়ার্ড যাচাই করুন। " +
        error.message
      );

    } finally {
      submitButton.disabled = false;
    }
  }
);


/* ==========================================
   ADMIN LOGOUT
========================================== */

$("adminLogoutBtn").addEventListener(
  "click",
  async () => {
    try {
      await signOut(auth);
    } catch (error) {
      setMessage(
        "Logout করতে সমস্যা হয়েছে: " +
        error.message,
        "error"
      );
    }
  }
);


/* ==========================================
   AUTH STATE + CUSTOM CLAIM CHECK
========================================== */

onAuthStateChanged(
  auth,
  async (user) => {
    const version = ++authVersion;

    stopListeners();

    currentAdmin = null;

    resetData();

    clearMessage();

    if (!user) {
      showLogin();

      return;
    }

    setLoginMessage(
      "Admin অনুমতি যাচাই করা হচ্ছে..."
    );

    try {
      const tokenResult =
        await getIdTokenResult(user, true);

      if (version !== authVersion) {
        return;
      }

      const isAdmin =
        tokenResult.claims.admin === true;

      if (!isAdmin) {
        showLogin();

        setLoginMessage(
          "এই অ্যাকাউন্টে Admin অনুমতি নেই।"
        );

        await signOut(auth);

        return;
      }

      currentAdmin = user;

      setLoginMessage("");

      showDashboard();

      startListeners();

    } catch (error) {
      console.error(
        "Admin verification error:",
        error
      );

      if (version !== authVersion) {
        return;
      }

      showLogin();

      setLoginMessage(
        "Admin যাচাই করা যায়নি: " +
        error.message
      );
    }
  }
);


/* ==========================================
   ADMIN TAB NAVIGATION
========================================== */

const tabPanels = {
  jobs: "adminJobsPanel",
  tasks: "adminTasksPanel",
  deposits: "adminDepositsPanel",
  withdrawals: "adminWithdrawalsPanel",
  users: "adminUsersPanel"
};


document
  .querySelectorAll("[data-admin-tab]")
  .forEach((button) => {
    button.addEventListener(
      "click",
      () => {
        const selected =
          button.dataset.adminTab;

        if (!tabPanels[selected]) {
          return;
        }

        document
          .querySelectorAll("[data-admin-tab]")
          .forEach((tab) => {
            tab.classList.remove("active");
          });

        button.classList.add("active");

        Object.entries(tabPanels).forEach(
          ([name, panelId]) => {
            const panel = $(panelId);

            if (panel) {
              panel.style.display =
                name === selected
                  ? "block"
                  : "none";
            }
          }
        );
      }
    );
  });


/* ==========================================
   COUNTS
========================================== */

function updateCounts() {
  $("pendingJobsCount").textContent =
    pendingJobs.length;

  $("pendingTasksCount").textContent =
    pendingTasks.length;

  $("pendingDepositsCount").textContent =
    pendingDeposits.length;

  $("pendingWithdrawalsCount").textContent =
    pendingWithdrawals.length;

  $("totalUsersCount").textContent =
    allUsers.length;
}


/* ==========================================
   SORT DATA
========================================== */

function sortNewest(items) {
  return [...items].sort((a, b) => {
    const aTime =
      a.createdAt?.seconds || 0;

    const bTime =
      b.createdAt?.seconds || 0;

    return bTime - aTime;
  });
}


/* ==========================================
   FIRESTORE LISTENERS
========================================== */

function startListeners() {
  stopListeners();

  listenPending(
    "jobs",
    (data) => {
      pendingJobs = data;

      renderJobs();
    }
  );

  listenPending(
    "tasks",
    (data) => {
      pendingTasks = data;

      renderTasks();
    }
  );

  listenPending(
    "deposits",
    (data) => {
      pendingDeposits = data;

      renderDeposits();
    }
  );

  listenPending(
    "withdrawals",
    (data) => {
      pendingWithdrawals = data;

      renderWithdrawals();
    }
  );

  listenUsers();
}


function listenPending(
  collectionName,
  callback
) {
  const reference = query(
    collection(db, collectionName),

    where("status", "==", "pending")
  );

  const unsubscribe = onSnapshot(
    reference,

    (snapshot) => {
      const data = snapshot.docs.map(
        (item) => ({
          id: item.id,
          ...item.data()
        })
      );

      callback(sortNewest(data));

      updateCounts();
    },

    (error) => {
      console.error(
        collectionName + " listener error:",
        error
      );

      setMessage(
        collectionName +
        " লোড করা যাচ্ছে না: " +
        error.message,
        "error"
      );

      const listId = {
        jobs: "adminJobsList",
        tasks: "adminTasksList",
        deposits: "adminDepositsList",
        withdrawals: "adminWithdrawalsList"
      }[collectionName];

      if (listId && $(listId)) {
        $(listId).innerHTML = emptyState(
          "ডেটা লোড করতে সমস্যা হয়েছে।"
        );
      }
    }
  );

  listeners.push(unsubscribe);
}


function listenUsers() {
  const unsubscribe = onSnapshot(
    collection(db, "users"),

    (snapshot) => {
      allUsers = sortNewest(
        snapshot.docs.map(
          (item) => ({
            id: item.id,
            ...item.data()
          })
        )
      );

      renderUsers();

      updateCounts();
    },

    (error) => {
      console.error(
        "Users listener error:",
        error
      );

      $("adminUsersList").innerHTML =
        emptyState(
          "Users লোড করতে সমস্যা হয়েছে: " +
          error.message
        );

      setMessage(
        "Users লোড করা যাচ্ছে না: " +
        error.message,
        "error"
      );
    }
  );

  listeners.push(unsubscribe);
}


/* ==========================================
   ACTION BUTTON HTML
========================================== */

function actionButtons(
  collectionName,
  documentId,
  allowApprove = true
) {
  const safeCollection =
    escapeHtml(collectionName);

  const safeId =
    escapeHtml(documentId);

  return `
    <div class="admin-actions">

      ${
        allowApprove
          ? `
            <button
              type="button"
              class="approve-btn"
              data-action="approve"
              data-collection="${safeCollection}"
              data-id="${safeId}"
            >
              <i class="fa-solid fa-check"></i>
              Approve
            </button>
          `
          : ""
      }

      <button
        type="button"
        class="reject-btn"
        data-action="reject"
        data-collection="${safeCollection}"
        data-id="${safeId}"
      >
        <i class="fa-solid fa-xmark"></i>
        Reject
      </button>

    </div>
  `;
}


/* ==========================================
   RENDER JOBS
========================================== */

function renderJobs() {
  const container = $("adminJobsList");

  if (!pendingJobs.length) {
    container.innerHTML = emptyState(
      "কোনো Pending Job নেই।"
    );

    return;
  }

  container.innerHTML = pendingJobs.map(
    (job) => `
      <article class="admin-item">

        <div class="admin-item-header">

          <div>
            <h3 class="admin-item-title">
              ${safeText(job.title)}
            </h3>

            <div class="admin-item-subtitle">
              ${dateText(job.createdAt)}
            </div>
          </div>

          ${chip(job.status)}

        </div>

        <div class="admin-item-body">

          <p>
            <strong>Posted By:</strong>
            ${safeText(job.creatorName)}
          </p>

          <p>
            <strong>Email:</strong>
            ${safeText(job.creatorEmail)}
          </p>

          <p>
            <strong>Reward:</strong>
            ${money(job.reward)}
          </p>

          <p>
            <strong>Description:</strong>
          </p>

          <div class="long-text">
            ${safeText(job.description)}
          </div>

        </div>

        ${actionButtons("jobs", job.id)}

      </article>
    `
  ).join("");
}


/* ==========================================
   RENDER TASKS
========================================== */

function renderTasks() {
  const container = $("adminTasksList");

  if (!pendingTasks.length) {
    container.innerHTML = emptyState(
      "কোনো Pending Task নেই।"
    );

    return;
  }

  container.innerHTML = pendingTasks.map(
    (task) => `
      <article class="admin-item">

        <div class="admin-item-header">

          <div>

            <h3 class="admin-item-title">
              ${safeText(task.jobTitle)}
            </h3>

            <div class="admin-item-subtitle">
              ${dateText(task.createdAt)}
            </div>

          </div>

          ${chip(task.status)}

        </div>

        <div class="admin-item-body">

          <p>
            <strong>Worker:</strong>
            ${safeText(task.workerName || task.name)}
          </p>

          <p>
            <strong>Email:</strong>
            ${safeText(task.workerEmail || task.email)}
          </p>

          <p>
            <strong>Job ID:</strong>
            ${safeText(task.jobId)}
          </p>

          <p>
            <strong>Proof:</strong>
          </p>

          <div class="long-text">
            ${safeText(task.proof)}
          </div>

        </div>

        ${actionButtons("tasks", task.id)}

      </article>
    `
  ).join("");
}


/* ==========================================
   RENDER DEPOSITS
========================================== */

function renderDeposits() {
  const container = $("adminDepositsList");

  if (!pendingDeposits.length) {
    container.innerHTML = emptyState(
      "কোনো Pending Deposit নেই।"
    );

    return;
  }

  container.innerHTML = pendingDeposits.map(
    (deposit) => `
      <article class="admin-item">

        <div class="admin-item-header">

          <div>

            <h3 class="admin-item-title">
              ${money(deposit.amount)}
            </h3>

            <div class="admin-item-subtitle">
              ${dateText(deposit.createdAt)}
            </div>

          </div>

          ${chip(deposit.status)}

        </div>

        <div class="admin-item-body">

          <p>
            <strong>User:</strong>
            ${safeText(deposit.name)}
          </p>

          <p>
            <strong>Email:</strong>
            ${safeText(deposit.email)}
          </p>

          <p>
            <strong>Method:</strong>
            ${safeText(deposit.method)}
          </p>

          <p>
            <strong>Transaction ID:</strong>
            ${safeText(deposit.transactionId)}
          </p>

          <p>
            <strong>User UID:</strong>
            ${safeText(deposit.uid)}
          </p>

          <p>
            <strong>Note:</strong>
            ${safeText(deposit.note)}
          </p>

        </div>

        <div class="testing-warning">
          <i class="fa-solid fa-circle-info"></i>
          এটি Test Deposit। Approve করলে
          যোগ্য ব্যবহারকারীর Lifetime Work
          Access চালু হতে পারে। কোনো
          বাস্তব ব্যালেন্স যোগ হবে না।
        </div>

        ${actionButtons(
          "deposits",
          deposit.id,
          Number(deposit.amount) >= MIN_DEPOSIT
        )}

      </article>
    `
  ).join("");
}


/* ==========================================
   RENDER WITHDRAWALS
========================================== */

function renderWithdrawals() {
  const container =
    $("adminWithdrawalsList");

  if (!pendingWithdrawals.length) {
    container.innerHTML = emptyState(
      "কোনো Pending Withdrawal নেই।"
    );

    return;
  }

  container.innerHTML =
    pendingWithdrawals.map(
      (withdrawal) => `
        <article class="admin-item">

          <div class="admin-item-header">

            <div>

              <h3 class="admin-item-title">
                ${money(withdrawal.amount)}
              </h3>

              <div class="admin-item-subtitle">
                ${dateText(withdrawal.createdAt)}
              </div>

            </div>

            ${chip(withdrawal.status)}

          </div>

          <div class="admin-item-body">

            <p>
              <strong>User:</strong>
              ${safeText(withdrawal.name)}
            </p>

            <p>
              <strong>Email:</strong>
              ${safeText(withdrawal.email)}
            </p>

            <p>
              <strong>Method:</strong>
              ${safeText(withdrawal.method)}
            </p>

            <p>
              <strong>Account:</strong>
              ${safeText(withdrawal.account)}
            </p>

            <p>
              <strong>Note:</strong>
              ${safeText(withdrawal.note)}
            </p>

          </div>

          <div class="testing-warning">
            Testing Mode-এ Withdrawal
            Approve এবং বাস্তব পেমেন্ট বন্ধ।
            পুরোনো Pending Request শুধু
            Reject করা যাবে।
          </div>

          ${actionButtons(
            "withdrawals",
            withdrawal.id,
            false
          )}

        </article>
      `
    ).join("");
}


/* ==========================================
   RENDER USERS
========================================== */

function renderUsers() {
  const container = $("adminUsersList");

  if (!allUsers.length) {
    container.innerHTML = emptyState(
      "কোনো Registered User পাওয়া যায়নি।"
    );

    return;
  }

  container.innerHTML = allUsers.map(
    (user) => `
      <article class="admin-item">

        <div class="admin-item-header">

          <div>

            <h3 class="admin-item-title">
              ${safeText(user.name)}
            </h3>

            <div class="admin-item-subtitle">
              ${safeText(user.email)}
            </div>

          </div>

        </div>

        <div class="admin-item-body">

          <p>
            <strong>UID:</strong>
            ${safeText(user.uid || user.id)}
          </p>

          <p>
            <strong>Main Balance:</strong>
            ${money(user.mainBalance || 0)}
          </p>

          <p>
            <strong>Deposit Balance:</strong>
            ${money(user.depositBalance || 0)}
          </p>

          <p>
            <strong>Registered:</strong>
            ${dateText(user.createdAt)}
          </p>

        </div>

      </article>
    `
  ).join("");
}


/* ==========================================
   RENDER ALL
========================================== */

function renderAll() {
  renderJobs();

  renderTasks();

  renderDeposits();

  renderWithdrawals();

  renderUsers();
}


/* ==========================================
   TRANSACTION: STATUS UPDATE
========================================== */

async function updateStatus(
  collectionName,
  documentId,
  newStatus
) {
  if (!currentAdmin) {
    throw new Error(
      "Admin Login প্রয়োজন।"
    );
  }

  const allowedCollections = [
    "jobs",
    "tasks",
    "deposits",
    "withdrawals"
  ];

  if (!allowedCollections.includes(
    collectionName
  )) {
    throw new Error(
      "Invalid collection."
    );
  }

  if (!["approved", "rejected", "active"].includes(
    newStatus
  )) {
    throw new Error(
      "Invalid status."
    );
  }

  if (
    collectionName === "withdrawals" &&
    newStatus !== "rejected"
  ) {
    throw new Error(
      "Testing Mode-এ Withdrawal Approve বন্ধ।"
    );
  }

  const reference = doc(
    db,
    collectionName,
    documentId
  );

  await runTransaction(
    db,
    async (transaction) => {
      const snapshot =
        await transaction.get(reference);

      if (!snapshot.exists()) {
        throw new Error(
          "ডকুমেন্ট পাওয়া যায়নি।"
        );
      }

      const data = snapshot.data();

      if (data.status !== "pending") {
        throw new Error(
          "এই রিকোয়েস্ট ইতিমধ্যে প্রসেস করা হয়েছে।"
        );
      }

      /* -------------------------------
         NORMAL STATUS CHANGE
      ------------------------------- */

      if (
        collectionName !== "deposits" ||
        newStatus === "rejected"
      ) {
        transaction.update(
          reference,
          {
            status: newStatus
          }
        );

        return;
      }

      /* -------------------------------
         DEPOSIT APPROVAL
      ------------------------------- */

      if (newStatus !== "approved") {
        throw new Error(
          "Invalid deposit action."
        );
      }

      const amount = Number(data.amount);

      if (
        !Number.isFinite(amount) ||
        amount < MIN_DEPOSIT
      ) {
        throw new Error(
          "কমপক্ষে ৳৩০০ Deposit প্রয়োজন।"
        );
      }

      if (
        typeof data.uid !== "string" ||
        !data.uid
      ) {
        throw new Error(
          "Deposit User UID পাওয়া যায়নি।"
        );
      }

      const accessReference = doc(
        db,
        "userAccess",
        data.uid
      );

      /*
         READ OPERATIONS FIRST
         Firestore transaction requires
         reads before writes.
      */

      const accessSnapshot =
        await transaction.get(
          accessReference
        );

      /*
         Existing lifetime activation
         must never be removed.
      */

      if (
        accessSnapshot.exists() &&
        accessSnapshot.data().workEnabled !== true
      ) {
        throw new Error(
          "আগের Access Document পাওয়া গেছে, " +
          "কিন্তু এটি Active নয়। " +
          "ম্যানুয়ালি যাচাই করুন।"
        );
      }

      /*
         Approve the test deposit.
         This does NOT credit money.
      */

      transaction.update(
        reference,
        {
          status: "approved"
        }
      );

      /*
         First approved deposit creates
         permanent work activation.
      */

      if (!accessSnapshot.exists()) {
        transaction.set(
          accessReference,
          {
            workEnabled: true,

            verifiedDepositId: documentId,

            activatedAt: serverTimestamp()
          }
        );
      }
    }
  );
}


/* ==========================================
   ADMIN ACTION HANDLER
========================================== */

document.addEventListener(
  "click",
  async (event) => {
    const button = event.target.closest(
      "[data-action][data-collection][data-id]"
    );

    if (!button) {
      return;
    }

    if (busy) {
      return;
    }

    const action = button.dataset.action;

    const collectionName =
      button.dataset.collection;

    const documentId =
      button.dataset.id;

    const allowedCollections = [
      "jobs",
      "tasks",
      "deposits",
      "withdrawals"
    ];

    if (
      !allowedCollections.includes(
        collectionName
      )
    ) {
      return;
    }

    if (!["approve", "reject"].includes(
      action
    )) {
      return;
    }

    let newStatus;

    if (action === "reject") {
      newStatus = "rejected";

    } else if (collectionName === "jobs") {
      newStatus = "active";

    } else {
      newStatus = "approved";
    }

    if (
      collectionName === "withdrawals" &&
      action === "approve"
    ) {
      setMessage(
        "Testing Mode-এ Withdrawal Approve বন্ধ।",
        "error"
      );

      return;
    }

    let confirmationText =
      "আপনি কি এই রিকোয়েস্ট " +
      (action === "approve"
        ? "Approve"
        : "Reject") +
      " করতে চান?";

    if (
      collectionName === "deposits" &&
      action === "approve"
    ) {
      confirmationText =
        "এটি শুধুমাত্র TEST Deposit Approval।\n\n" +
        "Approve করলে ব্যবহারকারীর Lifetime " +
        "Work Access চালু হতে পারে।\n\n" +
        "কোনো বাস্তব টাকা বা ব্যালেন্স যোগ হবে না।\n\n" +
        "আপনি কি নিশ্চিত?";
    }

    if (
      collectionName === "tasks" &&
      action === "approve"
    ) {
      confirmationText =
        "Task Approve করবেন?\n\n" +
        "Testing Mode-এ Worker-এর " +
        "ব্যালেন্সে টাকা যোগ হবে না।";
    }

    const confirmed =
      window.confirm(confirmationText);

    if (!confirmed) {
      return;
    }

    busy = true;

    button.disabled = true;

    clearMessage();

    try {
      await updateStatus(
        collectionName,
        documentId,
        newStatus
      );

      let successMessage =
        "রিকোয়েস্ট সফলভাবে আপডেট হয়েছে।";

      if (
        collectionName === "deposits" &&
        newStatus === "approved"
      ) {
        successMessage =
          "Test Deposit Approved। " +
          "প্রথমবার যোগ্য Deposit হলে " +
          "Lifetime Work Access চালু হয়েছে। " +
          "বাস্তব ব্যালেন্স পরিবর্তন হয়নি।";
      }

      if (
        collectionName === "tasks" &&
        newStatus === "approved"
      ) {
        successMessage =
          "Task Approved। Testing Mode-এ " +
          "Worker Balance পরিবর্তন হয়নি।";
      }

      setMessage(
        successMessage,
        "success"
      );

      window.scrollTo({
        top: 0,
        behavior: "smooth"
      });

    } catch (error) {
      console.error(
        "Admin action error:",
        error
      );

      setMessage(
        "কাজটি সম্পন্ন হয়নি: " +
        error.message,
        "error"
      );

      button.disabled = false;

    } finally {
      busy = false;
    }
  }
);


/* ==========================================
   INITIAL UI
========================================== */

showLogin();

resetData();

console.log(
  "Micro Job Admin Panel Loaded - Testing Mode"
);
