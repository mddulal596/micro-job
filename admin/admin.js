import { auth, db } from "../firebase-config.js";

import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";

import {
  collection,
  doc,
  getDocs,
  query,
  limit,
  updateDoc
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

const $ = (id) => document.getElementById(id);

let activePageId = null;

const pageMap = {
  usersPage: { collectionName: "users", containerId: "usersList" },
  jobsPage: { collectionName: "jobs", containerId: "jobsList" },
  tasksPage: { collectionName: "tasks", containerId: "tasksList" },
  depositsPage: { collectionName: "deposits", containerId: "depositsList" },
  withdrawalsPage: { collectionName: "withdrawals", containerId: "withdrawalsList" }
};

function safe(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[c]);
}

function show(id) {
  $(id).classList.remove("hidden");
}

function hide(id) {
  $(id).classList.add("hidden");
}

function denyAccess() {
  hide("loading");
  hide("adminApp");
  show("accessDenied");
}

async function loadDashboard() {
  try {
    const [usersSnap, jobsSnap, tasksSnap] = await Promise.all([
      getDocs(query(collection(db, "users"), limit(100))),
      getDocs(query(collection(db, "jobs"), limit(100))),
      getDocs(query(collection(db, "tasks"), limit(100)))
    ]);

    const users = usersSnap.docs.map((d) => d.data());
    const jobs = jobsSnap.docs.map((d) => d.data());
    const tasks = tasksSnap.docs.map((d) => d.data());

    $("totalUsers").textContent = users.length;
    $("totalJobs").textContent = jobs.length;
    $("pendingJobs").textContent = jobs.filter((job) => job.status === "pending").length;
    $("pendingTasks").textContent = tasks.filter((task) => task.status === "pending").length;
  } catch (error) {
    console.error(error);
  }
}

function getApproveStatus(collectionName) {
  if (collectionName === "jobs") return "active";
  if (collectionName === "tasks") return "approved";
  if (collectionName === "deposits") return "approved";
  if (collectionName === "withdrawals") return "approved";
  return "approved";
}

function actionButtons(collectionName, docId, currentStatus) {
  if (collectionName === "users") return "";
  if (currentStatus !== "pending") return "";

  const approveStatus = getApproveStatus(collectionName);

  return `
    <div class="action-row">
      <button class="action-btn approve" data-action="approve" data-collection="${collectionName}" data-id="${docId}" data-status="${approveStatus}">
        Approve
      </button>
      <button class="action-btn reject" data-action="reject" data-collection="${collectionName}" data-id="${docId}" data-status="rejected">
        Reject
      </button>
    </div>
  `;
}

async function changeStatus(collectionName, docId, newStatus) {
  try {
    await updateDoc(doc(db, collectionName, docId), {
      status: newStatus
    });

    alert(`Updated successfully: ${newStatus}`);

    await loadDashboard();

    if (activePageId && pageMap[activePageId]) {
      const meta = pageMap[activePageId];
      await loadCollection(meta.collectionName, meta.containerId);
    }
  } catch (error) {
    console.error(error);
    alert("Status update failed: " + error.message);
  }
}

async function loadCollection(collectionName, containerId) {
  const container = $(containerId);
  container.textContent = "Loading...";

  try {
    const snap = await getDocs(
      query(collection(db, collectionName), limit(100))
    );

    container.replaceChildren();

    if (snap.empty) {
      container.textContent = "No records found.";
      return;
    }

    snap.forEach((documentSnapshot) => {
      const data = documentSnapshot.data();
      const id = documentSnapshot.id;
      const status = data.status || "unknown";

      const card = document.createElement("div");
      card.className = "item-card";

      let html = "";

      if (collectionName === "users") {
        html = `
          <h4>${safe(data.name || "User")}</h4>
          <p>Email: ${safe(data.email || "-")}</p>
          <p>Phone: ${safe(data.phone || "-")}</p>
          <p>Balance: ৳${Number(data.balance || 0).toFixed(2)}</p>
          <p>Role: ${safe(data.role || "user")}</p>
          <p>Referral Code: ${safe(data.referral_code || "-")}</p>
        `;
      }

      if (collectionName === "jobs") {
        html = `
          <h4>${safe(data.title || "Untitled Job")}</h4>
          <p>Category: ${safe(data.category || "-")}</p>
          <p>Payment: ৳${Number(data.payment || 0).toFixed(2)}</p>
          <p>Workers: ${safe(data.workers ?? "-")}</p>
          <p>Owner UID: ${safe(data.userId || "-")}</p>
          <span class="status ${safe(status)}">${safe(status)}</span>
          ${actionButtons(collectionName, id, status)}
        `;
      }

      if (collectionName === "tasks") {
        html = `
          <h4>Task Submission</h4>
          <p>Job ID: ${safe(data.jobId || "-")}</p>
          <p>User ID: ${safe(data.userId || "-")}</p>
          <p>Proof: <a href="${safe(data.proof || "#")}" target="_blank" rel="noopener noreferrer">Open Proof</a></p>
          <p>Message: ${safe(data.message || "-")}</p>
          <span class="status ${safe(status)}">${safe(status)}</span>
          ${actionButtons(collectionName, id, status)}
        `;
      }

      if (collectionName === "deposits") {
        html = `
          <h4>Deposit Request</h4>
          <p>User ID: ${safe(data.userId || "-")}</p>
          <p>Method: ${safe(data.method || "-")}</p>
          <p>Amount: ৳${Number(data.amount || 0).toFixed(2)}</p>
          <p>TRX ID: ${safe(data.trxId || "-")}</p>
          <span class="status ${safe(status)}">${safe(status)}</span>
          ${actionButtons(collectionName, id, status)}
        `;
      }

      if (collectionName === "withdrawals") {
        html = `
          <h4>Withdrawal Request</h4>
          <p>User ID: ${safe(data.userId || "-")}</p>
          <p>Method: ${safe(data.method || "-")}</p>
          <p>Account Number: ${safe(data.accountNumber || "-")}</p>
          <p>Amount: ৳${Number(data.amount || 0).toFixed(2)}</p>
          <span class="status ${safe(status)}">${safe(status)}</span>
          ${actionButtons(collectionName, id, status)}
        `;
      }

      card.innerHTML = html;
      container.appendChild(card);
    });

    container.querySelectorAll("[data-action]").forEach((button) => {
      button.addEventListener("click", async () => {
        const collectionName = button.dataset.collection;
        const id = button.dataset.id;
        const status = button.dataset.status;
        button.disabled = true;
        await changeStatus(collectionName, id, status);
      });
    });
  } catch (error) {
    console.error(error);
    container.textContent = "Unable to load records: " + error.message;
  }
}

document.querySelectorAll(".menu-grid button").forEach((button) => {
  button.addEventListener("click", async () => {
    document.querySelectorAll(".admin-page").forEach((page) => {
      page.classList.add("hidden");
    });

    activePageId = button.dataset.page;
    $(activePageId).classList.remove("hidden");

    const meta = pageMap[activePageId];
    if (meta) {
      await loadCollection(meta.collectionName, meta.containerId);
    }
  });
});

$("logoutBtn").addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "../index.html";
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    denyAccess();
    return;
  }

  try {
    const token = await user.getIdTokenResult(true);

    if (token.claims.admin !== true) {
      denyAccess();
      return;
    }

    hide("loading");
    hide("accessDenied");
    show("adminApp");

    await loadDashboard();
  } catch (error) {
    console.error(error);
    denyAccess();
  }
});
