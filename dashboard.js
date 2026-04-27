
import { auth, db } from "./firebase.js";

import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
  setDoc,
  doc,
  limit
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";


let currentDate = new Date();
let currentUser = null;
let allWorkouts = [];

/* -------------------------
   SIDEBAR NAVIGATION
--------------------------*/

const navItems = document.querySelectorAll(".nav-item");
const tabs = document.querySelectorAll(".tab-content");
const pageTitle = document.getElementById("pageTitle");

navItems.forEach(item => {

  item.addEventListener("click", (e) => {

    e.preventDefault();

    const target = item.dataset.tab;

    tabs.forEach(tab => tab.classList.remove("active"));
    navItems.forEach(btn => btn.classList.remove("active"));

    document.getElementById(target).classList.add("active");
    item.classList.add("active");

    pageTitle.textContent = item.textContent;

    if(item.dataset.tab === "overview"){
  welcomeText.style.display = "block";
}else{
  welcomeText.style.display = "none";
}

  });

});

function getTodayRange() {
  const now = new Date();

  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}


async function getUserProfile(user) {
  const q = query(
    collection(db, "users"),
    where("userId", "==", user.uid)
  );

  const snap = await getDocs(q);

  if (snap.empty) return null;

  return snap.docs[0].data();
}

function calculateRMR({ weight, height, age, gender }) {
  if (gender === "male") {
    return 10 * weight + 6.25 * height - 5 * age + 5;
  } else {
    return 10 * weight + 6.25 * height - 5 * age - 161;
  }
}


function calculateActivityScore({ weeklyMinutes, workoutDays, weeklyCalories }) {
  let score = 0;

  // Time factor (max 40)
  score += Math.min(weeklyMinutes / 300 * 40, 40);

  // Frequency factor (max 30)
  score += Math.min(workoutDays / 7 * 30, 30);

  // Intensity factor (max 30)
  score += Math.min(weeklyCalories / 2000 * 30, 30);

  return score;
}

function getActivityLevel(score,profile) {
  if (score === 0) {
    return profile?.goalType === "muscle_gain" ? "moderate" : "light";
  }
  if (score < 20) return "sedentary";
  if (score < 40) return "light";
  if (score < 60) return "moderate";
  if (score < 80) return "active";
  return "athlete";
}

function getMultiplier(level) {
  const map = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    athlete: 1.9
  };
  return map[level] || 1.2;
}


function getGoalCalories(tdee, goalType) {
  if (goalType === "weight_loss") return tdee - 500;
  if (goalType === "muscle_gain") return tdee + 300;
  return tdee;
}


/* -------------------------Update Dashboard Stats
--------------------------*/

async function updateDashboard(user) {
  // --- 1. WORKOUT FETCH ---
  const q = query(
    collection(db, "workouts"),
    where("userId", "==", user.uid)
  );

  const querySnapshot = await getDocs(q);

  allWorkouts = []; // global store

  querySnapshot.forEach((doc) => {

    allWorkouts.push(doc.data());
  });


  // ✅ TODAY FILTER
  const { start, end } = getTodayRange();

let totalCalories = 0;
let workoutCount = 0;

allWorkouts.forEach(w => {
  const d = new Date(w.date.seconds * 1000);

  if (d >= start && d <= end) {
    totalCalories += w.calories || 0;
    workoutCount++;
  }
});

// 1. GET USER PROFILE
const profile = await getUserProfile(user);

let progress = 0;
let activityLevel = "--";
let workoutTarget = 0;

if (profile) {

  const rmr = calculateRMR(profile);

  // 2. WEEKLY CALCULATION
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const lastWeek = new Date(today);
  lastWeek.setDate(today.getDate() - 7);

  let weeklyMinutes = 0;
  let weeklyCalories = 0;
  let workoutDaysSet = new Set();

  allWorkouts.forEach(w => {
    const d = new Date(w.date.seconds * 1000);

    if (d >= lastWeek && d < today) {
      weeklyMinutes += w.duration || 0;
      weeklyCalories += w.calories || 0;
      workoutDaysSet.add(d.toDateString());
    }
  });

  const workoutDays = workoutDaysSet.size;

  // 3. ACTIVITY LEVEL
  const score = calculateActivityScore({
    weeklyMinutes,
    workoutDays,
    weeklyCalories
  });

  activityLevel = getActivityLevel(score,profile);

  const multiplier = getMultiplier(activityLevel);

  // 4. TDEE 
  const tdee = rmr * multiplier;
  const dailyGoal = getGoalCalories(rmr * multiplier, profile.goalType);

  // 5. TARGET + PROGRESS
  workoutTarget = Math.max(dailyGoal - rmr, 200);
progress = workoutTarget > 0 
    ? Math.min((totalCalories / workoutTarget) * 100, 100) 
    : 0;

if (document.getElementById("welcomeText")) {
       document.getElementById("welcomeText").textContent = `Welcome, ${profile.name}!`;
    }

    const nameField = document.getElementById("name");
    if (nameField) nameField.value = profile.name || "";

       const heightField = document.getElementById("profileheight");
    if (heightField) heightField.value = profile.height || "";
    
    const weightField = document.getElementById("profileweight");
    if (weightField) weightField.value = profile.weight || "";
    
    const ageField = document.getElementById("age");
    if (ageField) ageField.value = profile.age || "";
    
    const genderField = document.getElementById("gender");
    if (genderField) genderField.value = profile.gender || "Male";

const goalField = document.getElementById("goalType");
if (goalField) goalField.value = profile.goalType || "weight_loss";

// Optional: Update the "Your Name" label in the profile modal
const modalNameLabel = document.getElementById("modalNameLabel"); 
if (modalNameLabel) modalNameLabel.textContent = profile.name || "Your Name";
  

}

  // --- 2. BMI FETCH (Correctly Integrated) ---
  // Stimulus: App needs the latest BMI record
  try {
    const bmiQuery = query(
      collection(db, "bmi"), 
      where("userId", "==", user.uid),
      orderBy("date", "desc"),
      limit(1)
    );

  const bmiSnapshot = await getDocs(bmiQuery);
  const bmiValEl = document.getElementById("bmiValue");
  const bmiStatEl = document.getElementById("bmiStatus");

  if (!bmiSnapshot.empty) {
    const data = bmiSnapshot.docs[0].data();
    if (bmiValEl) bmiValEl.textContent = data.bmi;
    if (bmiStatEl) bmiStatEl.textContent = data.category;
  } else {
    // Default values if no BMI has been calculated yet
    if (bmiValEl) bmiValEl.textContent = "--";
    if (bmiStatEl) bmiStatEl.textContent = "Not calculated";
  }
  } catch (error) {
    console.error("BMI fetch error:", error);
  }

 
  // --- 4. UPDATE OVERVIEW STATS ---
  // Response: Updates Overview Dashboard instantly
 document.getElementById("caloriesValue").textContent = totalCalories;
document.getElementById("workoutCount").textContent = workoutCount;

// 🔥 UPDATE PROGRESS UI
if (document.getElementById("goalBarFill")) {
  document.getElementById("goalBarFill").style.width = `${progress}%`;
}

if (document.getElementById("goalProgressText")) {
  document.getElementById("goalProgressText").textContent =
    `${Math.round(progress)}%`;
}


if (document.getElementById("goalTargetText")) {
  document.getElementById("goalTargetText").textContent =
    ` ${Math.round(workoutTarget)}`;
}

if (document.getElementById("displayActual")) {
  document.getElementById("displayActual").textContent =
     `${Math.round(totalCalories)}`;
}


if (document.getElementById("displayRemaining")) {
   const diff = Math.round(workoutTarget) - Math.round(totalCalories);
  document.getElementById("displayRemaining").textContent =
     Math.max(diff, 0);
}


if(document.getElementById("progressValue")){
   document.getElementById("progressValue").textContent =
    `${Math.round(progress)}%`;
}
  

  renderCalendar();

}

/* -----------------------------------------
   1. INITIALIZE THE CALENDAR 
----------------------------------------*/

export function renderCalendar() {   
  const grid = document.getElementById("calendarGrid");
  const title = document.getElementById("calendarTitle");

  if (!grid || !title) return;

  grid.innerHTML = "";

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Title
  title.textContent = currentDate.toLocaleString("default", {
    month: "long",
    year: "numeric"
  });

  const firstDay = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();

  // Empty cells before month starts
  for (let i = 0; i < firstDay; i++) {
    grid.innerHTML += `<div></div>`;
  }

  // Days
  for (let day = 1; day <= totalDays; day++) {
    const date = new Date(year, month, day);

    // 🔥 CHECK WORKOUT EXISTS
    const hasWorkout = allWorkouts.some(w => {
  const d = new Date(w.date.seconds * 1000);
  return d.toDateString() === date.toDateString();
});
    const dayDiv = document.createElement("div");
    dayDiv.className = "calendar-day";

    if (hasWorkout) {
      dayDiv.classList.add("active-day"); // blue circle
    }

    dayDiv.textContent = day;

    // CLICK EVENT
    dayDiv.addEventListener("click", () => {
  fetchWorkoutsForDate(currentUser, date);
});

    grid.appendChild(dayDiv);
  }
}

/* -----------------------------------------
   2. FETCH STORED DATA FOR SELECTED DATE
------------------------------------------*/
async function fetchWorkoutsForDate(user, selectedDate) {
    const detailArea = document.getElementById("dayDetailArea");
    const dateDisplay = document.getElementById("selectedDateDisplay");

    // Update Header
    dateDisplay.textContent = selectedDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    detailArea.innerHTML = `<div class="loading">Searching logs...</div>`;

    // CREATE THE TIME WINDOW (Start and End of the Day)
    const startOfDay = new Date(selectedDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(selectedDate);
    endOfDay.setHours(23, 59, 59, 999);

    try {
        const q = query(
            collection(db, "workouts"),
            where("userId", "==", user.uid),
            where("date", ">=", Timestamp.fromDate(startOfDay)),
            where("date", "<=", Timestamp.fromDate(endOfDay)),
            orderBy("date", "desc")
        );

        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
            detailArea.innerHTML = `
                <div class="empty-state">
                    <p>No activities logged for this day.</p>
                    
                </div>`;
            return;
        }

        // 3. BUILD THE OUTPUT VIEW
        let html = "";
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            html += `
    <div class="workout-log-entry">
      
      <div class="entry-info">
        <span class="entry-type">
          ${data.workoutType} • ${data.subType || ""}
        </span>

        <span class="entry-meta">
          ${data.duration || 0} mins • ${data.intensity} intensity
        </span>

        ${data.distance ? `<p>📍 Distance: ${data.distance} km</p>` : ""}
        ${data.sets ? `<p>🏋️ Sets: ${data.sets}</p>` : ""}
        ${data.reps ? `<p>🔁 Reps: ${data.reps}</p>` : ""}

        ${data.notes ? `<p class="entry-notes">"${data.notes}"</p>` : ""}
      </div>

      <div class="entry-stats">
        <span class="entry-calories">+${data.calories}</span>
        <small>kcal</small>
      </div>

    </div>
  `;
});
        detailArea.innerHTML = html;

    } catch (error) {
        console.error("Error fetching historical data:", error);
        detailArea.innerHTML = `<div class="error">Unable to load activity. Check your connection.</div>`;
    }
}


/* -------------------------
   AUTH CHECK
--------------------------*/

onAuthStateChanged(auth, async (user) => {
    const modal = document.getElementById("profileModal");
    const dashboard = document.getElementById("mainDashboardContent");

    if (!user) {
        window.location.href = "signup.html";
        return;
    }

    currentUser = user;
    
    // 1. Fetch the profile data immediately
    const profile = await getUserProfile(user);

    if (!profile) {
        showOnboardingOverlay();
    } else {
        // Load all fitness data
        await updateDashboard(user);

        // Update Welcome Text & Initials using Firestore data
        const fullName = profile.name || user.displayName || "User";
        const firstName = fullName.split(" ")[0];

        const welcomeText = document.getElementById("welcomeText");
        if (welcomeText) {
            welcomeText.textContent = `Welcome back, ${firstName}!`;
        }

        const avatar = document.getElementById("profileAvatar");
        if (avatar) {
            const initials = fullName
                .split(" ")
                .filter(n => n.length > 0)
                .map(n => n[0])
                .join("")
                .toUpperCase();
            avatar.textContent = initials;
        }
    }
});
  /* BMI CALCULATOR
--------------------------*/

const bmiForm = document.getElementById("bmiForm");

if (bmiForm) {

 bmiForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const user = auth.currentUser; 

  if (!user) {
    alert("Authentication error. Please refresh the page.");
    return;
  }

    const height = document.getElementById("height").value / 100;
    const weight = document.getElementById("weight").value;

  const bmiValue = weight / (height * height);
  const bmi = Number(bmiValue.toFixed(1));

    let category = "";

    if (bmi < 18.5) category = "Underweight";
    else if (bmi < 24.9) category = "Normal";
    else if (bmi < 29.9) category = "Overweight";
    else category = "Obese";

      document.getElementById("bmiResultValue").textContent = bmi;
    document.getElementById("bmiCategory").textContent = category;

    document.getElementById("bmiResult").style.display = "block";

    try{
    await addDoc(collection(db, "bmi"), {
    userId: user.uid,
    bmi: Number(bmi),
    category: category,
    date: new Date()
  });

  console.log("BMI saved ✅");
     /* UPDATE OVERVIEW CARD */

  setTimeout(() => {
  updateDashboard(user);
}, 500);
  } catch (error) {
      console.error("Error saving BMI:", error);
    }
  });

}


/* -------------------------
   WORKOUT FORM 
--------------------------*/


    const workoutNameEl = document.getElementById("workoutType");
const workoutSubType = document.getElementById("workoutSubType");
const subTypeContainer = document.getElementById("subTypeContainer");
const extraFields = document.getElementById("extraFields");


    const subTypes = {
  cardio: ["running", "walking", "cycling", "skipping"],
  strength: ["weightlifting", "bodyweight", "resistance"],
  flexibility: ["yoga", "stretching", "pilates"],
  sports: ["football", "cricket", "basketball", "badminton"],
  other: []
};

workoutNameEl.addEventListener("change", () => {
  const selectedType = workoutNameEl.value;

  workoutSubType.innerHTML = `<option value="">Select Sub-Type</option>`;

  if (selectedType && subTypes[selectedType]) {
    subTypeContainer.classList.remove("hidden");

    subTypes[selectedType].forEach(type => {
      const opt = document.createElement("option");
      opt.value = type;
      opt.textContent = type;
      workoutSubType.appendChild(opt);
    });
  } else {
    subTypeContainer.classList.add("hidden");
  }

  extraFields.innerHTML = "";
});

workoutSubType.addEventListener("change", () => {
  const sub = workoutSubType.value;

  extraFields.innerHTML = "";

  // Cardio → distance
  if (["running", "walking", "cycling"].includes(sub)) {
    extraFields.innerHTML = `
      <div class="form-group">
        <label>Distance (km)</label>
        <input type="number" id="distance" placeholder="e.g. 2.5">
      </div>
    `;
  }

  // Strength → sets/reps
  if (["weightlifting", "bodyweight"].includes(sub)) {
    extraFields.innerHTML = `
      <div class="form-group">
        <label>Sets</label>
        <input type="number" id="sets">
      </div>
      <div class="form-group">
        <label>Reps</label>
        <input type="number" id="reps">
      </div>
    `;
  }
});


function getMET(subType) {
  const map = {
    running: 9.8,
    walking: 3.8,
    cycling: 7.5,
    skipping: 10,
    weightlifting: 6,
    bodyweight: 5,
    resistance: 4.5,
    yoga: 2.5,
    stretching: 2,
    pilates: 3,
    football: 7,
    cricket: 5,
    basketball: 6.5,
    badminton: 5.5
  };


  return map[subType] || 5;
}


const workoutForm = document.getElementById("workoutForm");

if (workoutForm) {

  workoutForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    console.log("🔥 Workout button clicked");

    const user = auth.currentUser;

    if (!user) {
      alert("Please login first");
      return;
    }

 try {

  const workoutName = document.getElementById("workoutType").value;
  const subType = document.getElementById("workoutSubType").value;

    const duration = document.getElementById("workoutDuration").value;
    const weight = document.getElementById("userWeight").value;
    const intensity = document.getElementById("intensity").value;
    const notes = document.getElementById("workoutNotes").value;

    const distanceEl = document.getElementById("distance");
const setsEl = document.getElementById("sets");
const repsEl = document.getElementById("reps");


    const met = getMET(subType);

    //  CALORIE CALCULATION
    const calories = Math.round((met * weight * 3.5 / 200) * duration);

let workoutData = {
  userId: user.uid,
  workoutType: workoutName,
  subType: subType,
  duration: Number(duration),
  calories: Number(calories),
  intensity,
  date: Timestamp.now(),
  notes
};

     document.getElementById("calorieResultValue").textContent =
  `${calories} kcal burned 💪`;
     document.getElementById("workoutResult").style.display = "block";


   const distance = document.getElementById("distance")?.value;
    const sets = document.getElementById("sets")?.value;
    const reps = document.getElementById("reps")?.value;

    if (distance) workoutData.distance = Number(distance);
    if (sets) workoutData.sets = Number(sets);
    if (reps) workoutData.reps = Number(reps);

    // ✅ Save to Firebase
    await addDoc(collection(db, "workouts"), workoutData);

    alert("Workout saved ✅");

  
    setTimeout(() => {
  updateDashboard(user);
}, 500); // refresh UI


    } catch (error) {
      console.error(error);
      alert("Error saving workout ❌");
    }

  });
};


document.getElementById("prevMonth").addEventListener("click", () => {
  currentDate.setMonth(currentDate.getMonth() - 1);
  renderCalendar();
});

document.getElementById("nextMonth").addEventListener("click", () => {
  currentDate.setMonth(currentDate.getMonth() + 1);
  renderCalendar();
});

const profileAvatar = document.getElementById("profileAvatar");
const profileModal = document.getElementById("profileModal");
const closeProfile = document.getElementById("closeProfile");

profileAvatar.addEventListener("click", () => {
  profileModal.classList.remove("hidden");
});

closeProfile.addEventListener("click", () => {
  profileModal.classList.add("hidden");
});


const profileForm = document.getElementById("profileForm");

profileForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!currentUser) {
  alert("User not ready yet ❌");
  return;
  }
    const profileData = {
      userId: currentUser.uid,
      name: document.getElementById("name").value,
      age: Number(document.getElementById("age").value),
      gender: document.getElementById("gender").value,
      height: Number(document.getElementById("profileheight").value),
      weight: Number(document.getElementById("profileweight").value),
      goalType: document.getElementById("goalType").value
    };

    console.log("🔥 Data to save:", profileData);
    console.log("Captured Data:", height, weight);

try {
  await setDoc(doc(db, "users", currentUser.uid), profileData);
  console.log("✅ Profile saved")

    document.getElementById("profileModal").classList.add("hidden");

    await updateDashboard(currentUser);

  } catch (error) {
    console.error("❌ FULL ERROR:", error.message);
    alert(error.message);
  }
});


function showOnboardingOverlay() {
    const modal = document.getElementById("profileModal");
    const dashboard = document.getElementById("mainDashboardContent"); // Or whatever your main wrapper is named

    // 2. Open the modal


    if (modal) { 
        modal.classList.remove("hidden");
        modal.style.display = "flex";

    }
    // 3. "Lock" the background so they can't click anything else
    if (dashboard) {
       dashboard.style.filter = "none";          // Removes the blur
        dashboard.style.pointerEvents = "auto";   // Re-enables clicking
        dashboard.style.userSelect = "auto";
    }

    // 4. Change the text to advise the user
    const modalTitle = modal.querySelector("h2");
    if (modalTitle) {
        modalTitle.textContent = "Setup Your Fitness Profile";
    }
}
