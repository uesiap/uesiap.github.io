// Shared script for the prayer submit page.
// Each page sets window.PRAYER_CONFIG first: formType ("dsnr" or "hpc"), basePath, etc.
const CONFIG = window.PRAYER_CONFIG;
const FORM_TYPE = CONFIG.formType;
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

// ---------- Point boxes ----------
// Sections per form type. "start" = boxes shown first; "removable" = user can delete extra boxes.
const SECTIONS = {
    dsnr: {
        praisingPoints: { container: "praisingPointsContainer", start: 2, removable: false },
        prayerPoints: { container: "prayerPointsContainer", start: 3, removable: false }
    },
    hpc: {
        hpcPraising: { container: "hpcPraisingContainer", start: 2, removable: true },
        hpcPrayer: { container: "hpcPrayerContainer", start: 3, removable: true },
        personalPraising: { container: "personalPraisingContainer", start: 2, removable: true },
        personalPrayer: { container: "personalPrayerContainer", start: 3, removable: true }
    }
};
const POINT_SECTIONS = SECTIONS[FORM_TYPE];

function pointRowHTML(section, number, removable) {
    return `
    <div class="input-group point-row mb-3" data-section="${section}">
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
    const cfg = POINT_SECTIONS[section];
    const container = document.getElementById(cfg.container);
    const count = container.querySelectorAll(".point-row").length + 1;
    container.insertAdjacentHTML("beforeend", pointRowHTML(section, count, cfg.removable));
}

function removePoint(button) {
    const container = button.closest(".point-row").parentElement;
    button.closest(".point-row").remove();
    renumber(container);
}

// Create the starting boxes for each section that exists on the page
function initPointBoxes() {
    Object.entries(POINT_SECTIONS).forEach(([section, cfg]) => {
        const container = document.getElementById(cfg.container);
        if (!container || container.querySelector(".point-row")) return;
        for (let i = 1; i <= cfg.start; i++) {
            container.insertAdjacentHTML("beforeend", pointRowHTML(section, i, false));
        }
    });
}

// ---------- Dilsukhnagar form: cards change with the category ----------
// Name and Category sit in the top card (static). Each section below is its own card.
function buildDsnrFields(category) {
    const box = document.getElementById("dynamicFields");
    box.innerHTML = "";
    if (!category) return;

    let html = "";

    if (category === "student") {
        html += `
        <div class="container-box">
            <h4 class="form-label">Course & Personal Details</h4>
            <div class="mb-3">
                <label for="courseBranch" class="form-label">Course & Branch:</label>
                <input type="text" class="form-control" id="courseBranch" name="courseBranch" required>
            </div>
            <div class="mb-3">
                <label for="gender" class="form-label">Gender:</label>
                <select class="form-select" id="gender" name="gender" required>
                    <option value="" disabled selected>Select Gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                </select>
            </div>
        </div>`;
    }

    html += `
        <div class="container-box">
            <h4 class="form-label">🙌🏻 Praising Points</h4>
            <p class="section-note">Please verify the fields you entered, before submit.</p>
            <div id="praisingPointsContainer"></div>
            <button type="button" class="btn btn-outline-primary mb-3" onclick="addPoint('praisingPoints')">Add More Praising Points</button>
        </div>

        <div class="container-box">
            <h4 class="form-label">🙏🏻 Prayer Points</h4>
            <p class="section-note">Please verify the fields you entered, before submit.</p>
            <div id="prayerPointsContainer"></div>
            <button type="button" class="btn btn-outline-primary mb-3" onclick="addPoint('prayerPoints')">Add More Prayer Points</button>
        </div>`;

    box.innerHTML = html;
    initPointBoxes();
}

if (FORM_TYPE === "dsnr") {
    document.getElementById("category").addEventListener("change", function () {
        buildDsnrFields(this.value);
    });
}

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

    try {
        if (FORM_TYPE === "dsnr") {
            await saveDsnr(year, month);
        } else {
            await saveHpc(year, month);
        }
        await cleanupOldMonthsOnce();

        loader.style.display = "none";
        document.getElementById("successMessage").style.display = "block";
        document.getElementById("prayerRequestForm").style.display = "none";
    } catch (error) {
        console.error("Error writing prayer data to Firebase Database", error);
        loader.style.display = "none";
        alert("Something went wrong while submitting. Please try again.");
    }
}

// Same ID rule as the original Dilsukhnagar form
function makeId(text, category) {
    const prefix = category === "student" ? "stu_" : "grad_";
    return prefix + text
        .trim()
        .replace(/[^\w\s]/g, "")
        .replace(/\s+/g, "_")
        .toLowerCase();
}

// Dilsukhnagar: original data format
// zone/dsnr/prayer/{year}/{month}/{students|graduates}/details|PraisingPoints|PrayerPoints/{id}
async function saveDsnr(year, month) {
    const category = document.getElementById("category").value;
    const group = category === "student" ? "students" : "graduates";
    const name = document.getElementById("name").value.trim();
    const uniqueId = makeId(name, category);
    const root = `${BASE_PATH}/${year}/${month}/${group}`;

    const details = { name: name };
    if (category === "student") {
        details.gender = document.getElementById("gender").value;
        details.classAndBranch = document.getElementById("courseBranch").value.trim();
    }
    await db.ref(`${root}/details/${uniqueId}`).set(details);

    const praising = collectPoints("praisingPoints");
    const prayer = collectPoints("prayerPoints");
    if (praising.length > 0) {
        await db.ref(`${root}/PraisingPoints/${uniqueId}`).set({ points: praising });
    }
    if (prayer.length > 0) {
        await db.ref(`${root}/PrayerPoints/${uniqueId}`).set({ points: prayer });
    }
}

// HPC: one record per person under zone/dsnr/prayer/hpc/{year}/{month}/{students|graduates}
async function saveHpc(year, month) {
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

    await db.ref(`${BASE_PATH}/${year}/${month}/${group}`).push(data);
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

// Start: HPC boxes are static on the page; Dilsukhnagar boxes appear after choosing a category
initPointBoxes();