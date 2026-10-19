import { auth, db } from "../firebase-config.js";

import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";

import {
  collection,
  getDocs,
  query,
  limit
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

const $ = id => document.getElementById(id);

function safe(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[c]);
}

function denyAccess() {
  $("loading").classList.add("hidden");
  $("adminApp").classList.add("hidden");
  $("accessDenied").classList.remove("hidden");
}

onAuthStateChanged(auth, async user => {

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

    $("loading").classList.add("hidden");
    $("adminApp").classList.remove("hidden");

    await loadDashboard();

  } catch (error) {
    console.error(error);
    denyAccess();
  }

});

$("logoutBtn").addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "../index.html";
});

document.querySelectorAll("[data-page]").forEach(button => {

  button.addEventListener("click", async () => {

    document.querySelectorAll(".admin-page").forEach(page => {
      page.classList.add("hidden");
    });

    const page = button.dataset.page;

    $(page).classList.remove("hidden");

    if (page === "usersPage") {
      await loadCollection("users", "usersList");
    }

    if (page === "jobsPage") {
      await loadCollection("jobs", "jobsList");
    }

    if (page === "tasksPage") {
      await loadCollection("tasks", "tasksList");
    }

    if (page === "depositsPage") {
      await loadCollection("deposits", "depositsList");
    }

    if (page === "withdrawalsPage") {
      await loadCollection("withdrawals", "withdrawalsList");
    }

  });

});

async function loadDashboard() {

  const collections = [
    "users",
    "jobs",
    "tasks"
  ];

  const results = {};

  for (const name of collections) {
    const snap = await getDocs(
      query(collection(db, name), limit(100))
    );

    results[name] = snap.docs.map(doc => doc.data());
  }

  $("totalUsers").textContent = results.users.length;
  $("totalJobs").textContent = results.jobs.length;

  $("pendingJobs").textContent =
    results.jobs.filter(job => job.status === "pending").length;

  $("pendingTasks").textContent =
    results.tasks.filter(task => task.status === "pending").length;
}

async function loadCollection(collectionName, containerId) {

  const container = $(containerId);

  container.textContent = "Loading...";

  try {

    const snap = await getDocs(
      query(
        collection(db, collectionName),
        limit(100)
      )
    );

    container.replaceChildren();

    if (snap.empty) {
      container.textContent = "No records found.";
      return;
    }

    snap.forEach(documentSnapshot => {

      const data = documentSnapshot.data();

      const card = document.createElement("div");
      card.className = "item-card";

      let html = "";

      if (collectionName === "users") {

        html = `
          <h4>${safe(data.name)}</h4>
          <p>Email: ${safe(data.email)}</p>
          <p>Phone: ${safe(data.phone)}</p>
          <p>Balance: ৳${Number(data.balance || 0).toFixed(2)}</p>
        `;

      } else if (collectionName === "jobs") {

        html = `
          <h4>${safe(data.title)}</h4>
          <p>Category: ${safe(data.category)}</p>
          <p>Payment: ৳${Number(data.payment || 0).toFixed(2)}</p>
          <p>Workers: ${safe(data.workers)}</p>
          <span class="status ${safe(data.status)}">
            ${safe(data.status)}
          </span>
        `;

      } else if (collectionName === "tasks") {

        html = `
          <h4>Task Submission</h4>
          <p>Job ID: ${safe(data.jobId)}</p>
          <p>User ID: ${safe(data.userId)}</p>
          <span class="status ${safe(data.status)}">
            ${safe(data.status)}
          </span>
        `;

      } else {

        html = `
          <h4>${collectionName === "deposits" ? "Deposit" : "Withdrawal"}</h4>
          <p>Amount: ৳${Number(data.amount || 0).toFixed(2)}</p>
          <p>Method: ${safe(data.method)}</p>
          <p>User ID: ${safe(data.userId)}</p>
          <span class="status ${safe(data.status)}">
            ${safe(data.status)}
          </span>
        `;

      }

      card.innerHTML = html;
      container.appendChild(card);

    });

  } catch (error) {

    console.error(error);
    container.textContent = "Unable to load records: " + error.message;

  }

}
