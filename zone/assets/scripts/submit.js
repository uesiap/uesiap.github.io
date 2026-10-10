// Shared script for the prayer submit page.
// Each page sets window.PRAYER_CONFIG (basePath, etc.) before loading this file.
const CONFIG = window.PRAYER_CONFIG;
const BASE_PATH = CONFIG.basePath;

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyAaQdWKBdtqqe3pu9XDdPoFuvcEm2YG_wA",
    authDomain: "melam-rahul.firebaseapp.com",
    projectId: "melam-rahul",
    storageBucket: "melam-rahul.appspot.com",
    messagingSenderId: "742315739002",
    appId: "1:742315739002:web:329ea957fa38f66ab078c3",
    measurementId: "G-SCNKZYJ3TT"
};

// If Firebase cannot load, the form still renders; saving checks for this
let db = null;
try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.database();
} catch (e) {
    console.error("Firebase could not load", e);
}

const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// ---------- Month dropdown: last month and current month ----------
(function setupMonths() {
    const now = new Date();
    const cur = now.getMonth();
    const curYear = now.getFullYear();
    const lastIdx = cur === 0 ? 11 : cur - 1;
    const lastYear = cur === 0 ? curYear - 1 : curYear;

    const monthSelect = document.getElementById("currentMonth");
    [[lastIdx, lastYear], [cur, curYear]].forEach(([idx, yr]) => {
        const opt = document.createElement("option");
        opt.value = `${monthNames[idx]} ${yr}`;
        opt.textContent = `${monthNames[idx]} ${yr}`;
        monthSelect.appendChild(opt);
    });
    monthSelect.value = `${monthNames[cur]} ${curYear}`;
})();

// ---------- Points sections ----------
// Starting number of boxes per section
const POINT_SECTIONS = {
    hpcPraising: { container: "hpcPraisingContainer", start: 2 },
    hpcPrayer: { container: "hpcPrayerContainer", start: 3 },
    personalPraising: { container: "personalPraisingContainer", start: 2 },
    personalPrayer: { container: "personalPrayerContainer", start: 3 }
};

function pointRowHTML(section, number, removable) {
    return `
    <div class="input-group point-row" data-section="${section}">
        <span class="point-number">${number}:</span>
        <input type="text" class="form-control pt-input" data-section="${section}">
        <button type="button" class="btn mic-button" onclick="startDictation(this)">
            <i class="fas fa-microphone"></i>
        </button>
        ${removable ? `<button type="button" class="btn btn-danger" onclick="removePoint(this)"><i class="fas fa-trash"></i></button>` : ""}
    </div>`;
}

function renumber(container) {
    container.querySelectorAll(".point-row .point-number").forEach((el, i) => {
        el.textContent = (i + 1) + ":";
    });
}

function addPoint(section) {
    const container = document.getElementById(POINT_SECTIONS[section].container);
    const count = container.querySelectorAll(".point-row").length + 1;
    container.insertAdjacentHTML("beforeend", pointRowHTML(section, count, true));
}

function removePoint(button) {
    const container = button.closest(".point-row").parentElement;
    button.closest(".point-row").remove();
    renumber(container);
}

// Create the starting boxes for each section
Object.entries(POINT_SECTIONS).forEach(([section, cfg]) => {
    const container = document.getElementById(cfg.container);
    for (let i = 1; i <= cfg.start; i++) {
        container.insertAdjacentHTML("beforeend", pointRowHTML(section, i, false));
    }
});

// ---------- Dictation ----------
function startDictation(button) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
        alert("Speech Recognition not supported in this browser.");
        return;
    }
    const input = button.closest(".input-group").querySelector("input");
    const recognition = new SR();
    recognition.lang = "en-US";

    recognition.onresult = function (event) {
        const text = event.results[0][0].transcript;
        input.value = text.charAt(0).toUpperCase() + text.slice(1);
    };
    recognition.onend = function () {
        document.getElementById("micFeedback").style.display = "none";
    };

    setTimeout(() => {
        recognition.start();
        document.getElementById("micFeedback").style.display = "block";
    }, 300);
}

// ---------- Read the points of one section ----------
function collectPoints(section) {
    return Array.from(document.querySelectorAll(`input.pt-input[data-section="${section}"]`))
        .map(input => input.value.trim())
        .filter(point => point.length > 0);
}

// ---------- Submit: show confirmation, then save ----------
document.getElementById("prayerRequestForm").addEventListener("submit", function (event) {
    event.preventDefault();
    new bootstrap.Modal(document.getElementById("confirmationDialog")).show();
});

document.getElementById("confirmSubmit").addEventListener("click", function () {
    bootstrap.Modal.getInstance(document.getElementById("confirmationDialog")).hide();
    saveSubmission();
});

async function saveSubmission() {
    if (!db) {
        alert("Could not connect to the database. Please check your internet connection and try again.");
        return;
    }

    const loader = document.getElementById("loaderContainer");
    loader.style.display = "block";

    const [monthName, yearText] = document.getElementById("currentMonth").value.split(" ");
    const month = monthNames.indexOf(monthName) + 1;
    const year = parseInt(yearText, 10);

    const category = document.getElementById("category").value;
    const group = category === "student" ? "students" : "graduates";

    const data = {
        name: document.getElementById("name").value.trim(),
        category: category,
        localZone: document.getElementById("localZone").value.trim(),
        pioneeringArea: document.getElementById("pioneeringArea").value.trim(),
        hpc: {
            praising: collectPoints("hpcPraising"),
            prayer: collectPoints("hpcPrayer")
        },
        personal: {
            praising: collectPoints("personalPraising"),
            prayer: collectPoints("personalPrayer")
        },
        submittedAt: firebase.database.ServerValue.TIMESTAMP
    };

    try {
        await db.ref(`${BASE_PATH}/${year}/${month}/${group}`).push(data);
        await cleanupOldMonthsOnce();

        loader.style.display = "none";
        document.getElementById("successMessage").style.display = "block";
        document.getElementById("prayerRequestForm").reset();
        document.getElementById("prayerRequestForm").style.display = "none";
    } catch (error) {
        console.error("Error writing prayer data to Firebase Database", error);
        loader.style.display = "none";
        alert("Something went wrong while submitting. Please try again.");
    }
}

// ---------- Keep only the latest 3 months under this zone's branch ----------
async function cleanupOldMonthsOnce() {
    const now = new Date();
    const cleanupKey = `${now.getFullYear()}-${now.getMonth() + 1}`;

    const cleanupRef = db.ref(`${BASE_PATH}/system/lastCleanup`);
    const cleanupSnap = await cleanupRef.once("value");
    if (cleanupSnap.val() === cleanupKey) return; // already cleaned this month

    const snapshot = await db.ref(BASE_PATH).once("value");
    const months = [];

    snapshot.forEach(yearSnap => {
        if (!/^\d{4}$/.test(yearSnap.key)) return; // skips "system"

        yearSnap.forEach(monthSnap => {
            months.push({
                year: parseInt(yearSnap.key, 10),
                month: parseInt(monthSnap.key, 10)
            });
        });
    });

    months.sort((a, b) => (a.year === b.year ? a.month - b.month : a.year - b.year));

    // Keep latest 3 months
    const monthsToDelete = months.slice(0, -3);
    for (const item of monthsToDelete) {
        await db.ref(`${BASE_PATH}/${item.year}/${item.month}`).remove();
        console.log(`Deleted ${BASE_PATH}/${item.year}/${item.month}`);
    }

    await cleanupRef.set(cleanupKey);
}