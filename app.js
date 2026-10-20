import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";

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

import {
  firebaseConfig
} from "./firebase-config.js";

/* FIREBASE */

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const $ = id => document.getElementById(id);

/* SETTINGS */

const MIN_DEPOSIT = 300;
const MIN_WITHDRAW = 5000;
const MAX_JOB_REWARD = 5000;
const MAX_WORKERS = 1000;

/* STATE */

let currentUser = null;
let currentProfile = null;

let isAdmin = false;
let workEnabled = false;
let accessLoaded = false;

let activeJobs = [];
let myJobs = [];
let myTasks = [];
let deposits = [];
let withdrawals = [];

let listeners = [];
let authVersion = 0;

/* HELPERS */

function escapeHtml(value = "") {
  return String(value).replace(
    /[&<>"']/g,
    c => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[c])
  );
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

  return date
    ? date.toLocaleString("bn-BD")
    : "—";
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

  box.textContent = text;
  box.className = "message " + type;
}

function clearAuthMessage() {
  $("authMessage").className = "message hidden";
}

function chip(status) {
  const safe = escapeHtml(status || "pending");

  return `<span class="chip ${safe}">${safe}</span>`;
}

function sortDocs(snapshot) {
  return snapshot.docs
    .map(d => ({
      id: d.id,
      ...d.data()
    }))
    .sort((a, b) =>
      (b.createdAt?.seconds || 0) -
      (a.createdAt?.seconds || 0)
    );
}

function mainBalance() {
  return Number(currentProfile?.mainBalance || 0);
}

function depositBalance() {
  return Number(currentProfile?.depositBalance || 0);
}

/* NAVIGATION */

const panels = [
  "dashboard",
  "jobs",
  "post",
  "tasks",
  "wallet",
  "deposit",
  "withdraw",
  "profile"
];

const lockedPanels = [
  "jobs",
  "post",
  "tasks"
];

function showPanel(name) {
  if (!panels.includes(name)) return;

  if (lockedPanels.includes(name) && !workEnabled) {
    showMessage(
      "কাজ শুরু করতে প্রথমে কমপক্ষে ৳300-এর পরীক্ষামূলক Deposit Request অনুমোদিত হতে হবে।",
      "error"
    );

    return;
  }

  panels.forEach(panel => {
    const element = $(panel + "Panel");

    if (element) {
      element.classList.toggle(
        "active",
        panel === name
      );
    }
  });

  const navName = (
    name === "deposit" ||
    name === "withdraw"
  ) ? "wallet" : name;

  document.querySelectorAll(".nav-btn")
    .forEach(button => {
      button.classList.toggle(
        "active",
        button.dataset.go === navName
      );
    });

  clearMessage();

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

document.addEventListener("click", event => {
  const button = event.target.closest("[data-go]");

  if (!button) return;

  // Prevent locked navigation even if someone
  // removes the disabled attribute.
  showPanel(button.dataset.go);
});

/* WORK ACCESS */

function updateWorkAccess() {
  document.querySelectorAll(
    "[data-work-required='true']"
  ).forEach(button => {
    button.disabled = !workEnabled;
  });

  const card = $("activationCard");
  const icon = $("activationIcon");

  card.classList.toggle("active", workEnabled);
  card.classList.toggle("locked", !workEnabled);

  if (workEnabled) {
    icon.className = "fa-solid fa-circle-check";

    $("activationTitle").textContent =
      "Lifetime Account Activated";

    $("activationDescription").textContent =
      "আপনার অ্যাকাউন্ট পরীক্ষামূলকভাবে সক্রিয়। Jobs এবং Tasks ব্যবহার করতে পারবেন।";

    $("profileActivationStatus").textContent =
      "Activation: Lifetime Active";

  } else {
    icon.className = "fa-solid fa-lock";

    $("activationTitle").textContent =
      accessLoaded
        ? "Account Not Activated"
        : "Checking Account Activation...";

    $("activationDescription").textContent =
      accessLoaded
        ? "কাজ শুরু করতে কমপক্ষে ৳300-এর Test Deposit Request করুন। Admin Approval-এর পর Lifetime Access চালু হবে। বাস্তব টাকা পাঠাবেন না।"
        : "আপনার অ্যাকাউন্ট যাচাই করা হচ্ছে।";

    $("profileActivationStatus").textContent =
      "Activation: Locked";

    if (
      lockedPanels.some(
        name => $(name + "Panel")?.classList.contains("active")
      )
    ) {
      showPanel("dashboard");
    }
  }
}

/* AUTH SWITCH */

$("showRegister").addEventListener("click", e => {
  e.preventDefault();

  $("loginBox").classList.add("hidden");
  $("registerBox").classList.remove("hidden");

  clearAuthMessage();
});

$("showLogin").addEventListener("click", e => {
  e.preventDefault();

  $("registerBox").classList.add("hidden");
  $("loginBox").classList.remove("hidden");

  clearAuthMessage();
});

/* LOGIN */

$("loginForm").addEventListener("submit", async e => {
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
    showAuthMessage(
      "Login failed: " + error.message
    );
  }
});

/* REGISTER */

$("registerForm").addEventListener("submit", async e => {
  e.preventDefault();

  clearAuthMessage();

  const name = $("regName").value.trim();
  const email = $("regEmail").value.trim();
  const password = $("regPassword").value;

  if (!name || password.length < 6) {
    showAuthMessage(
      "নাম এবং কমপক্ষে ৬ অক্ষরের পাসওয়ার্ড দিন।"
    );

    return;
  }

  try {
    const result = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );

    await updateProfile(result.user, {
      displayName: name
    });

    await setDoc(
      doc(db, "users", result.user.uid),
      {
        uid: result.user.uid,
        name,
        email,
        balance: 0,
        createdAt: serverTimestamp()
      }
    );

    $("registerForm").reset();

  } catch (error) {
    showAuthMessage(
      "Registration failed: " + error.message
    );
  }
});

/* LOGOUT */

$("logoutBtn").addEventListener("click", async () => {
  try {
    await signOut(auth);

  } catch (error) {
    showMessage(error.message, "error");
  }
});

/* PROFILE */

$("profileForm").addEventListener("submit", async e => {
  e.preventDefault();

  if (!currentUser) return;

  const name = $("profileName").value.trim();

  if (!name) {
    showMessage("নাম লিখুন।", "error");
    return;
  }

  try {
    await updateProfile(auth.currentUser, {
      displayName: name
    });

    await updateDoc(
      doc(db, "users", currentUser.uid),
      { name }
    );

    showMessage("Profile updated successfully.");

  } catch (error) {
    showMessage(error.message, "error");
  }
});

/* JOB COST CALCULATOR */

function calculateJobCost() {
  const reward = Number($("jobReward").value);
  const workers = Number($("jobWorkers").value);

  const valid =
    Number.isFinite(reward) &&
    Number.isInteger(workers) &&
    reward >= 1 &&
    reward <= MAX_JOB_REWARD &&
    workers >= 1 &&
    workers <= MAX_WORKERS;

  const total = valid
    ? Math.round(reward * workers * 100) / 100
    : 0;

  $("jobTotalCost").textContent = money(total);

  const source = $("jobPayFrom").value;

  const available = source === "deposit"
    ? depositBalance()
    : mainBalance();

  $("jobBalanceHint").textContent =
    `Selected Balance: ${money(available)}। Testing Mode: কোনো টাকা কাটা হবে না।`;

  return {
    reward,
    workers,
    total,
    valid
  };
}

["jobReward", "jobWorkers", "jobPayFrom"]
  .forEach(id => {
    $(id).addEventListener(
      "input",
      calculateJobCost
    );
  });

/* POST JOB */

$("jobForm").addEventListener("submit", async e => {
  e.preventDefault();

  if (!currentUser || !workEnabled) {
    showMessage(
      "আপনার Account Active নয়।",
      "error"
    );

    return;
  }

  const title = $("jobTitle").value.trim();
  const description = $("jobDescription").value.trim();

  const cost = calculateJobCost();

  if (
    !title ||
    !description ||
    !cost.valid ||
    cost.total <= 0
  ) {
    showMessage(
      "সঠিক Job তথ্য দিন।",
      "error"
    );

    return;
  }

  if (
    !confirm(
      `Test Job Cost: ${money(cost.total)}\n\nTesting Mode-এ কোনো Balance কাটা হবে না। Job Submit করবেন?`
    )
  ) return;

  try {
    // Financial fields are intentionally not written.
    // Secure job funding is not implemented yet.
    await addDoc(collection(db, "jobs"), {
      title,
      description,
      reward: cost.reward,
      createdBy: currentUser.uid,
      creatorName: nameText(),
      creatorEmail: currentUser.email || "",
      status: "pending",
      createdAt: serverTimestamp()
    });

    $("jobForm").reset();
    calculateJobCost();

    showMessage(
      "Test Job submitted. Admin approval pending."
    );

  } catch (error) {
    showMessage(error.message, "error");
  }
});

/* TASK SUBMIT */

$("taskForm").addEventListener("submit", async e => {
  e.preventDefault();

  if (!currentUser || !workEnabled) {
    showMessage(
      "Account Activation Required.",
      "error"
    );

    return;
  }

  const jobId = $("taskJobSelect").value;
  const proof = $("taskProof").value.trim();

  const job = activeJobs.find(
    item => item.id === jobId
  );

  if (!job || !proof) {
    showMessage(
      "Job এবং Proof সঠিকভাবে দিন।",
      "error"
    );

    return;
  }

  if (job.createdBy === currentUser.uid) {
    showMessage(
      "নিজের Job-এ Task Submit করা যাবে না।",
      "error"
    );

    return;
  }

  if (myTasks.some(task => task.jobId === jobId)) {
    showMessage(
      "এই Job-এ ইতিমধ্যে Task জমা দিয়েছেন।",
      "error"
    );

    return;
  }

  try {
    // Deterministic ID prevents duplicate submissions
    // when paired with the Part 3 security rules.
    const taskId = `${jobId}_${currentUser.uid}`;

    await setDoc(
      doc(db, "tasks", taskId),
      {
        jobId: job.id,
        jobTitle: job.title,
        jobOwnerUid: job.createdBy,
        jobOwnerName: job.creatorName || "",
        submittedBy: currentUser.uid,
        submittedByName: nameText(),
        proof,
        status: "pending",
        createdAt: serverTimestamp()
      }
    );

    $("taskForm").reset();

    showMessage(
      "Test Task submitted successfully."
    );

  } catch (error) {
    showMessage(error.message, "error");
  }
});

/* DEPOSIT REQUEST */

$("depositForm").addEventListener("submit", async e => {
  e.preventDefault();

  if (!currentUser) return;

  const amount = Number($("depositAmount").value);
  const transactionId = $("depositTxn").value.trim();

  if (
    !Number.isFinite(amount) ||
    amount < MIN_DEPOSIT
  ) {
    showMessage(
      "Minimum Deposit ৳300।",
      "error"
    );

    return;
  }

  if (!transactionId) {
    showMessage(
      "Test Transaction ID লিখুন।",
      "error"
    );

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

    showPanel("wallet");

    showMessage(
      "Test Deposit Request জমা হয়েছে। Admin Approval-এর জন্য অপেক্ষা করুন।"
    );

  } catch (error) {
    showMessage(error.message, "error");
  }
});

/* WITHDRAW REQUEST */

$("withdrawForm").addEventListener("submit", async e => {
  e.preventDefault();

  if (!currentUser) return;

  const amount = Number($("withdrawAmount").value);
  const accountNumber = $("withdrawAccount").value.trim();

  if (
    !Number.isFinite(amount) ||
    amount < MIN_WITHDRAW
  ) {
    showMessage(
      "Minimum Withdraw ৳5000।",
      "error"
    );

    return;
  }

  if (mainBalance() < amount) {
    showMessage(
      "পর্যাপ্ত Main Balance নেই।",
      "error"
    );

    return;
  }

  if (!accountNumber) {
    showMessage(
      "Account Number লিখুন।",
      "error"
    );

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

    showPanel("wallet");

    showMessage(
      "Test Withdrawal Request submitted."
    );

  } catch (error) {
    showMessage(error.message, "error");
  }
});

/* DASHBOARD */

function renderDashboard() {
  const main = money(mainBalance());
  const deposit = money(depositBalance());

  $("headerBalance").textContent = main;

  $("balanceAmount").textContent = main;
  $("mainBalanceAmount").textContent = main;
  $("depositBalanceAmount").textContent = deposit;

  $("walletBalance").textContent = main;
  $("walletMainBalance").textContent = main;
  $("walletDepositBalance").textContent = deposit;

  $("profileBalance").textContent = main;
  $("profileDepositBalance").textContent = deposit;

  $("welcomeText").textContent =
    "Welcome, " + nameText() + " 👋";

  $("profileDisplayName").textContent = nameText();

  $("profileEmail").textContent =
    currentUser?.email || "—";

  if (document.activeElement !== $("profileName")) {
    $("profileName").value = nameText();
  }

  $("completedJobsCount").textContent =
    myTasks.filter(
      task => task.status === "approved"
    ).length;

  $("pendingJobsCount").textContent =
    myTasks.filter(
      task => task.status === "pending"
    ).length;

  $("referralsCount").textContent = "0";

  calculateJobCost();

  updateWorkAccess();
}

/* JOB CARD */

function jobCard(job) {
  const ownJob =
    job.createdBy === currentUser?.uid;

  const submitted = myTasks.some(
    task => task.jobId === job.id
  );

  return `
    <article class="job-card">

      ${chip(job.status)}

      <h3>${escapeHtml(job.title)}</h3>

      <p>${escapeHtml(job.description || "")}</p>

      <div class="job-meta">
        <span>
          <i class="fa-solid fa-user"></i>
          ${escapeHtml(job.creatorName || "User")}
        </span>

        <span class="job-price">
          ${money(job.reward)}
        </span>
      </div>

      ${
        ownJob
          ? `<p class="muted">Your Job</p>`
          : submitted
            ? `<p class="muted">Already Submitted</p>`
            : `
              <button
                class="btn-primary"
                type="button"
                data-task-job="${escapeHtml(job.id)}">
                Submit Task
              </button>
            `
      }

    </article>
  `;
}

/* RENDER JOBS */

function renderJobs() {
  if (!workEnabled) {
    const html = `
      <div class="empty">
        কাজ দেখতে আগে Account Activate করুন।
      </div>
    `;

    $("homeJobsList").innerHTML = html;
    $("activeJobsList").innerHTML = html;

    return;
  }

  const available = activeJobs.filter(
    job => job.createdBy !== currentUser?.uid
  );

  const html = available.length
    ? available.map(jobCard).join("")
    : `<div class="empty">No jobs available.</div>`;

  $("homeJobsList").innerHTML = html;
  $("activeJobsList").innerHTML = html;

  const select = $("taskJobSelect");
  const previous = select.value;

  select.innerHTML = `
    <option value="">Select Job</option>

    ${available.map(job => `
      <option value="${escapeHtml(job.id)}">
        ${escapeHtml(job.title)}
        - ${money(job.reward)}
      </option>
    `).join("")}
  `;

  if (available.some(job => job.id === previous)) {
    select.value = previous;
  }

  $("myJobsList").innerHTML = myJobs.length
    ? myJobs.map(job => `
      <article class="item-card">

        <div class="item-top">
          <h4>${escapeHtml(job.title)}</h4>
          ${chip(job.status)}
        </div>

        <div class="item-body">
          <p>${escapeHtml(job.description || "")}</p>
        </div>

        <div class="meta">
          Reward: ${money(job.reward)}
        </div>

      </article>
    `).join("")
    : `<div class="empty">No posted jobs.</div>`;
}

/* JOB BUTTON */

document.addEventListener("click", event => {
  const button = event.target.closest(
    "[data-task-job]"
  );

  if (!button || !workEnabled) return;

  showPanel("tasks");

  $("taskJobSelect").value =
    button.dataset.taskJob;
});

/* RENDER TASKS */

function renderTasks() {
  $("myTasksList").innerHTML = myTasks.length
    ? myTasks.map(task => `
      <article class="item-card">

        <div class="item-top">
          <h4>${escapeHtml(task.jobTitle)}</h4>
          ${chip(task.status)}
        </div>

        <p>${escapeHtml(task.proof || "")}</p>

        <div class="meta">
          ${dateText(task.createdAt)}
        </div>

      </article>
    `).join("")
    : `<div class="empty">No tasks submitted.</div>`;
}

/* RENDER WALLET */

function renderWallet() {
  $("depositHistoryList").innerHTML =
    deposits.length
      ? deposits.map(item => `
        <article class="item-card">

          <div class="item-top">
            <h4>${escapeHtml(item.method)} Deposit</h4>
            ${chip(item.status)}
          </div>

          <p>Amount: ${money(item.amount)}</p>

          <p>
            Test Transaction:
            ${escapeHtml(item.transactionId)}
          </p>

          <div class="meta">
            ${dateText(item.createdAt)}
          </div>

        </article>
      `).join("")
      : `<div class="empty">No deposits.</div>`;

  $("withdrawHistoryList").innerHTML =
    withdrawals.length
      ? withdrawals.map(item => `
        <article class="item-card">

          <div class="item-top">
            <h4>${escapeHtml(item.method)} Withdraw</h4>
            ${chip(item.status)}
          </div>

          <p>Amount: ${money(item.amount)}</p>

          <p>
            Account:
            ${escapeHtml(item.accountNumber)}
          </p>

        </article>
      `).join("")
      : `<div class="empty">No withdrawals.</div>`;
}

/* RENDER ALL */

function renderAll() {
  if (!currentUser) return;

  renderDashboard();
  renderJobs();
  renderTasks();
  renderWallet();
}

/* FIRESTORE LISTENERS */

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

function listen(name, field, value, callback) {
  const q = query(
    collection(db, name),
    where(field, "==", value)
  );

  const unsubscribe = onSnapshot(
    q,
    snapshot => {
      callback(sortDocs(snapshot));
      renderAll();
    },
    error => {
      showMessage(
        name + ": " + error.message,
        "error"
      );
    }
  );

  listeners.push(unsubscribe);
}

function startListeners(uid) {

  /* PROFILE */

  listeners.push(
    onSnapshot(
      doc(db, "users", uid),
      snapshot => {
        if (snapshot.exists()) {
          currentProfile = snapshot.data();
          renderAll();
        }
      },
      error => {
        showMessage(error.message, "error");
      }
    )
  );

  /* LIFETIME ACTIVATION */

  listeners.push(
    onSnapshot(
      doc(db, "userAccess", uid),
      snapshot => {
        accessLoaded = true;

        workEnabled =
          snapshot.exists() &&
          snapshot.data().workEnabled === true;

        updateWorkAccess();
        renderAll();
      },
      error => {
        accessLoaded = true;
        workEnabled = false;

        updateWorkAccess();

        showMessage(
          "Activation check failed: " + error.message,
          "error"
        );
      }
    )
  );

  /* JOBS */

  listen(
    "jobs",
    "status",
    "active",
    data => {
      activeJobs = data;
    }
  );

  listen(
    "jobs",
    "createdBy",
    uid,
    data => {
      myJobs = data;
    }
  );

  /* TASKS */

  listen(
    "tasks",
    "submittedBy",
    uid,
    data => {
      myTasks = data;
    }
  );

  /* DEPOSITS */

  listen(
    "deposits",
    "uid",
    uid,
    data => {
      deposits = data;
    }
  );

  /* WITHDRAWALS */

  listen(
    "withdrawals",
    "uid",
    uid,
    data => {
      withdrawals = data;
    }
  );
}

/* USER PROFILE */

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

/* AUTH STATE */

onAuthStateChanged(auth, async user => {
  const version = ++authVersion;

  stopListeners();

  currentUser = user;
  currentProfile = null;

  isAdmin = false;
  workEnabled = false;
  accessLoaded = false;

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

    return;
  }

  try {
    await ensureUserProfile(user);
  } catch (error) {
    console.error(error);
  }

  if (version !== authVersion) return;

  try {
    const token = await getIdTokenResult(
      user,
      true
    );

    isAdmin = token.claims.admin === true;

  } catch (error) {
    console.error(error);
  }

  if (version !== authVersion) return;

  $("adminLink").classList.toggle(
    "hidden",
    !isAdmin
  );

  $("authView").classList.add("hidden");
  $("appView").classList.remove("hidden");

  showPanel("dashboard");

  startListeners(user.uid);

  renderAll();
});
