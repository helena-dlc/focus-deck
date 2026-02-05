console.log("--- SCRIPT DE FOCUS NOOK v5 CARGADO ---");

// --- IMPORTACIONES DE FIREBASE ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js";
import {
    getAuth,
    onAuthStateChanged,
    GoogleAuthProvider,
    signInWithPopup,
    signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
    getFirestore,
    doc,
    setDoc,
    onSnapshot,
    Timestamp,
    updateDoc,
    arrayUnion,
    getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


// --- CONFIGURACIÓN DE FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyC6tqffatZ7NhMm5bGRh0kmjCLymj0DD74",
  authDomain: "focus-deck.firebaseapp.com",
  projectId: "focus-deck",
  storageBucket: "focus-deck.firebasestorage.app",
  messagingSenderId: "81821453657",
  appId: "1:81821453657:web:deb38c2d4b00113bec9048",
  measurementId: "G-YNNE0HPCK2"
};

// --- INICIALIZAR FIREBASE ---
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);

// --- ESTADO GLOBAL ---
let currentUserId = null;
let unsubscribeFromFirestore = null;
let saveTimeout = null;
let isLoadingFromFirebase = false;
const defaultState = {
    points: 0,
    decks: [],
    tasks: [],
    studyLog: [],
    studyTimeMinutes: 0,
    currentView: 'dashboard-view',
    currentDeckId: null,
    pomodoro: {
        timer: null,
        timeLeft: 25 * 60,
        isBreak: false,
        isRunning: false,
        endTime: null,
    },
    studySession: {
        cardsToReview: [],
        currentCardIndex: 0,
        correctAnswers: 0,
    }
};
let state = { ...defaultState };


document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();

    const VIEWS = {
        DASHBOARD: 'dashboard-view',
        STUDY: 'study-view',
        MANAGE: 'manage-deck-view',
        QUIZ: 'quiz-view',
    };

    // --- Elementos del DOM (IDS CORREGIDOS) ---
    const views = document.querySelectorAll('.view');
    const dashboardView = document.getElementById('dashboard-view');
    const studyView = document.getElementById('study-view');
    const manageDeckView = document.getElementById('manage-deck-view');
    const quizView = document.getElementById('quiz-view');
    const authContainer = document.getElementById('auth-container');
    const loginView = document.getElementById('login-view');
    const mainContent = document.getElementById('main-content');
    const loginBtn = document.getElementById('login-btn');
    const pomodoroTimerEl = document.getElementById('pomodoro-timer');
    const startPomodoroBtn = document.getElementById('start-pomodoro-btn'); // CORREGIDO
    const resetPomodoroBtn = document.getElementById('reset-pomodoro-btn'); // CORREGIDO
    const taskInput = document.getElementById('task-input'); // CORREGIDO
    const taskPriority = document.getElementById('task-priority');
    const addTaskBtn = document.getElementById('add-task-btn');
    const taskList = document.getElementById('task-list');
    const newDeckBtn = document.getElementById('new-deck-btn'); // CORREGIDO
    const deckList = document.getElementById('deck-list');
    const noDecksMessage = document.getElementById('no-decks-message');
    const streakEl = document.getElementById('streak-days'); // CORREGIDO
    const studyTimeEl = document.getElementById('study-time'); // CORREGIDO
    const totalDomainEl = document.getElementById('total-domain'); // CORREGIDO
    const domainByDeckList = document.getElementById('domain-by-deck-list'); // CORREGIDO
    const manageDeckTitle = document.getElementById('manage-deck-title');
    const cardList = document.getElementById('card-list');
    const addCardBtn = document.getElementById('add-card-to-deck-btn');
    const cardQuestionInput = document.getElementById('new-card-question');
    const cardAnswerInput = document.getElementById('new-card-answer');
    const cardQuestionImgInput = document.getElementById('new-card-question-img');
    const cardAnswerImgInput = document.getElementById('new-card-answer-img');
    const previewQuestionImg = document.getElementById('preview-question-img');
    const previewAnswerImg = document.getElementById('preview-answer-img');
    const deleteDeckBtn = document.getElementById('delete-deck-btn');
    const studyDeckTitle = document.getElementById('study-deck-title');
    const studyProgress = document.getElementById('study-progress');
    const studyCard = document.getElementById('study-card');
    const studyQuestionImg = document.getElementById('study-question-img');
    const studyQuestionTextEl = document.getElementById('study-question-text');
    const studyAnswerImg = document.getElementById('study-answer-img');
    const studyAnswerTextEl = document.getElementById('study-answer-text');
    const showAnswerBtn = document.getElementById('show-answer-btn');
    const studyDifficultyBtns = document.getElementById('study-difficulty-btns');
    const quizDeckTitle = document.getElementById('quiz-deck-title');
    const quizProgress = document.getElementById('quiz-progress');
    const quizQuestionText = document.getElementById('quiz-question-text');
    const quizOptionsList = document.getElementById('quiz-options');
    const quizFeedback = document.getElementById('quiz-feedback');
    const nextQuizQuestionBtn = document.getElementById('next-quiz-question-btn');
    const notification = document.getElementById('notification');

    // --- Navegación ---
    document.getElementById('back-to-dashboard-study')?.addEventListener('click', () => navigate(VIEWS.DASHBOARD));
    document.getElementById('back-to-dashboard-manage')?.addEventListener('click', () => navigate(VIEWS.DASHBOARD));
    document.getElementById('back-to-dashboard-quiz')?.addEventListener('click', () => navigate(VIEWS.DASHBOARD));

    // --- Listeners para vista previa de imágenes ---
    if (cardQuestionImgInput && previewQuestionImg) {
        cardQuestionImgInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    previewQuestionImg.src = event.target.result;
                    previewQuestionImg.classList.remove('hidden');
                };
                reader.readAsDataURL(file);
            } else {
                previewQuestionImg.classList.add('hidden');
            }
        });
    }

    if (cardAnswerImgInput && previewAnswerImg) {
        cardAnswerImgInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    previewAnswerImg.src = event.target.result;
                    previewAnswerImg.classList.remove('hidden');
                };
                reader.readAsDataURL(file);
            } else {
                previewAnswerImg.classList.add('hidden');
            }
        });
    }


    // --- State Management & Persistence ---

    async function saveStateToFirestore() {
        if (!currentUserId || isLoadingFromFirebase) {
            console.log("⏸️ No se guarda: userId=" + currentUserId + ", isLoading=" + isLoadingFromFirebase);
            return;
        }
        
        if (saveTimeout) clearTimeout(saveTimeout);
        
        saveTimeout = setTimeout(async () => {
            console.log("💾 Guardando estado para:", currentUserId); 
            try {
                const stateToSave = JSON.parse(JSON.stringify(state));
                delete stateToSave.pomodoro?.timer;
                stateToSave.studySession = defaultState.studySession;
                stateToSave.decks = Array.isArray(stateToSave.decks) ? stateToSave.decks : [];
                stateToSave.tasks = Array.isArray(stateToSave.tasks) ? stateToSave.tasks : [];
                stateToSave.studyLog = Array.isArray(stateToSave.studyLog) ? stateToSave.studyLog : [];

                stateToSave.decks = stateToSave.decks.map(deck => ({
                    ...deck,
                    cards: (Array.isArray(deck.cards) ? deck.cards : []).map(card => {
                        let nextReviewDateTS = card.nextReviewDate;
                        if (nextReviewDateTS && typeof nextReviewDateTS === 'string') {
                            try {
                                const date = new Date(nextReviewDateTS + 'T00:00:00Z');
                                if (!isNaN(date.getTime())) {
                                    nextReviewDateTS = Timestamp.fromDate(date);
                                } else {
                                    nextReviewDateTS = Timestamp.now();
                                }
                            } catch (e) {
                                console.error("Error convirtiendo fecha:", e);
                                nextReviewDateTS = Timestamp.now();
                            }
                        } else if (!(nextReviewDateTS instanceof Timestamp)) {
                            nextReviewDateTS = Timestamp.now();
                        }
                        return { ...card, nextReviewDate: nextReviewDateTS };
                    })
                }));

                const userDocRef = doc(db, "users", currentUserId);
                await setDoc(userDocRef, stateToSave);
                console.log("✅ Estado guardado en Firestore");
            } catch (error) {
                console.error("❌ Error guardando estado:", error);
                showNotification("Error al guardar tu progreso.");
            }
        }, 500);
    }

    function processLoadedData(data) {
        console.log("📦 Procesando datos cargados");
        const loadedState = { ...defaultState, ...data };
        loadedState.pomodoro = { ...defaultState.pomodoro, ...(loadedState.pomodoro || {}) };
        loadedState.pomodoro.isRunning = false;
        loadedState.pomodoro.timer = null;
        loadedState.studySession = defaultState.studySession;
        loadedState.decks = Array.isArray(loadedState.decks) ? loadedState.decks : [];
        loadedState.tasks = Array.isArray(loadedState.tasks) ? loadedState.tasks : [];
        loadedState.studyLog = Array.isArray(loadedState.studyLog) ? loadedState.studyLog : [];

        loadedState.decks = loadedState.decks.map(deck => ({
            ...deck,
            cards: (Array.isArray(deck.cards) ? deck.cards : []).map(card => {
                let nextReviewDateStr = card.nextReviewDate;
                if (nextReviewDateStr && nextReviewDateStr.toDate) {
                    try {
                        nextReviewDateStr = nextReviewDateStr.toDate().toISOString().split('T')[0];
                    } catch (e) { nextReviewDateStr = getTodayString(); }
                } else if (typeof nextReviewDateStr !== 'string' || isNaN(new Date(nextReviewDateStr + 'T00:00:00Z').getTime())) {
                    nextReviewDateStr = getTodayString();
                }
                return { 
                    ...card, 
                    nextReviewDate: nextReviewDateStr,
                    questionImg: card.questionImg || null,
                    answerImg: card.answerImg || null
                };
            })
        }));
        return loadedState;
    }

    function listenToUserData(userId) {
        if (unsubscribeFromFirestore) unsubscribeFromFirestore();

        const userDocRef = doc(db, "users", userId);
        console.log("👂 Estableciendo listener para:", userId);

        unsubscribeFromFirestore = onSnapshot(userDocRef, (docSnap) => {
            console.log("📨 Snapshot recibido. Existe:", docSnap.exists());
            
            isLoadingFromFirebase = true;
            
            if (docSnap.exists()) {
                state = processLoadedData(docSnap.data());
            } else {
                console.log("🆕 Usuario nuevo - creando estado inicial");
                state = { ...defaultState };
                isLoadingFromFirebase = false;
                saveStateToFirestore().then(() => {
                    console.log("✅ Estado inicial guardado");
                }).catch(err => {
                    console.error("❌ Error guardando estado inicial:", err);
                });
            }
            
            render();
            checkRunningPomodoro();
            
            // CORREGIDO: Flag se desactiva después del debounce de guardado (500ms) + margen
            // para evitar condiciones de carrera con saveStateToFirestore
            setTimeout(() => {
                isLoadingFromFirebase = false;
                console.log("🔓 Guardado habilitado");
            }, 750);
        }, (error) => {
            console.error("❌ Error en listener:", error);
            showNotification("Error al sincronizar datos.");
            state = { ...defaultState };
            render();
            isLoadingFromFirebase = false;
        });
    }

    async function logStudyActivity() {
        const today = getTodayString();
        if (!Array.isArray(state.studyLog)) state.studyLog = [];
        if (!state.studyLog.includes(today)) {
            console.log("📚 Registrando actividad de estudio");
            state.studyLog.push(today);
            if (currentUserId) {
                try {
                    const userDocRef = doc(db, "users", currentUserId);
                    await updateDoc(userDocRef, { studyLog: arrayUnion(today) });
                } catch(e) {
                    console.error("Error actualizando studyLog:", e);
                    await saveStateToFirestore();
                }
            }
            renderStats();
        }
    }

    // --- Autenticación ---
    onAuthStateChanged(auth, (user) => {
        console.log("🔐 Auth cambió. User:", user ? user.uid : 'null');
        if (user) {
            currentUserId = user.uid;
            if (loginView) {
                loginView.classList.add('hidden');
                loginView.style.display = 'none';
            }
            if (mainContent) {
                mainContent.classList.remove('hidden');
                mainContent.style.display = 'block';
            }
            updateAuthUI(user);
            listenToUserData(currentUserId);
        } else {
            currentUserId = null;
            if (loginView) {
                loginView.classList.remove('hidden');
                loginView.style.display = 'block';
            }
            if (mainContent) {
                mainContent.classList.add('hidden');
                mainContent.style.display = 'none';
            }
            updateAuthUI(null);
            if (unsubscribeFromFirestore) {
                unsubscribeFromFirestore();
                unsubscribeFromFirestore = null;
            }
            state = { ...defaultState };
            render();
        }
    });

    function updateAuthUI(user) {
        if (!authContainer) return;
        if (user) {
            authContainer.innerHTML = `
                <div class="flex items-center gap-2">
                    <span id="points" class="text-sm font-semibold text-yellow-400 bg-slate-700 px-3 py-1 rounded-full">${state?.points ?? 0} pts</span>
                    <img id="user-profile-pic" src="${user.photoURL || 'https://placehold.co/40x40/7f7f7f/ffffff?text=?'}" alt="User" class="w-8 h-8 rounded-full border-2 border-slate-500">
                    <button id="logout-btn-dynamic" class="p-1 text-slate-400 hover:text-white">
                        <i data-lucide="log-out" class="w-5 h-5"></i>
                    </button>
                </div>
            `;
            lucide.createIcons();
            const dynamicLogoutBtn = document.getElementById('logout-btn-dynamic');
            if (dynamicLogoutBtn) {
                dynamicLogoutBtn.addEventListener('click', logout);
            }
        } else {
            authContainer.innerHTML = '';
        }
    }

    async function loginWithGoogle() {
        const provider = new GoogleAuthProvider();
        try {
            console.log("🔑 Iniciando login...");
            await signInWithPopup(auth, provider);
        } catch (error) {
            console.error("❌ Error en login:", error);
            let errorMessage = "Error al iniciar sesión. ";
            if (error.code === 'auth/popup-blocked') {
                errorMessage += "Popup bloqueado. Habilítalos.";
            } else if (error.code === 'auth/popup-closed-by-user') {
                errorMessage = null;
            } else {
                errorMessage += "Inténtalo de nuevo.";
            }
            if (errorMessage) showNotification(errorMessage);
        }
    }

    async function logout() {
        try {
            await signOut(auth);
            showNotification("Sesión cerrada.");
        } catch (error) {
            console.error("❌ Error al cerrar sesión:", error);
            showNotification("Error al cerrar sesión.");
        }
    }

    if (loginBtn) loginBtn.addEventListener('click', loginWithGoogle);

    // --- Navegación y Render ---
    function navigate(viewId) {
        state.currentView = viewId;
        render();
    }

    function render() {
        if (!views || !state) return;
        console.log("🎨 Renderizando:", state.currentView);

        views.forEach(v => v.classList.add('hidden'));

        switch (state.currentView) {
            case VIEWS.DASHBOARD:
                if (dashboardView) {
                    dashboardView.classList.remove('hidden');
                    renderDashboard();
                }
                break;
            case VIEWS.MANAGE:
                if (manageDeckView) {
                    manageDeckView.classList.remove('hidden');
                    renderManageView();
                }
                break;
            case VIEWS.STUDY:
                if (studyView) {
                    studyView.classList.remove('hidden');
                    renderStudyView();
                }
                break;
            case VIEWS.QUIZ:
                if (quizView) {
                    quizView.classList.remove('hidden');
                    renderQuizView();
                }
                break;
            default:
                if (dashboardView) {
                    dashboardView.classList.remove('hidden');
                    renderDashboard();
                }
        }

        updatePomodoroUI();
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    function renderDashboard() {
        renderTaskList();
        renderDeckList();
        renderStats();
    }

    // --- Tareas ---
    function renderTaskList() {
        if (!taskList) return;
        taskList.innerHTML = '';
        const tasksToRender = Array.isArray(state.tasks) ? state.tasks : [];

        if (tasksToRender.length === 0) {
            taskList.innerHTML = '<p class="text-sm text-slate-400 px-3">No hay tareas pendientes.</p>';
            return;
        }

        const priorityOrder = { 'Alta': 3, 'Media': 2, 'Baja': 1 };
        const sortedTasks = [...tasksToRender].sort((a, b) => {
            const priorityDiff = (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
            if (priorityDiff !== 0) return priorityDiff;
            return (b.id || 0) - (a.id || 0);
        });

        sortedTasks.forEach(task => {
            const taskEl = document.createElement('div');
            const priorityColor = {
                'Alta': 'border-red-500',
                'Media': 'border-yellow-500',
                'Baja': 'border-teal-500',
            }[task.priority] || 'border-slate-500';

            taskEl.className = `flex items-center justify-between p-3 bg-slate-800 rounded-lg border-l-4 ${priorityColor} mb-2 group`;
            taskEl.innerHTML = `
                <div class="flex items-center flex-1 min-w-0 mr-2">
                    <button data-task-id="${task.id}" class="complete-task-btn p-1 text-slate-400 hover:text-white mr-3 flex-shrink-0">
                        <i data-lucide="circle" class="w-5 h-5"></i>
                    </button>
                    <span class="text-slate-200 truncate" title="${task.text}">${task.text}</span>
                </div>
                <button data-task-id="${task.id}" class="delete-task-btn p-1 text-slate-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
            `;
            taskList.appendChild(taskEl);
        });
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    if (addTaskBtn) {
        addTaskBtn.addEventListener('click', () => {
            if (!taskInput || !taskPriority) return;
            const text = taskInput.value.trim();
            const priority = taskPriority.value;
            if (text) {
                if (!Array.isArray(state.tasks)) state.tasks = [];
                const newTask = {
                    id: Date.now(),
                    text,
                    priority,
                    completed: false
                };
                state.tasks.push(newTask);
                taskInput.value = '';
                renderTaskList();
                saveStateToFirestore();
            }
        });
    }

    if (taskList) {
        taskList.addEventListener('click', (e) => {
            const completeBtn = e.target.closest('.complete-task-btn');
            const deleteBtn = e.target.closest('.delete-task-btn');

            if (completeBtn) {
                const taskId = Number(completeBtn.dataset.taskId);
                if (!Array.isArray(state.tasks)) state.tasks = [];
                const taskIndex = state.tasks.findIndex(t => t.id === taskId);
                if (taskIndex > -1) {
                    state.tasks.splice(taskIndex, 1);
                    if (isNaN(state.points)) state.points = 0; 
                    state.points += 10;
                    logStudyActivity();
                    render();
                    saveStateToFirestore();
                    showNotification("¡Tarea completada! +10 puntos");
                }
            }

            if (deleteBtn) {
                const taskId = Number(deleteBtn.dataset.taskId);
                if (!Array.isArray(state.tasks)) state.tasks = [];
                const taskIndex = state.tasks.findIndex(t => t.id === taskId);
                if (taskIndex > -1) {
                    state.tasks.splice(taskIndex, 1);
                    renderTaskList();
                    saveStateToFirestore();
                }
            }
        });
    }

    // --- Decks ---
    function renderDeckList() {
        if (!deckList || !noDecksMessage) return;
        deckList.innerHTML = '';
        const decksToRender = Array.isArray(state.decks) ? state.decks : [];

        if (decksToRender.length === 0) {
            noDecksMessage.classList.remove('hidden');
            return;
        }

        noDecksMessage.classList.add('hidden');
        const today = getTodayString();

        decksToRender.forEach(deck => {
            const cards = Array.isArray(deck.cards) ? deck.cards : [];
            const cardsToReview = cards.filter(c => c.nextReviewDate <= today).length;
            const deckEl = document.createElement('div');
            deckEl.className = 'bg-slate-800 p-5 rounded-lg shadow-lg flex flex-col justify-between';
            deckEl.innerHTML = `
                <div>
                    <h3 class="text-xl font-bold text-white truncate mb-2" title="${deck.name}">${deck.name}</h3>
                    <p class="text-sm text-slate-400 mb-4">${cards.length} tarjeta(s)</p>
                    ${cardsToReview > 0
                        ? `<span class="inline-block bg-teal-600 text-teal-100 text-xs font-semibold px-2 py-1 rounded-full mb-4">${cardsToReview} para repasar hoy</span>`
                        : `<span class="inline-block bg-slate-700 text-slate-300 text-xs font-semibold px-2 py-1 rounded-full mb-4">¡Al día!</span>`
                    }
                </div>
                <div class="flex gap-2">
                    <button data-deck-id="${deck.id}" class="study-deck-btn flex-1 bg-teal-600 hover:bg-teal-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors ${cardsToReview === 0 ? 'opacity-50 cursor-not-allowed' : ''}" ${cardsToReview === 0 ? 'disabled' : ''}>
                        Estudiar
                    </button>
                    <button data-deck-id="${deck.id}" class="quiz-deck-btn flex-1 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors ${cards.length < 4 ? 'opacity-50 cursor-not-allowed' : ''}" ${cards.length < 4 ? 'disabled' : ''}>
                        Quiz
                    </button>
                    <button data-deck-id="${deck.id}" class="manage-deck-btn bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 px-3 rounded-lg transition-colors">
                        <i data-lucide="settings-2" class="w-5 h-5"></i>
                    </button>
                </div>
            `;
            deckList.appendChild(deckEl);
        });
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    if (newDeckBtn) {
        newDeckBtn.addEventListener('click', () => {
            const deckName = prompt("Introduce el nombre del nuevo tema:");
            if (deckName && deckName.trim()) {
                if (!Array.isArray(state.decks)) state.decks = [];
                const newDeck = {
                    id: 'deck_' + Date.now(),
                    name: deckName.trim(),
                    cards: []
                };
                state.decks.push(newDeck);
                state.currentDeckId = newDeck.id;
                navigate(VIEWS.MANAGE);
                saveStateToFirestore();
            }
        });
    }

    if (deckList) {
        deckList.addEventListener('click', (e) => {
            const studyBtn = e.target.closest('.study-deck-btn');
            const quizBtn = e.target.closest('.quiz-deck-btn');
            const manageBtn = e.target.closest('.manage-deck-btn');

            if (studyBtn) {
                state.currentDeckId = studyBtn.dataset.deckId;
                startStudySession();
                navigate(VIEWS.STUDY);
            }
            if (quizBtn) {
                state.currentDeckId = quizBtn.dataset.deckId;
                startQuiz();
            }
            if (manageBtn) {
                state.currentDeckId = manageBtn.dataset.deckId;
                navigate(VIEWS.MANAGE);
            }
        });
    }

    // --- Estadísticas ---
    function renderStats() {
        if (!streakEl || !studyTimeEl || !totalDomainEl || !domainByDeckList) return;

        const today = getTodayString();
        const studyLog = Array.isArray(state.studyLog) ? state.studyLog : [];
        const streak = calculateStreak(today, studyLog);
        streakEl.textContent = streak;

        const totalHours = ((state.studyTimeMinutes || 0) / 60).toFixed(1);
        studyTimeEl.textContent = totalHours;

        let totalCards = 0;
        let totalMasteredCards = 0;
        domainByDeckList.innerHTML = '';

        const decksToRender = Array.isArray(state.decks) ? state.decks : [];
        if (decksToRender.length === 0) {
            domainByDeckList.innerHTML = '<p class="text-sm text-slate-400 px-3">Añade temas para ver tu progreso.</p>';
        } else {
            decksToRender.forEach(deck => {
                const cards = Array.isArray(deck.cards) ? deck.cards : [];
                if (cards.length > 0) {
                    const masteredCards = cards.filter(c => getNextInterval(c.interval || 0, 'easy') >= 21).length;
                    const domain = Math.round((masteredCards / cards.length) * 100);

                    totalCards += cards.length;
                    totalMasteredCards += masteredCards;

                    const deckStatEl = document.createElement('div');
                    deckStatEl.className = 'mb-3 px-3';
                    deckStatEl.innerHTML = `
                        <div class="flex justify-between items-center mb-1">
                            <span class="text-sm text-slate-300 truncate" title="${deck.name}">${deck.name}</span>
                            <span class="text-sm font-semibold text-white">${domain}%</span>
                        </div>
                        <div class="w-full bg-slate-700 rounded-full h-2">
                            <div class="bg-teal-500 h-2 rounded-full" style="width: ${domain}%"></div>
                        </div>
                    `;
                    domainByDeckList.appendChild(deckStatEl);
                }
            });
        }

        const globalDomain = (totalCards > 0) ? Math.round((totalMasteredCards / totalCards) * 100) : 0;
        totalDomainEl.textContent = `${globalDomain}%`;
    }

    function calculateStreak(todayString, studyLog) {
        let streak = 0;
        const dates = new Set(studyLog);
        if (dates.size === 0) return 0;
        if (!dates.has(todayString)) return 0;

        let currentDate = new Date(todayString + 'T00:00:00Z');
        while (dates.has(currentDate.toISOString().split('T')[0])) {
            streak++;
            currentDate.setDate(currentDate.getDate() - 1);
        }
        return streak;
    }

    // --- Gestionar Tema ---
    function renderManageView() {
        if (!state.decks) state.decks = [];
        const deck = state.decks.find(d => d.id === state.currentDeckId);
        if (!deck) {
            navigate(VIEWS.DASHBOARD);
            return;
        }

        if (manageDeckTitle) manageDeckTitle.textContent = deck.name;
        if (!cardList) return;
        cardList.innerHTML = '';

        const cards = Array.isArray(deck.cards) ? deck.cards : [];
        if (cards.length === 0) {
            cardList.innerHTML = '<p class="text-sm text-slate-400 px-3">No hay tarjetas. ¡Añade la primera!</p>';
            return;
        }

        cards.forEach(card => {
            const cardEl = document.createElement('div');
            cardEl.className = 'bg-slate-800 p-4 rounded-lg mb-2 flex justify-between items-start group';
            cardEl.innerHTML = `
                <div class="flex-1 overflow-hidden min-w-0 mr-4">
                    ${card.questionImg ? `<img src="${card.questionImg}" class="max-w-full h-auto max-h-20 rounded mb-2 object-contain" onerror="this.style.display='none'">` : ''}
                    <p class="text-slate-300 font-semibold truncate" title="${card.question}"><strong class="text-teal-400">P:</strong> ${card.question}</p>
                    ${card.answerImg ? `<img src="${card.answerImg}" class="max-w-full h-auto max-h-20 rounded mt-2 mb-2 object-contain" onerror="this.style.display='none'">` : ''}
                    <p class="text-slate-300 truncate" title="${card.answer}"><strong class="text-teal-400">R:</strong> ${card.answer}</p>
                </div>
                <button data-card-id="${card.id}" class="delete-card-btn p-1 text-slate-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
            `;
            cardList.appendChild(cardEl);
        });
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    if (addCardBtn) {
        addCardBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            if (!Array.isArray(state.decks)) state.decks = [];
            const deck = state.decks.find(d => d.id === state.currentDeckId);
            if (deck) {
                if (!Array.isArray(deck.cards)) deck.cards = [];
                const question = cardQuestionInput?.value.trim();
                const answer = cardAnswerInput?.value.trim();
                if (!question || !answer) {
                    showNotification("La pregunta y la respuesta son obligatorias.");
                    return;
                }

                let questionImgData = null;
                let answerImgData = null;

                if (cardQuestionImgInput?.files && cardQuestionImgInput.files[0]) {
                    questionImgData = await fileToBase64(cardQuestionImgInput.files[0]);
                }

                if (cardAnswerImgInput?.files && cardAnswerImgInput.files[0]) {
                    answerImgData = await fileToBase64(cardAnswerImgInput.files[0]);
                }

                const newCard = {
                    id: 'card_' + Date.now(),
                    question: question,
                    answer: answer,
                    questionImg: questionImgData,
                    answerImg: answerImgData,
                    interval: 0,
                    easeFactor: 2.5,
                    nextReviewDate: getTodayString()
                };
                deck.cards.push(newCard);
                renderManageView();
                saveStateToFirestore();
                
                cardQuestionInput.value = '';
                cardAnswerInput.value = '';
                cardQuestionImgInput.value = '';
                cardAnswerImgInput.value = '';
                
                if (previewQuestionImg) {
                    previewQuestionImg.classList.add('hidden');
                    previewQuestionImg.src = '';
                }
                if (previewAnswerImg) {
                    previewAnswerImg.classList.add('hidden');
                    previewAnswerImg.src = '';
                }
                
                showNotification("Tarjeta añadida");
            }
        });
    }

    if (cardList) {
        cardList.addEventListener('click', (e) => {
            const deleteBtn = e.target.closest('.delete-card-btn');
            if (deleteBtn) {
                const cardId = deleteBtn.dataset.cardId;
                const deck = state.decks.find(d => d.id === state.currentDeckId);
                if (deck) {
                    deck.cards = deck.cards.filter(c => c.id !== cardId);
                    renderManageView();
                    saveStateToFirestore();
                }
            }
        });
    }

    if (deleteDeckBtn) {
        deleteDeckBtn.addEventListener('click', () => {
            if (confirm("¿Eliminar este tema y todas sus tarjetas?")) {
                if (!Array.isArray(state.decks)) state.decks = [];
                state.decks = state.decks.filter(d => d.id !== state.currentDeckId);
                navigate(VIEWS.DASHBOARD);
                saveStateToFirestore();
            }
        });
    }

    // --- Sesión de Estudio ---
    function startStudySession() {
        if (!Array.isArray(state.decks)) state.decks = [];
        const deck = state.decks.find(d => d.id === state.currentDeckId);
        if (!deck) return;

        const today = getTodayString();
        const cards = Array.isArray(deck.cards) ? deck.cards : [];
        const cardsToReview = cards
            .filter(c => c.nextReviewDate <= today)
            .sort(() => Math.random() - 0.5);

        state.studySession = {
            cardsToReview: cardsToReview,
            currentCardIndex: 0,
            correctAnswers: 0,
        };
        logStudyActivity();
    }

    function renderStudyView() {
        if (!state.studySession) state.studySession = defaultState.studySession;
        const { cardsToReview, currentCardIndex } = state.studySession;
        if (!Array.isArray(state.decks)) state.decks = [];
        const deck = state.decks.find(d => d.id === state.currentDeckId);

        if (!deck) {
            navigate(VIEWS.DASHBOARD);
            return;
        }

        if (studyDeckTitle) studyDeckTitle.textContent = deck.name;
        const reviewList = Array.isArray(cardsToReview) ? cardsToReview : [];

        if (currentCardIndex >= reviewList.length) {
            if (studyProgress) studyProgress.textContent = `Progreso: ${reviewList.length} / ${reviewList.length}`;
            if (studyCard) {
                studyCard.innerHTML = `
                    <div class="text-center p-8">
                        <h3 class="text-2xl font-bold text-white mb-4">¡Sesión completada!</h3>
                        <p class="text-lg text-slate-300 mb-6">Repasaste ${reviewList.length} tarjetas.</p>
                        <button id="finish-study-session-btn" class="bg-teal-600 hover:bg-teal-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors">
                            Volver al Dashboard
                        </button>
                    </div>
                `;
                const finishBtn = document.getElementById('finish-study-session-btn');
                if (finishBtn) {
                    finishBtn.addEventListener('click', () => {
                        navigate(VIEWS.DASHBOARD);
                        saveStateToFirestore();
                    });
                }
            }
            if (typeof lucide !== 'undefined') lucide.createIcons();
            return;
        }

        if (studyProgress) studyProgress.textContent = `Progreso: ${currentCardIndex + 1} / ${reviewList.length}`;
        const currentCard = reviewList[currentCardIndex];

        if (studyQuestionImg) {
            studyQuestionImg.src = currentCard.questionImg || '';
            studyQuestionImg.classList.toggle('hidden', !currentCard.questionImg);
        }
        if (studyQuestionTextEl) studyQuestionTextEl.textContent = currentCard.question;

        if (studyAnswerImg) {
            studyAnswerImg.src = '';
            studyAnswerImg.classList.add('hidden');
        }
        if (studyAnswerTextEl) {
            studyAnswerTextEl.textContent = currentCard.answer;
            if (studyAnswerTextEl.parentElement) studyAnswerTextEl.parentElement.classList.add('hidden');
        }

        if (studyDifficultyBtns) studyDifficultyBtns.classList.add('hidden');
        if (showAnswerBtn) showAnswerBtn.classList.remove('hidden');
        if (studyCard) studyCard.classList.remove('hidden');

        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    if (showAnswerBtn) {
        showAnswerBtn.addEventListener('click', () => {
            if (!state.studySession) return;
            const { cardsToReview, currentCardIndex } = state.studySession;
            const reviewList = Array.isArray(cardsToReview) ? cardsToReview : [];
            if (currentCardIndex >= reviewList.length) return;

            const currentCard = reviewList[currentCardIndex];

            if (studyAnswerImg) {
                studyAnswerImg.src = currentCard.answerImg || '';
                studyAnswerImg.classList.toggle('hidden', !currentCard.answerImg);
            }
            if (studyAnswerTextEl?.parentElement) {
                studyAnswerTextEl.parentElement.classList.remove('hidden');
            }

            showAnswerBtn.classList.add('hidden');
            if (studyDifficultyBtns) studyDifficultyBtns.classList.remove('hidden');
        });
    }

    if (studyDifficultyBtns) {
        studyDifficultyBtns.addEventListener('click', (e) => {
            const difficulty = e.target.closest('button')?.dataset.difficulty;
            if (!difficulty) return;

            if (!state.studySession) return;
            const { cardsToReview, currentCardIndex } = state.studySession;
            const reviewList = Array.isArray(cardsToReview) ? cardsToReview : [];
            if (currentCardIndex >= reviewList.length) return;

            const card = reviewList[currentCardIndex];
            let { interval = 0, easeFactor = 2.5 } = card;
            let nextInterval;
            let newEaseFactor = easeFactor;

            if (difficulty === 'easy') {
                nextInterval = getNextInterval(interval, 'easy');
                newEaseFactor = Math.min(3.0, newEaseFactor + 0.15);
                if (isNaN(state.points)) state.points = 0; 
                state.points += 3;
            } else if (difficulty === 'good') {
                nextInterval = getNextInterval(interval, 'good');
                if (isNaN(state.points)) state.points = 0; 
                state.points += 2;
            } else {
                nextInterval = 0;
                newEaseFactor = Math.max(1.3, newEaseFactor - 0.2);
                if (isNaN(state.points)) state.points = 0; 
                state.points += 1;
            }

            const nextReviewDate = new Date(getTodayString() + 'T00:00:00Z');
            const daysToAdd = Number.isFinite(nextInterval) ? Math.round(nextInterval) : 1;
            nextReviewDate.setDate(nextReviewDate.getDate() + daysToAdd);

            const deck = state.decks?.find(d => d.id === state.currentDeckId);
            const cardInDeck = deck?.cards?.find(c => c.id === card.id);
            if (cardInDeck) {
                cardInDeck.interval = nextInterval;
                cardInDeck.easeFactor = newEaseFactor;
                cardInDeck.nextReviewDate = nextReviewDate.toISOString().split('T')[0];
            }

            state.studySession.currentCardIndex++;
            renderStudyView();
            saveStateToFirestore();
        });
    }

    function getNextInterval(lastInterval, difficulty) {
        if (difficulty === 'hard') return Math.max(1, Math.floor(lastInterval / 2));
        if (lastInterval === 0) return (difficulty === 'easy') ? 4 : 1;
        if (lastInterval === 1) return (difficulty === 'easy') ? 7 : 3;
        let next = lastInterval * (difficulty === 'easy' ? 2.5 : 2.0);
        return Math.min(Math.round(next), 60);
    }

    // --- Quiz ---
    let quizState = { questions: [], currentQuestionIndex: 0, score: 0, answered: false };

    function startQuiz() {
        if (!Array.isArray(state.decks)) state.decks = [];
        const deck = state.decks.find(d => d.id === state.currentDeckId);
        const cards = Array.isArray(deck?.cards) ? deck.cards : [];
        if (!deck || cards.length < 4) {
            showNotification("Necesitas al menos 4 tarjetas para un quiz.");
            return;
        }

        logStudyActivity();

        const shuffledCards = [...cards].sort(() => Math.random() - 0.5);
        quizState.questions = shuffledCards.map(card => generateQuizQuestion(card, cards));
        quizState.currentQuestionIndex = 0;
        quizState.score = 0;
        quizState.answered = false;

        navigate(VIEWS.QUIZ);
    }

    function generateQuizQuestion(correctCard, allCards) {
        let options = [correctCard.answer];
        const incorrectCards = allCards.filter(c => c.id !== correctCard.id);
        const shuffledIncorrect = [...incorrectCards].sort(() => Math.random() - 0.5);

        for (let i = 0; options.length < 4 && i < shuffledIncorrect.length; i++) {
            if (!options.includes(shuffledIncorrect[i].answer)) {
                options.push(shuffledIncorrect[i].answer);
            }
        }

        let fillerIndex = 1;
        while (options.length < 4) {
            const filler = `Opción ${fillerIndex++}`;
            if (!options.includes(filler)) options.push(filler);
            else options.push(Math.random().toString(16).substring(2, 8));
        }

        options.sort(() => Math.random() - 0.5);
        return { question: correctCard.question, options, correctAnswer: correctCard.answer };
    }

    function renderQuizView() {
        if (!Array.isArray(state.decks)) state.decks = [];
        const deck = state.decks.find(d => d.id === state.currentDeckId);
        if (!deck) { 
            navigate(VIEWS.DASHBOARD); 
            return; 
        }

        if (quizDeckTitle) quizDeckTitle.textContent = `Quiz: ${deck.name}`;
        if (quizFeedback) quizFeedback.classList.add('hidden');
        if (nextQuizQuestionBtn) nextQuizQuestionBtn.classList.add('hidden');

        const { questions, currentQuestionIndex } = quizState;

        if (currentQuestionIndex >= questions.length) {
            const scorePercent = (questions.length > 0) ? Math.round((quizState.score / questions.length) * 100) : 0;
            if (quizQuestionText) quizQuestionText.textContent = '¡Quiz completado!';
            if (quizOptionsList) {
                quizOptionsList.innerHTML = `
                    <p class="text-xl text-center text-slate-300">
                        Puntuación: ${quizState.score} / ${questions.length} (${scorePercent}%)
                    </p>
                    <button id="finish-quiz-btn" class="w-full mt-6 bg-teal-600 hover:bg-teal-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors">
                        Volver
                    </button>`;
                document.getElementById('finish-quiz-btn')?.addEventListener('click', () => {
                    navigate(VIEWS.DASHBOARD);
                    saveStateToFirestore();
                });
            }
            if (typeof lucide !== 'undefined') lucide.createIcons();
            return;
        }

        if (quizProgress) quizProgress.textContent = `Pregunta: ${currentQuestionIndex + 1} / ${questions.length}`;
        const question = questions[currentQuestionIndex];
        if (quizQuestionText) quizQuestionText.textContent = question.question;

        if (quizOptionsList) {
            quizOptionsList.innerHTML = '';
            question.options.forEach(option => {
                const optionEl = document.createElement('button');
                optionEl.className = 'quiz-option w-full bg-slate-700 hover:bg-slate-600 text-slate-200 text-left p-4 rounded-lg transition-colors';
                optionEl.textContent = option;
                quizOptionsList.appendChild(optionEl);
            });
        }

        quizState.answered = false;
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    if (quizOptionsList) {
        quizOptionsList.addEventListener('click', (e) => {
            const selectedOption = e.target.closest('.quiz-option');
            if (!selectedOption || quizState.answered) return;

            quizState.answered = true;
            const answer = selectedOption.textContent;
            const question = quizState.questions[quizState.currentQuestionIndex];

            quizOptionsList.querySelectorAll('.quiz-option').forEach(btn => {
                btn.disabled = true;
                btn.classList.add('opacity-70');
                if (btn.textContent === question.correctAnswer) {
                    btn.classList.remove('bg-slate-700', 'hover:bg-slate-600', 'opacity-70');
                    btn.classList.add('bg-green-700');
                } else if (btn === selectedOption) {
                    btn.classList.remove('bg-slate-700', 'hover:bg-slate-600', 'opacity-70');
                    btn.classList.add('bg-red-700');
                }
            });

            if (answer === question.correctAnswer) {
                if (quizFeedback) {
                    quizFeedback.textContent = '¡Correcto! +10 puntos';
                    quizFeedback.className = 'p-3 rounded-lg bg-green-900 text-green-200 mt-4';
                }
                quizState.score++;
                if (isNaN(state.points)) state.points = 0; 
                state.points += 10;
                const pointsDisplay = document.getElementById('points');
                if (pointsDisplay) pointsDisplay.textContent = `${state.points} pts`;
            } else {
                if (quizFeedback) {
                    quizFeedback.textContent = `Incorrecto. Correcta: ${question.correctAnswer}`;
                    quizFeedback.className = 'p-3 rounded-lg bg-red-900 text-red-200 mt-4';
                }
            }

            if (quizFeedback) quizFeedback.classList.remove('hidden');
            if (nextQuizQuestionBtn) nextQuizQuestionBtn.classList.remove('hidden');
        });
    }

    if (nextQuizQuestionBtn) {
        nextQuizQuestionBtn.addEventListener('click', () => {
            quizState.currentQuestionIndex++;
            renderQuizView();
        });
    }

    // --- Pomodoro ---
    function updatePomodoroUI() {
        if (!pomodoroTimerEl) return;
        const pom = state.pomodoro || defaultState.pomodoro;
        const timeLeft = pom.timeLeft ?? (25 * 60);
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        pomodoroTimerEl.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        if (startPomodoroBtn) startPomodoroBtn.textContent = pom.isRunning ? 'Pausar' : 'Iniciar';
        
        // CORREGIDO: Usar las clases correctas que coinciden con el diseño
        // El body original tiene bg-dark-bg, cambiamos a teal para el break
        if (pom.isBreak) { 
            document.body.classList.add('!bg-teal-900'); 
            document.body.classList.remove('bg-dark-bg'); 
            pomodoroTimerEl.classList.add('text-teal-300');
            pomodoroTimerEl.classList.remove('text-white');
        } else { 
            document.body.classList.remove('!bg-teal-900'); 
            document.body.classList.add('bg-dark-bg'); 
            pomodoroTimerEl.classList.remove('text-teal-300');
            pomodoroTimerEl.classList.add('text-white');
        }
    }

    function startPomodoro() {
        if (!state.pomodoro) state.pomodoro = { ...defaultState.pomodoro };
        if (state.pomodoro.isRunning) { 
            clearInterval(state.pomodoro.timer); 
            state.pomodoro.isRunning = false;
            if (state.pomodoro.endTime && state.pomodoro.endTime > Date.now()) {
                state.pomodoro.timeLeft = Math.round((state.pomodoro.endTime - Date.now()) / 1000);
            }
            state.pomodoro.endTime = null;
        } else {
            state.pomodoro.isRunning = true;
            state.pomodoro.endTime = Date.now() + (state.pomodoro.timeLeft * 1000);
            
            state.pomodoro.timer = setInterval(() => {
                const timeLeftMs = (state.pomodoro.endTime || 0) - Date.now();
                if (timeLeftMs <= 0) handlePomodoroFinish();
                else state.pomodoro.timeLeft = Math.round(timeLeftMs / 1000);
                updatePomodoroUI();
            }, 1000);
        }
        updatePomodoroUI();
        saveStateToFirestore();
    }

    function handlePomodoroFinish() {
        clearInterval(state.pomodoro.timer);
        if (!state.pomodoro) state.pomodoro = { ...defaultState.pomodoro };
        state.pomodoro.isRunning = false; 
        state.pomodoro.endTime = null;
        playPomodoroSound(state.pomodoro.isBreak);
        if (state.pomodoro.isBreak) { 
            state.pomodoro.isBreak = false; 
            state.pomodoro.timeLeft = 25 * 60; 
            showNotification("¡Descanso terminado!"); 
        } else { 
            state.pomodoro.isBreak = true; 
            state.pomodoro.timeLeft = 5 * 60; 
            if (isNaN(state.points)) state.points = 0; 
            state.points += 25; 
            if (isNaN(state.studyTimeMinutes)) state.studyTimeMinutes = 0; 
            state.studyTimeMinutes += 25; 
            logStudyActivity(); 
            showNotification("¡Pomodoro! +25 pts. Descanso..."); 
        }
        updatePomodoroUI();
        saveStateToFirestore();
    }

    function resetPomodoro() {
        clearInterval(state.pomodoro?.timer);
        state.pomodoro = { ...defaultState.pomodoro };
        updatePomodoroUI();
        saveStateToFirestore();
    }

    function checkRunningPomodoro() {
        if (state.pomodoro?.endTime && state.pomodoro.endTime > Date.now()) { 
            state.pomodoro.timeLeft = Math.round((state.pomodoro.endTime - Date.now()) / 1000); 
            // CORREGIDO: Usar resumePomodoroTimer en lugar de startPomodoro para evitar loop
            resumePomodoroTimer(); 
        } else if (state.pomodoro?.endTime && state.pomodoro.endTime <= Date.now()) { 
            handlePomodoroFinish(); 
        }
    }

    // NUEVO: Función para reanudar el timer sin disparar guardado a Firestore
    function resumePomodoroTimer() {
        if (!state.pomodoro) state.pomodoro = { ...defaultState.pomodoro };
        
        // Limpiar cualquier timer existente
        if (state.pomodoro.timer) {
            clearInterval(state.pomodoro.timer);
        }
        
        state.pomodoro.isRunning = true;
        // IMPORTANTE: Mantener el endTime original, no recalcular
        
        state.pomodoro.timer = setInterval(() => {
            const timeLeftMs = (state.pomodoro.endTime || 0) - Date.now();
            if (timeLeftMs <= 0) {
                handlePomodoroFinish();
            } else {
                state.pomodoro.timeLeft = Math.round(timeLeftMs / 1000);
            }
            updatePomodoroUI();
        }, 1000);
        
        updatePomodoroUI();
        // NO llamamos a saveStateToFirestore aquí para evitar loop de sincronización
    }

    // CORREGIDO: Asegurar que solo se asigne el listener UNA VEZ
    if (startPomodoroBtn) {
        startPomodoroBtn.addEventListener('click', startPomodoro);
    }
    if (resetPomodoroBtn) {
        resetPomodoroBtn.addEventListener('click', resetPomodoro);
    }

    // --- Utilidades ---
    function getTodayString() { 
        return new Date().toISOString().split('T')[0]; 
    }
    
    function fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
            reader.readAsDataURL(file);
        });
    }
    
    function showNotification(message) {
        if (!notification) return;
        notification.textContent = message;
        notification.classList.remove('hidden');
        setTimeout(() => {
            notification.classList.add('hidden');
        }, 3000);
    }

    let audioCtx;
    function playPomodoroSound(isBreak) {
        try {
            if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            oscillator.frequency.value = isBreak ? 600 : 800;
            oscillator.type = 'sine';
            gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
            oscillator.start();
            oscillator.stop(audioCtx.currentTime + 0.5);
        } catch (e) {
            console.log("Audio no disponible");
        }
    }

});