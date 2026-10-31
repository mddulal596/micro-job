/* ==========================================
   MICRO JOB ADMIN PANEL
   GOOGLE + EMAIL LOGIN
   FIREBASE SPARK TESTING MODE
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
   INITIALIZATION
========================================== */

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const googleProvider = new GoogleAuthProvider();

googleProvider.setCustomParameters({
  prompt: "select_account"
});

const $ = id => document.getElementById(id);

const MIN_DEPOSIT = 300;

let currentAdmin = null;
let listeners = [];
let authVersion = 0;
let busy = false;
let usersLoaded = false;
let activeTab = "jobs";

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

function row(label, value) {
  return `
    <p>
      <strong>${escapeHtml(label)}:</strong>
      ${text(value)}
    </p>
  `;
}

function statusChip(status = "pending") {
  const safeStatus = escapeHtml(status);

  return `
    <span class="status-chip ${safeStatus}">
      ${safeStatus}
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

function sortNewest(items) {
  return [...items].sort((a, b) => {
    const first = a.createdAt?.seconds || 0;
    const second = b.createdAt?.seconds || 0;
    return second - first;
  });
}


/* ==========================================
   MESSAGES
========================================== */

function setMessage(value, type = "success") {
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
  const element = $("adminLoginMessage");

  if (element) {
    element.textContent = value;
  }
}


/* ==========================================
   AUTH VIEWS
========================================== */

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


/* ==========================================
   LISTENERS
========================================== */

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
  Object.keys(records).forEach(name => {
    records[name] = [];
  });

  usersLoaded = false;

  updateCounts();
  renderAll();
}


/* ==========================================
   EMAIL / PASSWORD LOGIN
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

      loginMessage(
        "Admin অনুমতি যাচাই করা হচ্ছে..."
      );

    } catch (error) {
      console.error(error);

      loginMessage(
        "লগইন ব্যর্থ: " + error.message
      );

    } finally {
      button.disabled = false;
    }
  }
);


/* ==========================================
   GOOGLE LOGIN
========================================== */

$("adminGoogleLoginBtn").addEventListener(
  "click",
  async () => {
    const button = $("adminGoogleLoginBtn");

    button.disabled = true;

    loginMessage(
      "Google Login চালু হচ্ছে..."
    );

    try {
      await signInWithPopup(
        auth,
        googleProvider
      );

      loginMessage(
        "Admin অনুমতি যাচাই করা হচ্ছে..."
      );

    } catch (error) {
      console.error(error);

      const redirectCodes = [
        "auth/popup-blocked",
        "auth/operation-not-supported-in-this-environment"
      ];

      if (redirectCodes.includes(error.code)) {
        try {
          loginMessage(
            "Google Login পেজে নেওয়া হচ্ছে..."
          );

          await signInWithRedirect(
            auth,
            googleProvider
          );

          return;

        } catch (redirectError) {
          console.error(redirectError);

          loginMessage(
            "Google Login ব্যর্থ: " +
            redirectError.message
          );
        }

      } else if (
        error.code !== "auth/popup-closed-by-user" &&
        error.code !== "auth/cancelled-popup-request"
      ) {
        loginMessage(
          "Google Login ব্যর্থ: " +
          error.message
        );

      } else {
        loginMessage(
          "Google Login বাতিল হয়েছে।"
        );
      }

    } finally {
      button.disabled = false;
    }
  }
);


/* ==========================================
   REDIRECT RESULT
========================================== */

getRedirectResult(auth).catch(error => {
  console.error(
    "Google redirect error:",
    error
  );

  loginMessage(
    "Google Login ব্যর্থ: " + error.message
  );
});


/* ==========================================
   LOGOUT
========================================== */

$("adminLogoutBtn").addEventListener(
  "click",
  async () => {
    try {
      await signOut(auth);

    } catch (error) {
      setMessage(
        "Logout ব্যর্থ: " + error.message,
        "error"
      );
    }
  }
);


/* ==========================================
   VERIFY ADMIN CLAIM
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

    loginMessage(
      "Admin অনুমতি যাচাই হচ্ছে..."
    );

    try {
      const tokenResult = await getIdTokenResult(
        user,
        true
      );

      if (version !== authVersion) {
        return;
      }

      if (tokenResult.claims.admin !== true) {
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
      console.error(error);

      if (version !== authVersion) {
        return;
      }

      showLogin();

      loginMessage(
        "Admin যাচাই করা যায়নি: " +
        error.message
      );
    }
  }
);


/* ==========================================
   ADMIN NAVIGATION
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

    activeTab = selected;

    document.querySelectorAll(
      "[data-admin-tab]"
    ).forEach(tab => {
      tab.classList.toggle(
        "active",
        tab === button
      );
    });

    Object.entries(panels).forEach(
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
  });
});


/* ==========================================
   HISTORY HEADINGS
========================================== */

function updatePanelHeading(name) {
  const config = settings[name];

  if (!config) return;

  const panel = $(config.panel);
  if (!panel) return;

  const heading = panel.querySelector(
    ".panel-heading h2"
  );

  const description = panel.querySelector(
    ".panel-heading p"
  );

  if (!heading) return;

  const selected = filters[name];

  const labels = {
    pending: "Pending",
    approved: "Approved",
    rejected: "Rejected",
    all: "All"
  };

  const descriptions = {
    pending: "অনুমোদনের অপেক্ষায় থাকা রিকোয়েস্টগুলো দেখুন।",
    approved: "আগে অনুমোদিত রিকোয়েস্টগুলো দেখুন।",
    rejected: "আগে বাতিল করা রিকোয়েস্টগুলো দেখুন।",
    all: "সব রিকোয়েস্টের Status ও বিস্তারিত দেখুন।"
  };

  const icons = {
    jobs: "fa-briefcase",
    tasks: "fa-list-check",
    deposits: "fa-wallet",
    withdrawals: "fa-money-bill-transfer"
  };

  const title =
    selected === "all"
      ? "All " + config.title + " History"
      : labels[selected] + " " + config.title;

  heading.innerHTML = `
    <i class="fa-solid ${icons[name]}"></i>
    ${escapeHtml(title)}
  `;

  if (description) {
    description.textContent =
      descriptions[selected];
  }
}


/* ==========================================
   HISTORY FILTERS
========================================== */

function createHistoryFilters() {
  Object.entries(settings).forEach(
    ([name, config]) => {
      const panel = $(config.panel);
      const list = $(config.list);

      if (!panel || !list) return;

      const existing = panel.querySelector(
        ".history-filters"
      );

      if (existing) existing.remove();

      const wrapper =
        document.createElement("div");

      wrapper.className = "history-filters";

      wrapper.style.cssText = `
        display:flex;
        gap:8px;
        overflow-x:auto;
        padding:12px 0;
        margin:10px 0;
      `;

      wrapper.innerHTML = `
        <button type="button"
          class="history-filter"
          data-history-collection="${name}"
          data-history-status="pending">
          Pending
        </button>

        <button type="button"
          class="history-filter"
          data-history-collection="${name}"
          data-history-status="approved">
          Approved
        </button>

        <button type="button"
          class="history-filter"
          data-history-collection="${name}"
          data-history-status="rejected">
          Rejected
        </button>

        <button type="button"
          class="history-filter"
          data-history-collection="${name}"
          data-history-status="all">
          All History
        </button>
      `;

      panel.insertBefore(wrapper, list);

      wrapper.querySelectorAll(
        ".history-filter"
      ).forEach(button => {
        button.style.cssText = `
          border:1px solid #e2e8f0;
          background:white;
          color:#475569;
          border-radius:10px;
          padding:10px 13px;
          font-size:13px;
          font-weight:700;
          white-space:nowrap;
          flex-shrink:0;
          cursor:pointer;
        `;
      });

      setFilterStyle(wrapper, filters[name]);
      updatePanelHeading(name);
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

    const name =
      button.dataset.historyCollection;

    const status =
      button.dataset.historyStatus;

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

    updatePanelHeading(name);
    renderCollection(name);
  }
);


/* ==========================================
   STATISTICS
========================================== */

function updateCounts() {
  Object.entries(settings).forEach(
    ([name, config]) => {
      const count = records[name].filter(
        item => item.status === "pending"
      ).length;

      const element = $(config.count);

      if (element) {
        element.textContent = count;
      }
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
        console.error(
          name + " listener error:",
          error
        );

        setMessage(
          name + " লোড হয়নি: " +
          error.message,
          "error"
        );

        $(settings[name].list).innerHTML =
          emptyState(
            "ডেটা লোড করা যাচ্ছে না: " +
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

      usersLoaded = true;

      updateCounts();
      renderUsers();
      renderCollection("tasks");
    },

    error => {
      console.error(
        "Users listener error:",
        error
      );

      usersLoaded = false;

      $("adminUsersList").innerHTML =
        emptyState(
          "Users লোড হয়নি: " +
          error.message
        );

      setMessage(
        "Users লোড করতে সমস্যা হয়েছে: " +
        error.message,
        "error"
      );
    }
  );

  listeners.push(usersListener);
}


/* ==========================================
   WORKER DETAILS
========================================== */

function findWorker(task) {
  let workerUid =
    task.uid ||
    task.workerId ||
    task.workerUid ||
    task.userId ||
    task.createdBy ||
    "";

  if (
    !workerUid &&
    typeof task.id === "string" &&
    typeof task.jobId === "string"
  ) {
    const prefix = task.jobId + "_";

    if (task.id.startsWith(prefix)) {
      workerUid = task.id.slice(
        prefix.length
      );
    }
  }

  const matchedUser = records.users.find(
    user =>
      user.id === workerUid ||
      user.uid === workerUid
  );

  const workerName =
    task.workerName ||
    task.name ||
    task.userName ||
    task.workerDisplayName ||
    matchedUser?.name ||
    matchedUser?.displayName ||
    "";

  const workerEmail =
    task.workerEmail ||
    task.email ||
    task.userEmail ||
    matchedUser?.email ||
    "";

  return {
    uid: workerUid,
    name: workerName,
    email: workerEmail
  };
}


/* ==========================================
   FILTER RECORDS
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
        <span style="color:#64748b;font-size:13px;">
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
              data-id="${safeId}">
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
        data-id="${safeId}">
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
  const worker = findWorker(task);

  const workerName = worker.name ||
    (usersLoaded
      ? "তথ্য পাওয়া যায়নি"
      : "লোড হচ্ছে...");

  const workerEmail = worker.email ||
    (usersLoaded
      ? "তথ্য পাওয়া যায়নি"
      : "লোড হচ্ছে...");

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

        ${row("Worker", workerName)}
        ${row("Email", workerEmail)}
        ${row("Worker UID", worker.uid || "তথ্য পাওয়া যায়নি")}
        ${row("Job ID", task.jobId)}
        ${row("Task ID", task.id)}

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
        ${row("Transaction ID", deposit.transactionId)}
        ${row("User UID", deposit.uid)}
        ${row("Note", deposit.note)}

      </div>

      <div class="testing-warning">
        Testing Mode: Test Deposit অনুমোদন করলে
        Lifetime Work Access চালু হতে পারে।
        কোনো বাস্তব টাকা বা Balance যোগ হয় না।
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
        Testing Mode-এ Withdrawal Approval
        ও বাস্তব পেমেন্ট বন্ধ।
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
   RENDER COLLECTION
========================================== */

function renderCollection(name) {
  const config = settings[name];

  if (!config) return;

  const container = $(config.list);

  if (!container) return;

  const data = getFilteredData(name);

  if (!data.length) {
    const selected = filters[name];

    container.innerHTML = emptyState(
      selected === "all"
        ? "কোনো History পাওয়া যায়নি।"
        : "কোনো " +
          selected.toUpperCase() +
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
      "কোনো Registered User পাওয়া যায়নি।"
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
          ${row("UID", user.uid || user.id)}

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


/* ==========================================
   RENDER ALL
========================================== */

function renderAll() {
  Object.keys(settings).forEach(
    name => renderCollection(name)
  );

  renderUsers();
}


/* ==========================================
   SECURE FIRESTORE TRANSACTION
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

  const expectedStatuses = {
    jobs: ["active", "rejected"],
    tasks: ["approved", "rejected"],
    deposits: ["approved", "rejected"],
    withdrawals: ["rejected"]
  };

  if (!expectedStatuses[name]) {
    throw new Error(
      "Invalid collection."
    );
  }

  if (!expectedStatuses[name].includes(
    newStatus
  )) {
    throw new Error(
      "এই Action অনুমোদিত নয়।"
    );
  }

  const reference = doc(
    db,
    name,
    id
  );

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
        and Deposit Rejection.
      */

      if (
        name !== "deposits" ||
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

      /*
        TEST DEPOSIT APPROVAL.
        NO REAL BALANCE CREDIT.
      */

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
          "User UID পাওয়া যায়নি।"
        );
      }

      const accessReference = doc(
        db,
        "userAccess",
        data.uid
      );

      /*
        Read all documents before writes.
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

      /*
        Approve deposit status.
      */

      transaction.update(
        reference,
        {
          status: "approved"
        }
      );

      /*
        Create lifetime access once.
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

    if (!settings[name]) return;

    if (![
      "approve",
      "reject"
    ].includes(action)) {
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
      setMessage(
        "Testing Mode-এ Withdrawal Approval বন্ধ।",
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
      name === "deposits" &&
      action === "approve"
    ) {
      confirmationText =
        "TEST DEPOSIT APPROVAL\n\n" +
        "Approve করলে Lifetime Work Access " +
        "চালু হতে পারে।\n\n" +
        "কোনো বাস্তব টাকা বা Balance " +
        "যোগ হবে না।\n\n" +
        "আপনি কি নিশ্চিত?";
    }

    if (
      name === "tasks" &&
      action === "approve"
    ) {
      confirmationText =
        "Task Approve করবেন?\n\n" +
        "Testing Mode-এ Worker Balance " +
        "পরিবর্তন হবে না।";
    }

    if (!window.confirm(
      confirmationText
    )) {
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

      setMessage(
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
      console.error(
        "Admin action error:",
        error
      );

      setMessage(
        "সমস্যা হয়েছে: " +
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
   INITIALIZE
========================================== */

createHistoryFilters();
showLogin();
resetData();

console.log(
  "Micro Job Admin Panel - Google + Email Login - TESTING MODE"
);
