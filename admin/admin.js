/* ==========================================
   MICRO JOB ADMIN PANEL
   HISTORY SYSTEM - TESTING MODE
   Firebase SDK 10.12.5
========================================== */

import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";

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
  onSnapshot,
  doc,
  runTransaction,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import {
  firebaseConfig
} from "../firebase-config.js";


/* ==========================================
   FIREBASE
========================================== */

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const $ = id => document.getElementById(id);

const MIN_DEPOSIT = 300;


/* ==========================================
   STATE
========================================== */

let currentAdmin = null;
let listeners = [];
let authVersion = 0;
let busy = false;

const records = {
  jobs: [],
  tasks: [],
  deposits: [],
  withdrawals: [],
  users: []
};

const filters = {
  jobs: "pending",
  tasks: "pending",
  deposits: "pending",
  withdrawals: "pending"
};

const settings = {
  jobs: {
    panel: "adminJobsPanel",
    list: "adminJobsList",
    count: "pendingJobsCount",
    title: "Jobs"
  },

  tasks: {
    panel: "adminTasksPanel",
    list: "adminTasksList",
    count: "pendingTasksCount",
    title: "Tasks"
  },

  deposits: {
    panel: "adminDepositsPanel",
    list: "adminDepositsList",
    count: "pendingDepositsCount",
    title: "Deposits"
  },

  withdrawals: {
    panel: "adminWithdrawalsPanel",
    list: "adminWithdrawalsList",
    count: "pendingWithdrawalsCount",
    title: "Withdrawals"
  }
};


/* ==========================================
   HELPERS
========================================== */

function escapeHtml(value = "") {
  return String(value).replace(
    /[&<>"']/g,
    character => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[character]
  );
}

function text(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "—";
  }

  return escapeHtml(value);
}

function money(value) {
  const number = Number(value) || 0;

  return "৳ " + number.toLocaleString("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function dateText(value) {
  if (!value) return "—";

  try {
    const date = value.toDate
      ? value.toDate()
      : value.seconds
        ? new Date(value.seconds * 1000)
        : null;

    return date
      ? date.toLocaleString("bn-BD")
      : "—";

  } catch {
    return "—";
  }
}

function statusChip(status) {
  const safe = escapeHtml(status || "pending");

  return `
    <span class="status-chip ${safe}">
      ${safe}
    </span>
  `;
}

function emptyState(message) {
  return `
    <div class="empty-state">
      ${escapeHtml(message)}
    </div>
  `;
}

function row(label, value) {
  return `
    <p>
      <strong>${escapeHtml(label)}:</strong>
      ${text(value)}
    </p>
  `;
}

function message(value, type = "success") {
  const element = $("adminMessage");

  if (!element) return;

  element.textContent = value;
  element.className = "message " + type;
}

function clearMessage() {
  const element = $("adminMessage");

  if (!element) return;

  element.textContent = "";
  element.className = "message hidden";
}

function loginMessage(value) {
  $("adminLoginMessage").textContent = value;
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

function sortNewest(items) {
  return [...items].sort((a, b) => {
    const aTime = a.createdAt?.seconds || 0;
    const bTime = b.createdAt?.seconds || 0;

    return bTime - aTime;
  });
}

function stopListeners() {
  listeners.forEach(unsubscribe => {
    try {
      unsubscribe();
    } catch (error) {
      console.error(error);
    }
  });

  listeners = [];
}

function resetData() {
  Object.keys(records).forEach(key => {
    records[key] = [];
  });

  updateCounts();
  renderAll();
}


/* ==========================================
   LOGIN
========================================== */

$("adminLoginForm").addEventListener(
  "submit",
  async event => {
    event.preventDefault();

    const email = $("adminEmail").value.trim();
    const password = $("adminPassword").value;

    const button = $("adminLoginForm").querySelector(
      'button[type="submit"]'
    );

    if (!email || !password) {
      loginMessage("ইমেইল ও পাসওয়ার্ড লিখুন।");
      return;
    }

    button.disabled = true;
    loginMessage("লগইন হচ্ছে...");

    try {
      await signInWithEmailAndPassword(
        auth,
        email,
        password
      );

      loginMessage("Admin অনুমতি যাচাই হচ্ছে...");

    } catch (error) {
      loginMessage(
        "লগইন ব্যর্থ হয়েছে: " + error.message
      );

    } finally {
      button.disabled = false;
    }
  }
);


/* ==========================================
   LOGOUT
========================================== */

$("adminLogoutBtn").addEventListener(
  "click",
  async () => {
    try {
      await signOut(auth);

    } catch (error) {
      message(error.message, "error");
    }
  }
);


/* ==========================================
   AUTH + ADMIN CLAIM
========================================== */

onAuthStateChanged(
  auth,
  async user => {
    const version = ++authVersion;

    stopListeners();
    currentAdmin = null;
    resetData();
    clearMessage();

    if (!user) {
      showLogin();
      return;
    }

    loginMessage("Admin অনুমতি যাচাই হচ্ছে...");

    try {
      const token = await getIdTokenResult(
        user,
        true
      );

      if (version !== authVersion) return;

      if (token.claims.admin !== true) {
        showLogin();

        loginMessage(
          "এই অ্যাকাউন্টে Admin অনুমতি নেই।"
        );

        await signOut(auth);
        return;
      }

      currentAdmin = user;

      loginMessage("");
      showDashboard();

      startListeners();

    } catch (error) {
      if (version !== authVersion) return;

      showLogin();

      loginMessage(
        "Admin যাচাই ব্যর্থ: " + error.message
      );
    }
  }
);


/* ==========================================
   MAIN NAVIGATION
========================================== */

const panels = {
  jobs: "adminJobsPanel",
  tasks: "adminTasksPanel",
  deposits: "adminDepositsPanel",
  withdrawals: "adminWithdrawalsPanel",
  users: "adminUsersPanel"
};

document.querySelectorAll(
  "[data-admin-tab]"
).forEach(button => {
  button.addEventListener("click", () => {
    const selected = button.dataset.adminTab;

    if (!panels[selected]) return;

    document.querySelectorAll(
      "[data-admin-tab]"
    ).forEach(tab => {
      tab.classList.toggle(
        "active",
        tab === button
      );
    });

    Object.entries(panels).forEach(
      ([name, id]) => {
        $(id).style.display =
          name === selected
            ? "block"
            : "none";
      }
    );
  });
});


/* ==========================================
   HISTORY FILTER BUTTONS
========================================== */

function createHistoryFilters() {
  Object.entries(settings).forEach(
    ([collectionName, config]) => {
      const panel = $(config.panel);
      const list = $(config.list);

      if (!panel || !list) return;

      const wrapper = document.createElement("div");

      wrapper.className = "history-filters";

      wrapper.style.cssText = `
        display:flex;
        gap:8px;
        overflow-x:auto;
        padding:12px 0;
        margin:10px 0;
      `;

      wrapper.innerHTML = `
        <button
          type="button"
          class="history-filter active"
          data-history-collection="${collectionName}"
          data-history-status="pending"
        >
          Pending
        </button>

        <button
          type="button"
          class="history-filter"
          data-history-collection="${collectionName}"
          data-history-status="approved"
        >
          Approved
        </button>

        <button
          type="button"
          class="history-filter"
          data-history-collection="${collectionName}"
          data-history-status="rejected"
        >
          Rejected
        </button>

        <button
          type="button"
          class="history-filter"
          data-history-collection="${collectionName}"
          data-history-status="all"
        >
          All History
        </button>
      `;

      panel.insertBefore(wrapper, list);

      const buttons = wrapper.querySelectorAll(
        ".history-filter"
      );

      buttons.forEach(button => {
        button.style.cssText = `
          border:1px solid #e2e8f0;
          background:white;
          color:#475569;
          border-radius:10px;
          padding:10px 13px;
          font-size:13px;
          font-weight:700;
          white-space:nowrap;
          cursor:pointer;
          flex-shrink:0;
        `;
      });

      setFilterStyle(wrapper, "pending");
    }
  );
}

function setFilterStyle(wrapper, selected) {
  wrapper.querySelectorAll(
    ".history-filter"
  ).forEach(button => {
    const active =
      button.dataset.historyStatus === selected;

    button.style.background =
      active ? "#5145e5" : "#ffffff";

    button.style.color =
      active ? "#ffffff" : "#475569";

    button.style.borderColor =
      active ? "#5145e5" : "#e2e8f0";
  });
}

document.addEventListener(
  "click",
  event => {
    const button = event.target.closest(
      "[data-history-collection][data-history-status]"
    );

    if (!button) return;

    const name = button.dataset.historyCollection;
    const status = button.dataset.historyStatus;

    if (!settings[name]) return;

    if (![
      "pending",
      "approved",
      "rejected",
      "all"
    ].includes(status)) {
      return;
    }

    filters[name] = status;

    setFilterStyle(
      button.parentElement,
      status
    );

    renderCollection(name);
  }
);


/* ==========================================
   COUNTS
========================================== */

function updateCounts() {
  Object.entries(settings).forEach(
    ([name, config]) => {
      const count = records[name].filter(
        item => item.status === "pending"
      ).length;

      $(config.count).textContent = count;
    }
  );

  $("totalUsersCount").textContent =
    records.users.length;
}


/* ==========================================
   FIRESTORE LISTENERS
========================================== */

function startListeners() {
  stopListeners();

  [
    "jobs",
    "tasks",
    "deposits",
    "withdrawals"
  ].forEach(name => {
    const unsubscribe = onSnapshot(
      collection(db, name),

      snapshot => {
        records[name] = sortNewest(
          snapshot.docs.map(item => ({
            ...item.data(),
            id: item.id
          }))
        );

        updateCounts();
        renderCollection(name);
      },

      error => {
        console.error(name, error);

        message(
          name + " লোড হয়নি: " +
          error.message,
          "error"
        );

        $(settings[name].list).innerHTML =
          emptyState(
            "History লোড করতে সমস্যা হয়েছে: " +
            error.message
          );
      }
    );

    listeners.push(unsubscribe);
  });

  const usersListener = onSnapshot(
    collection(db, "users"),

    snapshot => {
      records.users = sortNewest(
        snapshot.docs.map(item => ({
          ...item.data(),
          id: item.id
        }))
      );

      updateCounts();
      renderUsers();
    },

    error => {
      console.error(error);

      $("adminUsersList").innerHTML =
        emptyState(
          "Users লোড করতে সমস্যা হয়েছে: " +
          error.message
        );
    }
  );

  listeners.push(usersListener);
}


/* ==========================================
   FILTER LOGIC
========================================== */

function getFilteredData(name) {
  const selected = filters[name];

  if (selected === "all") {
    return records[name];
  }

  if (
    name === "jobs" &&
    selected === "approved"
  ) {
    return records.jobs.filter(
      item =>
        item.status === "active" ||
        item.status === "approved"
    );
  }

  return records[name].filter(
    item => item.status === selected
  );
}


/* ==========================================
   ACTION BUTTONS
========================================== */

function actionButtons(
  name,
  id,
  status,
  allowApprove = true
) {
  if (status !== "pending") {
    return `
      <div class="admin-actions">
        ${statusChip(status)}
        <span style="
          color:#64748b;
          font-size:13px;
        ">
          Already Processed
        </span>
      </div>
    `;
  }

  const safeName = escapeHtml(name);
  const safeId = escapeHtml(id);

  return `
    <div class="admin-actions">

      ${
        allowApprove
          ? `
            <button
              type="button"
              class="approve-btn"
              data-action="approve"
              data-collection="${safeName}"
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
        data-collection="${safeName}"
        data-id="${safeId}"
      >
        <i class="fa-solid fa-xmark"></i>
        Reject
      </button>

    </div>
  `;
}


/* ==========================================
   JOB CARD
========================================== */

function jobCard(job) {
  return `
    <article class="admin-item">

      <div class="admin-item-header">
        <div>
          <h3 class="admin-item-title">
            ${text(job.title)}
          </h3>

          <div class="admin-item-subtitle">
            ${dateText(job.createdAt)}
          </div>
        </div>

        ${statusChip(job.status)}
      </div>

      <div class="admin-item-body">

        ${row("Posted By", job.creatorName)}

        ${row("Email", job.creatorEmail)}

        ${row("Reward", money(job.reward))}

        ${row("Job ID", job.id)}

        <p><strong>Description:</strong></p>

        <div class="long-text">
          ${text(job.description)}
        </div>

      </div>

      ${actionButtons(
        "jobs",
        job.id,
        job.status
      )}

    </article>
  `;
}


/* ==========================================
   TASK CARD
========================================== */

function taskCard(task) {
  return `
    <article class="admin-item">

      <div class="admin-item-header">
        <div>
          <h3 class="admin-item-title">
            ${text(task.jobTitle)}
          </h3>

          <div class="admin-item-subtitle">
            ${dateText(task.createdAt)}
          </div>
        </div>

        ${statusChip(task.status)}
      </div>

      <div class="admin-item-body">

        ${row(
          "Worker",
          task.workerName ||
          task.name ||
          task.userName
        )}

        ${row(
          "Email",
          task.workerEmail ||
          task.email ||
          task.userEmail
        )}

        ${row(
          "Worker UID",
          task.uid ||
          task.workerId
        )}

        ${row("Job ID", task.jobId)}

        <p><strong>Proof:</strong></p>

        <div class="long-text">
          ${text(task.proof)}
        </div>

      </div>

      ${actionButtons(
        "tasks",
        task.id,
        task.status
      )}

    </article>
  `;
}


/* ==========================================
   DEPOSIT CARD
========================================== */

function depositCard(deposit) {
  return `
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

        ${statusChip(deposit.status)}
      </div>

      <div class="admin-item-body">

        ${row("User", deposit.name)}

        ${row("Email", deposit.email)}

        ${row("Method", deposit.method)}

        ${row(
          "Transaction ID",
          deposit.transactionId
        )}

        ${row("User UID", deposit.uid)}

        ${row("Note", deposit.note)}

      </div>

      <div class="testing-warning">
        এটি Testing Mode। Deposit Approve
        করলে Lifetime Work Access চালু
        হতে পারে, কিন্তু বাস্তব টাকা বা
        ব্যালেন্স যোগ হবে না।
      </div>

      ${actionButtons(
        "deposits",
        deposit.id,
        deposit.status,
        Number(deposit.amount) >= MIN_DEPOSIT
      )}

    </article>
  `;
}


/* ==========================================
   WITHDRAWAL CARD
========================================== */

function withdrawalCard(item) {
  return `
    <article class="admin-item">

      <div class="admin-item-header">
        <div>
          <h3 class="admin-item-title">
            ${money(item.amount)}
          </h3>

          <div class="admin-item-subtitle">
            ${dateText(item.createdAt)}
          </div>
        </div>

        ${statusChip(item.status)}
      </div>

      <div class="admin-item-body">

        ${row("User", item.name)}

        ${row("Email", item.email)}

        ${row("Method", item.method)}

        ${row("Account", item.account)}

        ${row("Note", item.note)}

      </div>

      <div class="testing-warning">
        Testing Mode-এ Withdrawal
        Approval ও বাস্তব পেমেন্ট বন্ধ।
      </div>

      ${actionButtons(
        "withdrawals",
        item.id,
        item.status,
        false
      )}

    </article>
  `;
}


/* ==========================================
   RENDER HISTORY
========================================== */

function renderCollection(name) {
  const config = settings[name];

  if (!config) return;

  const container = $(config.list);
  const data = getFilteredData(name);

  if (!data.length) {
    const status = filters[name];

    container.innerHTML = emptyState(
      status === "all"
        ? "কোনো History পাওয়া যায়নি।"
        : "কোনো " +
          status.toUpperCase() +
          " " +
          config.title +
          " নেই।"
    );

    return;
  }

  const renderers = {
    jobs: jobCard,
    tasks: taskCard,
    deposits: depositCard,
    withdrawals: withdrawalCard
  };

  container.innerHTML =
    data.map(renderers[name]).join("");
}


/* ==========================================
   USERS
========================================== */

function renderUsers() {
  const container = $("adminUsersList");

  if (!records.users.length) {
    container.innerHTML = emptyState(
      "কোনো User পাওয়া যায়নি।"
    );

    return;
  }

  container.innerHTML =
    records.users.map(user => `
      <article class="admin-item">

        <h3 class="admin-item-title">
          ${text(user.name)}
        </h3>

        <div class="admin-item-body">

          ${row("Email", user.email)}

          ${row(
            "UID",
            user.uid || user.id
          )}

          ${row(
            "Main Balance",
            money(user.mainBalance || 0)
          )}

          ${row(
            "Deposit Balance",
            money(user.depositBalance || 0)
          )}

          ${row(
            "Registered",
            dateText(user.createdAt)
          )}

        </div>

      </article>
    `).join("");
}

function renderAll() {
  Object.keys(settings).forEach(
    renderCollection
  );

  renderUsers();
}


/* ==========================================
   SECURE STATUS TRANSACTION
========================================== */

async function updateStatus(
  name,
  id,
  newStatus
) {
  if (!currentAdmin) {
    throw new Error(
      "Admin Login প্রয়োজন।"
    );
  }

  if (!settings[name]) {
    throw new Error(
      "Invalid collection."
    );
  }

  const expectedStatuses = {
    jobs: ["active", "rejected"],
    tasks: ["approved", "rejected"],
    deposits: ["approved", "rejected"],
    withdrawals: ["rejected"]
  };

  if (!expectedStatuses[name].includes(
    newStatus
  )) {
    throw new Error(
      "এই Action অনুমোদিত নয়।"
    );
  }

  const reference = doc(db, name, id);

  await runTransaction(
    db,
    async transaction => {
      const snapshot =
        await transaction.get(reference);

      if (!snapshot.exists()) {
        throw new Error(
          "রিকোয়েস্ট পাওয়া যায়নি।"
        );
      }

      const data = snapshot.data();

      if (data.status !== "pending") {
        throw new Error(
          "রিকোয়েস্ট ইতিমধ্যে প্রসেস হয়েছে।"
        );
      }

      /*
        Jobs, Tasks, Withdrawals
        and Deposit Rejection:
        STATUS CHANGE ONLY
      */

      if (
        name !== "deposits" ||
        newStatus === "rejected"
      ) {
        transaction.update(reference, {
          status: newStatus
        });

        return;
      }

      /*
        TEST DEPOSIT APPROVAL
      */

      const amount = Number(data.amount);

      if (
        !Number.isFinite(amount) ||
        amount < MIN_DEPOSIT
      ) {
        throw new Error(
          "ন্যূনতম ৳৩০০ Deposit প্রয়োজন।"
        );
      }

      if (
        typeof data.uid !== "string" ||
        !data.uid
      ) {
        throw new Error(
          "User UID পাওয়া যায়নি।"
        );
      }

      const accessReference = doc(
        db,
        "userAccess",
        data.uid
      );

      /*
        Firestore requires all reads
        before transaction writes.
      */

      const accessSnapshot =
        await transaction.get(
          accessReference
        );

      if (
        accessSnapshot.exists() &&
        accessSnapshot.data().workEnabled !== true
      ) {
        throw new Error(
          "Existing Access Document Active নয়।"
        );
      }

      transaction.update(reference, {
        status: "approved"
      });

      /*
        First approval creates
        lifetime activation.
      */

      if (!accessSnapshot.exists()) {
        transaction.set(
          accessReference,
          {
            workEnabled: true,
            verifiedDepositId: id,
            activatedAt: serverTimestamp()
          }
        );
      }
    }
  );
}


/* ==========================================
   APPROVE / REJECT HANDLER
========================================== */

document.addEventListener(
  "click",
  async event => {
    const button = event.target.closest(
      "[data-action][data-collection][data-id]"
    );

    if (!button || busy) return;

    const action = button.dataset.action;
    const name = button.dataset.collection;
    const id = button.dataset.id;

    if (
      !["approve", "reject"].includes(action) ||
      !settings[name]
    ) {
      return;
    }

    let newStatus;

    if (action === "reject") {
      newStatus = "rejected";

    } else if (name === "jobs") {
      newStatus = "active";

    } else {
      newStatus = "approved";
    }

    if (
      name === "withdrawals" &&
      action === "approve"
    ) {
      message(
        "Withdrawal Approval বন্ধ।",
        "error"
      );

      return;
    }

    let confirmText =
      "আপনি কি এই রিকোয়েস্ট " +
      (action === "approve"
        ? "Approve"
        : "Reject") +
      " করতে চান?";

    if (
      name === "deposits" &&
      action === "approve"
    ) {
      confirmText =
        "TEST DEPOSIT APPROVAL\n\n" +
        "এতে Lifetime Work Access " +
        "চালু হতে পারে।\n\n" +
        "কোনো বাস্তব ব্যালেন্স যোগ হবে না।\n\n" +
        "আপনি কি নিশ্চিত?";
    }

    if (
      name === "tasks" &&
      action === "approve"
    ) {
      confirmText =
        "Task Approve করবেন?\n\n" +
        "Testing Mode-এ Worker Balance " +
        "পরিবর্তন হবে না।";
    }

    if (!window.confirm(confirmText)) {
      return;
    }

    busy = true;
    button.disabled = true;

    clearMessage();

    try {
      await updateStatus(
        name,
        id,
        newStatus
      );

      message(
        "রিকোয়েস্ট সফলভাবে " +
        (newStatus === "active"
          ? "Active"
          : newStatus) +
        " হয়েছে। History থেকে দেখতে পারবেন।",
        "success"
      );

      window.scrollTo({
        top: 0,
        behavior: "smooth"
      });

    } catch (error) {
      console.error(error);

      message(
        "সমস্যা হয়েছে: " + error.message,
        "error"
      );

      button.disabled = false;

    } finally {
      busy = false;
    }
  }
);


/* ==========================================
   INITIALIZATION
========================================== */

createHistoryFilters();

showLogin();

resetData();

console.log(
  "Micro Job Admin History System Loaded"
);
