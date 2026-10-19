import { auth, db } from "./firebase-config.js";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

const $ = id => document.getElementById(id);

let currentUser = null;
let userData = null;
let availableJobs = [];

const money = value =>
  Number(value || 0).toFixed(2);

const safe = value =>
  String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[c]);

const showError = error => {
  console.error(error);
  alert(error.message || "Something went wrong.");
};

const show = id => $(id).classList.remove("hidden");
const hide = id => $(id).classList.add("hidden");

// NAVIGATION

function navigate(pageId) {

  document.querySelectorAll(".page").forEach(page => {
    page.classList.add("hidden");
  });

  show(pageId);

  document.querySelectorAll(".bottom-nav button")
    .forEach(button => {

      button.classList.toggle(
        "active",
        button.dataset.page === pageId
      );

    });

  window.scrollTo(0, 0);

  if (pageId === "jobsPage") loadJobs();
  if (pageId === "homePage") loadJobs();
  if (pageId === "postJobPage") loadMyJobs();
  if (pageId === "tasksPage") loadMyTasks();
  if (pageId === "walletPage") loadTransactions();
}

document.querySelectorAll("[data-page]").forEach(button => {
  button.addEventListener("click", () => {
    navigate(button.dataset.page);
  });
});

// AUTH FORMS

$("showRegister").onclick = e => {
  e.preventDefault();
  hide("loginForm");
  show("registerForm");
};

$("showLogin").onclick = e => {
  e.preventDefault();
  hide("registerForm");
  show("loginForm");
};

// REGISTRATION

$("register").addEventListener("submit", async e => {

  e.preventDefault();

  const name = $("regName").value.trim();
  const email = $("regEmail").value.trim();
  const phone = $("regPhone").value.trim();
  const password = $("regPassword").value;

  if (name.length < 3) {
    alert("Name must have at least 3 characters.");
    return;
  }

  if (!/^01[3-9]\d{8}$/.test(phone)) {
    alert("Enter a valid Bangladesh phone number.");
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

    await setDoc(doc(db, "users", result.user.uid), {
      name,
      email,
      phone,
      balance: 0,
      role: "user",
      createdAt: serverTimestamp()
    });

    alert("Registration Successful!");

  } catch (error) {
    showError(error);
  }

});

// LOGIN

$("login").addEventListener("submit", async e => {

  e.preventDefault();

  try {

    await signInWithEmailAndPassword(
      auth,
      $("loginEmail").value.trim(),
      $("loginPassword").value
    );

  } catch (error) {
    showError(error);
  }

});

// LOGOUT

async function logout() {
  try {
    await signOut(auth);
  } catch (error) {
    showError(error);
  }
}

$("logoutBtn").onclick = logout;
$("profileLogout").onclick = logout;

// AUTH STATE

onAuthStateChanged(auth, async user => {

  hide("loading");

  if (!user) {

    currentUser = null;
    userData = null;

    hide("dashboard");
    show("authSection");

    return;
  }

  currentUser = user;

  try {

    const snap = await getDoc(
      doc(db, "users", user.uid)
    );

    if (!snap.exists()) {
      throw new Error(
        "User profile missing. Please contact support."
      );
    }

    userData = snap.data();

    updateDashboard();

    hide("authSection");
    show("dashboard");

    navigate("homePage");

    loadMyTasks();

  } catch (error) {

    showError(error);

    hide("dashboard");
    show("authSection");

  }

});

// DASHBOARD

function updateDashboard() {

  const name =
    userData.name ||
    currentUser.displayName ||
    "User";

  const balance = money(userData.balance);

  $("userName").textContent = name;

  $("userBalance").textContent = balance;
  $("walletBalance").textContent = balance;
  $("headerBalance").textContent = balance;

  $("profileName").textContent = name;
  $("profileEmail").textContent = currentUser.email;

  $("infoName").textContent = name;
  $("infoEmail").textContent = currentUser.email;
  $("infoPhone").textContent = userData.phone || "";

  $("referralCode").textContent =
    currentUser.uid.substring(0, 8).toUpperCase();

  $("totalReferrals").textContent = "0";
}

// JOB CARD

function jobCard(job) {

  const card = document.createElement("div");

  card.className = "job-card";

  const remaining =
    Math.max(0, job.workers - (job.completed || 0));

  card.innerHTML = `
    <h3>${safe(job.title)}</h3>

    <span class="badge active">
      ${safe(job.category)}
    </span>

    <p>${safe(job.description).slice(0, 250)}</p>

    <div class="job-meta">
      <span>
        <i class="fas fa-users"></i>
        ${remaining} Slots
      </span>

      <span class="job-price">
        ৳ ${money(job.payment)}
      </span>
    </div>

    <button class="btn-primary">
      View & Submit
    </button>
  `;

  card.querySelector("button").onclick = () => {
    openTaskModal(job);
  };

  return card;
}

// LOAD JOBS

async function loadJobs() {

  const list = $("jobsList");
  const home = $("homeJobs");

  list.textContent = "Loading jobs...";
  home.textContent = "Loading jobs...";

  try {

    const q = query(
      collection(db, "jobs"),
      where("status", "==", "active"),
      limit(50)
    );

    const snapshot = await getDocs(q);

    availableJobs = snapshot.docs.map(d => ({
      id: d.id,
      ...d.data()
    })).filter(job => {
      return (
        job.userId !== currentUser.uid &&
        job.workers > (job.completed || 0)
      );
    });

    renderJobs();

  } catch (error) {

    console.error(error);

    list.textContent = "Unable to load jobs.";
    home.textContent = "Unable to load jobs.";

  }

}

function renderJobs() {

  const search = $("jobSearch").value.toLowerCase();

  const filtered = availableJobs.filter(job =>
    job.title.toLowerCase().includes(search)
  );

  $("jobsList").replaceChildren();
  $("homeJobs").replaceChildren();

  if (!filtered.length) {

    $("jobsList").textContent = "No jobs available.";
    $("homeJobs").textContent = "No jobs available.";

    return;
  }

  filtered.forEach(job => {
    $("jobsList").appendChild(jobCard(job));
  });

  filtered.slice(0, 4).forEach(job => {
    $("homeJobs").appendChild(jobCard(job));
  });

}

$("jobSearch").addEventListener("input", renderJobs);

// POST JOB

$("postJobForm").addEventListener("submit", async e => {

  e.preventDefault();

  const title = $("jobTitle").value.trim();
  const description = $("jobDescription").value.trim();
  const category = $("jobCategory").value;

  const payment = Number($("jobPayment").value);
  const workers = Number($("jobWorkers").value);

  if (
    title.length < 5 ||
    description.length < 20 ||
    !Number.isFinite(payment) ||
    payment < 1 ||
    payment > 100000 ||
    !Number.isInteger(workers) ||
    workers < 1 ||
    workers > 10000
  ) {
    alert("Please enter valid job details.");
    return;
  }

  try {

    await addDoc(collection(db, "jobs"), {

      userId: currentUser.uid,
      title,
      description,
      category,
      payment,
      workers,
      completed: 0,
      status: "pending",
      createdAt: serverTimestamp()

    });

    alert("Job submitted for review!");

    $("postJobForm").reset();

    await loadMyJobs();

  } catch (error) {
    showError(error);
  }

});

// MY POSTED JOBS

async function loadMyJobs() {

  const container = $("myPostedJobs");

  container.textContent = "Loading...";

  try {

    const q = query(
      collection(db, "jobs"),
      where("userId", "==", currentUser.uid),
      limit(50)
    );

    const snapshot = await getDocs(q);

    container.replaceChildren();

    if (snapshot.empty) {
      container.textContent = "No posted jobs.";
      return;
    }

    snapshot.forEach(d => {

      const job = d.data();

      const card = document.createElement("div");
      card.className = "card";

      card.innerHTML = `
        <h3>${safe(job.title)}</h3>
        <p>Payment: ৳${money(job.payment)}</p>
        <p>Workers: ${Number(job.workers)}</p>
        <span class="badge ${safe(job.status)}">
          ${safe(job.status)}
        </span>
      `;

      container.appendChild(card);

    });

  } catch (error) {
    showError(error);
  }

}

// TASK MODAL

function openTaskModal(job) {

  $("taskJobId").value = job.id;
  $("taskJobTitle").textContent = job.title;
  $("taskJobDescription").textContent = job.description;

  show("taskModal");

}

$("closeTaskModal").onclick = () => {
  hide("taskModal");
};

$("taskModal").addEventListener("click", e => {
  if (e.target === $("taskModal")) {
    hide("taskModal");
  }
});

// SUBMIT TASK

$("submitTaskForm").addEventListener("submit", async e => {

  e.preventDefault();

  const jobId = $("taskJobId").value;
  const proof = $("taskProof").value.trim();
  const message = $("taskMessage").value.trim();

  try {

    const jobSnap = await getDoc(
      doc(db, "jobs", jobId)
    );

    if (!jobSnap.exists()) {
      throw new Error("Job not found.");
    }

    const job = jobSnap.data();

    if (
      job.status !== "active" ||
      job.userId === currentUser.uid
    ) {
      throw new Error("This job is not available.");
    }

    const taskId = `${jobId}_${currentUser.uid}`;

    await setDoc(doc(db, "tasks", taskId), {

      jobId,
      userId: currentUser.uid,
      proof,
      message,
      status: "pending",
      createdAt: serverTimestamp()

    });

    alert("Task submitted successfully!");

    $("submitTaskForm").reset();

    hide("taskModal");

    navigate("tasksPage");

  } catch (error) {
    showError(error);
  }

});

// MY TASKS

async function loadMyTasks() {

  const list = $("myTasksList");

  try {

    const q = query(
      collection(db, "tasks"),
      where("userId", "==", currentUser.uid),
      limit(100)
    );

    const snapshot = await getDocs(q);

    list.replaceChildren();

    let pending = 0;
    let approved = 0;

    if (snapshot.empty) {
      list.textContent = "You have not submitted any tasks.";
    }

    snapshot.forEach(d => {

      const task = d.data();

      if (task.status === "pending") pending++;
      if (task.status === "approved") approved++;

      const card = document.createElement("div");

      card.className = "card";

      card.innerHTML = `
        <h3>Task Submission</h3>
        <p>Job ID: ${safe(task.jobId)}</p>
        <span class="badge ${safe(task.status)}">
          ${safe(task.status)}
        </span>
      `;

      list.appendChild(card);

    });

    $("pendingJobs").textContent = pending;
    $("completedJobs").textContent = approved;

  } catch (error) {
    console.error(error);
    list.textContent = "Unable to load tasks.";
  }

}

// DEPOSIT REQUEST

$("depositForm").addEventListener("submit", async e => {

  e.preventDefault();

  const amount = Number($("depositAmount").value);

  if (
    !Number.isFinite(amount) ||
    amount < 50 ||
    amount > 100000
  ) {
    alert("Invalid deposit amount.");
    return;
  }

  try {

    await addDoc(collection(db, "deposits"), {

      userId: currentUser.uid,
      method: $("depositMethod").value,
      amount,
      trxId: $("depositTrx").value.trim(),
      status: "pending",
      createdAt: serverTimestamp()

    });

    alert("Deposit verification request submitted.");

    $("depositForm").reset();

    navigate("walletPage");

  } catch (error) {
    showError(error);
  }

});

// WITHDRAW REQUEST

$("withdrawForm").addEventListener("submit", async e => {

  e.preventDefault();

  const amount = Number($("withdrawAmount").value);
  const balance = Number(userData.balance || 0);
  const accountNumber = $("withdrawNumber").value.trim();

  if (!/^01[0-9]{9}$/.test(accountNumber)) {
    alert("Enter a valid account number.");
    return;
  }

  if (
    !Number.isFinite(amount) ||
    amount < 100 ||
    amount > 100000 ||
    amount > balance
  ) {
    alert("Invalid amount or insufficient balance.");
    return;
  }

  try {

    await addDoc(collection(db, "withdrawals"), {

      userId: currentUser.uid,
      method: $("withdrawMethod").value,
      accountNumber,
      amount,
      status: "pending",
      createdAt: serverTimestamp()

    });

    alert("Withdrawal request submitted for review.");

    $("withdrawForm").reset();

    navigate("walletPage");

  } catch (error) {
    showError(error);
  }

});

// TRANSACTION HISTORY

async function loadTransactions() {

  const list = $("transactionList");

  list.textContent = "Loading requests...";

  try {

    const depositQuery = query(
      collection(db, "deposits"),
      where("userId", "==", currentUser.uid),
      limit(50)
    );

    const withdrawQuery = query(
      collection(db, "withdrawals"),
      where("userId", "==", currentUser.uid),
      limit(50)
    );

    const [deposits, withdrawals] = await Promise.all([
      getDocs(depositQuery),
      getDocs(withdrawQuery)
    ]);

    const items = [];

    deposits.forEach(d => {
      items.push({
        type: "Deposit",
        ...d.data()
      });
    });

    withdrawals.forEach(d => {
      items.push({
        type: "Withdraw",
        ...d.data()
      });
    });

    items.sort((a, b) =>
      (b.createdAt?.seconds || 0) -
      (a.createdAt?.seconds || 0)
    );

    list.replaceChildren();

    if (!items.length) {
      list.textContent = "No payment requests yet.";
      return;
    }

    items.forEach(item => {

      const card = document.createElement("div");
      card.className = "card";

      card.innerHTML = `
        <h3>${safe(item.type)}</h3>
        <p>Amount: ৳${money(item.amount)}</p>
        <p>Method: ${safe(item.method)}</p>
        <span class="badge ${safe(item.status)}">
          ${safe(item.status)}
        </span>
      `;

      list.appendChild(card);

    });

  } catch (error) {
    showError(error);
  }

}

// COPY REFERRAL CODE

$("copyReferral").onclick = async () => {

  try {

    await navigator.clipboard.writeText(
      $("referralCode").textContent
    );

    alert("Referral code copied!");

  } catch (error) {
    showError(error);
  }

};
