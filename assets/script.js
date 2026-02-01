// ====================================
// FOCUS DECK - Script Principal
// ====================================

// Importar Firebase SDK
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore, doc, setDoc, getDoc, onSnapshot, Timestamp, arrayUnion } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// ====================================
// CONFIGURACIÓN DE FIREBASE
// ====================================
const firebaseConfig = {
    apiKey: "AIzaSyC6tqffatZ7NhMm5bGRh0kmjCLymj0DD74",
    authDomain: "focus-deck.firebaseapp.com",
    projectId: "focus-deck",
    storageBucket: "focus-deck.firebasestorage.app",
    messagingSenderId: "81821453657",
    appId: "1:81821453657:web:deb38c2d4b00113bec9048",
    measurementId: "G-YNNE0HPCK2"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// ====================================
// ESTADO DE LA APLICACIÓN
// ====================================
const VIEWS = {
    LOGIN: 'login-view',
    DASHBOARD: 'dashboard-view',
    STUDY: 'study-view',
    MANAGE: 'deck-manage-view',
    QUIZ: 'quiz-view'
};

// Estado por defecto para nuevos usuarios
const defaultState = {
    points: 0,
    studyTimeMinutes: 0,
    studyLog: [],
    decks: [],
    tasks: [],
    currentView: VIEWS.DASHBOARD,
    selectedDeckId: null,
    pomodoro: {
        duration: 25,
        breakDuration: 5,
        isRunning: false,
        isBreak: false,
        endTime: null
    }
};

// Estado global de la aplicación
let state = { ...defaultState };
let currentUserId = null;
let unsubscribeFirestore = null;
let isLoadingFromFirebase = false;

// ====================================
// REFERENCIAS DEL DOM
// ====================================
const loginView = document.getElementById('login-view');
const mainContent = document.getElementById('main-content');
const authContainer = document.getElementById('auth-container');
const loginBtn = document.getElementById('login-btn');

// Dashboard
const dashboardView = document.getElementById(VIEWS.DASHBOARD);
const pomodoroTimer = document.getElementById('pomodoro-timer');
const startPomodoroBtn = document.getElementById('start-pomodoro');
const resetPomodoroBtn = document.getElementById('reset-pomodoro');
const taskList = document.getElementById('task-list');
const newTaskInput = document.getElementById('new-task-input');
const taskPrioritySelect = document.getElementById('task-priority');
const addTaskBtn = document.getElementById('add-task-btn');
const deckList = document.getElementById('deck-list');
const addDeckBtn = document.getElementById('add-deck-btn');

// Stats
const statsStreak = document.getElementById('stats-streak');
const statsHours = document.getElementById('stats-hours');
const statsMastery = document.getElementById('stats-mastery');
const deckStatsList = document.getElementById('deck-stats-list');

// Study View
const studyView = document.getElementById(VIEWS.STUDY);
const studyDeckName = document.getElementById('study-deck-name');
const studyProgress = document.getElementById('study-progress');
const studyProgressBar = document.getElementById('study-progress-bar');
const cardContainer = document.getElementById('card-container');
const showAnswerBtn = document.getElementById('show-answer-btn');
const studyControlsRate = document.getElementById('study-controls-rate');
const studyComplete = document.getElementById('study-complete');
const sessionPoints = document.getElementById('session-points');
const finishSessionBtn = document.getElementById('finish-session-btn');

// Manage View
const manageView = document.getElementById(VIEWS.MANAGE);
const manageDeckName = document.getElementById('manage-deck-name');
const deleteDeckBtn = document.getElementById('delete-deck-btn');
const addCardToDeckBtn = document.getElementById('add-card-to-deck-btn');
const cardList = document.getElementById('card-list');
const backToDashboardManage = document.getElementById('back-to-dashboard-manage');

// Quiz View
const quizView = document.getElementById(VIEWS.QUIZ);
const quizDeckName = document.getElementById('quiz-deck-name');
const quizContainer = document.getElementById('quiz-container');
const quizResults = document.getElementById('quiz-results');
const quizScore = document.getElementById('quiz-score');
const quizPoints = document.getElementById('quiz-points');
const finishQuizBtn = document.getElementById('finish-quiz-btn');
const backToDashboardQuiz = document.getElementById('back-to-dashboard-quiz');

// Modals
const newDeckModal = document.getElementById('new-deck-modal');
const newDeckNameInput = document.getElementById('new-deck-name');
const saveDeckModalBtn = document.getElementById('save-deck-modal');
const cancelDeckModalBtn = document.getElementById('cancel-deck-modal');
const notificationModal = document.getElementById('notification-modal');
const notificationText = document.getElementById('notification-text');
const notificationOkBtn = document.getElementById('notification-ok-btn');
const confirmModal = document.getElementById('confirm-modal');
const confirmText = document.getElementById('confirm-text');
const confirmOkBtn = document.getElementById('confirm-ok-btn');
const confirmCancelBtn = document.getElementById('confirm-cancel-btn');

// Variables globales para timers y sesiones
let pomodoroInterval = null;
let studySession = {
    cardsToReview: [],
    currentIndex: 0,
    pointsEarned: 0
};
let quizSession = {
    questions: [],
    currentIndex: 0,
    score: 0,
    pointsEarned: 0
};
let confirmCallback = null;

// ====================================
// INICIALIZACIÓN
// ====================================
document.addEventListener('DOMContentLoaded', () => {
    initializeApplication();
});

<<<<<<< HEAD
function initializeApplication() {
    loginBtn?.addEventListener('click', signInWithGoogle);
    addDeckBtn?.addEventListener('click', () => {
        newDeckModal.classList.remove('hidden');
        newDeckModal.classList.add('flex');
        newDeckNameInput.focus();
    });
    saveDeckModalBtn?.addEventListener('click', saveNewDeck);
    cancelDeckModalBtn?.addEventListener('click', () => {
        newDeckModal.classList.add('hidden');
        newDeckModal.classList.remove('flex');
        newDeckNameInput.value = '';
    });
    notificationOkBtn?.addEventListener('click', () => {
        notificationModal.classList.add('hidden');
        notificationModal.classList.remove('flex');
    });
    confirmOkBtn?.addEventListener('click', () => {
        confirmModal.classList.add('hidden');
        confirmModal.classList.remove('flex');
        if (confirmCallback) confirmCallback();
        confirmCallback = null;
    });
    confirmCancelBtn?.addEventListener('click', () => {
        confirmModal.classList.add('hidden');
        confirmModal.classList.remove('flex');
        confirmCallback = null;
=======
    const VIEWS = {
        DASHBOARD: 'dashboard-view',
        STUDY: 'study-view',
        MANAGE: 'manage-deck-view',
        QUIZ: 'quiz-view',
    };

    // --- Elementos del DOM ---
    // (Asegúrate que TODOS estos IDs existen en tu index.html)
    const views = document.querySelectorAll('.view');
    const dashboardView = document.getElementById('dashboard-view');
    const studyView = document.getElementById('study-view');
    const manageDeckView = document.getElementById('manage-deck-view');
    const quizView = document.getElementById('quiz-view');
    const authContainer = document.getElementById('auth-container');
    const loginView = document.getElementById('login-view');
    const mainContent = document.getElementById('main-content');
    const loginBtn = document.getElementById('login-btn');
    // Header elements will be looked up dynamically after login
    const pomodoroTimerEl = document.getElementById('pomodoro-timer');
    const startPomodoroBtn = document.getElementById('start-pomodoro-btn');
    const resetPomodoroBtn = document.getElementById('reset-pomodoro-btn');
    const taskInput = document.getElementById('task-input');
    const taskPriority = document.getElementById('task-priority');
    const addTaskBtn = document.getElementById('add-task-btn');
    const taskList = document.getElementById('task-list');
    // Points element is inside authContainer, looked up dynamically
    const newDeckBtn = document.getElementById('new-deck-btn');
    const deckList = document.getElementById('deck-list');
    const noDecksMessage = document.getElementById('no-decks-message');
    const streakEl = document.getElementById('streak-days');
    const studyTimeEl = document.getElementById('study-time');
    const totalDomainEl = document.getElementById('total-domain');
    const domainByDeckList = document.getElementById('domain-by-deck-list');
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
        if (!currentUserId) return;
        console.log("Guardando estado para:", currentUserId, state); // Log estado antes de guardar
        try {
            // Crear copia profunda para evitar modificar el estado original durante el guardado
            const stateToSave = JSON.parse(JSON.stringify(state));

            delete stateToSave.pomodoro?.timer;
            stateToSave.studySession = defaultState.studySession;

            // Asegurar que decks, tasks y studyLog son arrays
             stateToSave.decks = Array.isArray(stateToSave.decks) ? stateToSave.decks : [];
             stateToSave.tasks = Array.isArray(stateToSave.tasks) ? stateToSave.tasks : [];
             stateToSave.studyLog = Array.isArray(stateToSave.studyLog) ? stateToSave.studyLog : [];


            // Convertir fechas string a Timestamps ANTES de guardar
            stateToSave.decks = stateToSave.decks.map(deck => ({
                ...deck,
                cards: (Array.isArray(deck.cards) ? deck.cards : []).map(card => {
                    let nextReviewDateTS = card.nextReviewDate;
                    if (nextReviewDateTS && typeof nextReviewDateTS === 'string') {
                        try {
                            // Intentar parsear como YYYY-MM-DD y convertir a Timestamp UTC
                            const date = new Date(nextReviewDateTS + 'T00:00:00Z');
                            if (!isNaN(date.getTime())) {
                                nextReviewDateTS = Timestamp.fromDate(date);
                            } else {
                                console.warn("Fecha inválida al guardar:", nextReviewDateTS);
                                nextReviewDateTS = Timestamp.now();
                            }
                        } catch (e) {
                            console.error("Error convirtiendo fecha string a Timestamp:", nextReviewDateTS, e);
                            nextReviewDateTS = Timestamp.now();
                        }
                    } else if (!(nextReviewDateTS instanceof Timestamp)) {
                        // Si no es string ni Timestamp válido, poner ahora
                        nextReviewDateTS = Timestamp.now();
                    }
                    return { ...card, nextReviewDate: nextReviewDateTS };
                })
            }));


            const userDocRef = doc(db, "users", currentUserId);
            // Usar setDoc SIN merge para asegurar que se guarde todo el estado limpio
            await setDoc(userDocRef, stateToSave);
            console.log("Estado guardado correctamente en Firestore.");
        } catch (error) {
            console.error("Error guardando estado en Firestore: ", error);
            showNotification("Error al guardar tu progreso.");
        }
    }

    // Función para procesar datos cargados de Firestore
    function processLoadedData(data) {
        console.log("Procesando datos cargados:", data);
        const loadedState = { ...defaultState, ...data }; // Combinar con default para asegurar estructura

        // Limpiar/Resetear partes volátiles
        loadedState.pomodoro = { ...defaultState.pomodoro, ...(loadedState.pomodoro || {}) };
        loadedState.pomodoro.isRunning = false; // Timer siempre se detiene al cargar
        loadedState.pomodoro.timer = null;
        loadedState.studySession = defaultState.studySession; // Nunca restaurar sesión de estudio

        // Asegurar que arrays son arrays y convertir Timestamps
        loadedState.decks = Array.isArray(loadedState.decks) ? loadedState.decks : [];
        loadedState.tasks = Array.isArray(loadedState.tasks) ? loadedState.tasks : [];
        loadedState.studyLog = Array.isArray(loadedState.studyLog) ? loadedState.studyLog : [];

        loadedState.decks = loadedState.decks.map(deck => ({
            ...deck,
            cards: (Array.isArray(deck.cards) ? deck.cards : []).map(card => {
                let nextReviewDateStr = card.nextReviewDate;
                if (nextReviewDateStr && nextReviewDateStr.toDate) { // Convertir Timestamp a YYYY-MM-DD
                    try {
                        nextReviewDateStr = nextReviewDateStr.toDate().toISOString().split('T')[0];
                    } catch (e) { nextReviewDateStr = getTodayString(); }
                } else if (typeof nextReviewDateStr !== 'string' || isNaN(new Date(nextReviewDateStr + 'T00:00:00Z').getTime())) {
                    nextReviewDateStr = getTodayString(); // Fallback
                }
                const questionImg = card.questionImg || null;
                const answerImg = card.answerImg || null;
                return { ...card, nextReviewDate: nextReviewDateStr, questionImg, answerImg };
            })
        }));
        console.log("Estado procesado final:", loadedState);
        return loadedState;
    }


    // Listener de Firestore (onSnapshot) - Modificado para usar processLoadedData
    function listenToUserData(userId) {
        if (unsubscribeFromFirestore) unsubscribeFromFirestore();

        const userDocRef = doc(db, "users", userId);
        console.log("Estableciendo listener onSnapshot para usuario:", userId);

        unsubscribeFromFirestore = onSnapshot(userDocRef, (docSnap) => {
            console.log("Recibido snapshot de Firestore. Existe:", docSnap.exists());
            if (docSnap.exists()) {
                state = processLoadedData(docSnap.data());
            } else {
                // Documento no existe (podría ser usuario nuevo o datos borrados)
                console.log("Documento no existe en Firestore para el usuario. Usando estado por defecto.");
                state = { ...defaultState };
                 // No guardar aquí automáticamente, esperar a la primera acción del usuario
                 // saveStateToFirestore(); // Evitar posible bucle si hay problemas
            }
            render(); // Renderizar UI con el estado actualizado
            checkRunningPomodoro();
        }, (error) => {
            console.error("Error en listener onSnapshot: ", error);
            showNotification("Error al sincronizar datos. Intenta recargar.");
            // Resetear estado local si falla la escucha? Podría ser drástico.
            // state = { ...defaultState };
            // render();
        });
    }


    async function logStudyActivity() {
        const today = getTodayString();
        if (!Array.isArray(state.studyLog)) state.studyLog = [];
        if (!state.studyLog.includes(today)) {
            console.log("Registrando actividad de estudio para racha.");
            state.studyLog.push(today); // Actualizar estado local

            if (currentUserId) {
                try {
                    const userDocRef = doc(db, "users", currentUserId);
                    await updateDoc(userDocRef, { studyLog: arrayUnion(today) });
                    console.log("StudyLog actualizado en Firestore.");
                } catch(e) {
                    console.error("Error actualizando studyLog con arrayUnion: ", e);
                    await saveStateToFirestore(); // Guardar todo el estado como fallback
                }
            }
            renderStats(); // Actualizar UI
        }
    }


    // --- Lógica de Autenticación (Versión Limpia) ---
    onAuthStateChanged(auth, (user) => {
        console.log("Auth state changed. User:", user ? user.uid : 'null');
        if (user) {
            // Usuario está logueado
            currentUserId = user.uid;

            // Mostrar app, ocultar login
            if (loginView) loginView.classList.add('hidden');
            if (mainContent) mainContent.classList.remove('hidden');

            // Actualizar header dinámicamente
            updateAuthUI(user);

            // Cargar datos del usuario
            listenToUserData(currentUserId);

        } else {
            // Usuario está deslogueado
            currentUserId = null;

            // Mostrar login, ocultar app
            if (loginView) loginView.classList.remove('hidden');
            if (mainContent) mainContent.classList.add('hidden');

            // Limpiar header
            updateAuthUI(null);

            // Detener escucha de datos y resetear estado
            if (unsubscribeFromFirestore) {
                unsubscribeFromFirestore();
                unsubscribeFromFirestore = null;
            }
            state = { ...defaultState };
            render(); // Renderizar UI vacía (oculta)
        }
>>>>>>> fec937e (cambios en pomodoro y flashcards)
    });

    addTaskBtn?.addEventListener('click', addTask);
    newTaskInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addTask();
    });
    startPomodoroBtn?.addEventListener('click', startPomodoro);
    resetPomodoroBtn?.addEventListener('click', resetPomodoro);
    
    showAnswerBtn?.addEventListener('click', () => {
        document.getElementById('card-container').classList.add('flipped');
        document.getElementById('study-controls-show').classList.add('hidden');
        studyControlsRate.classList.remove('hidden');
        studyControlsRate.classList.add('flex');
    });
    finishSessionBtn?.addEventListener('click', () => navigateTo(VIEWS.DASHBOARD));
    
    backToDashboardManage?.addEventListener('click', () => navigateTo(VIEWS.DASHBOARD));
    addCardToDeckBtn?.addEventListener('click', addCardToDeck);
    deleteDeckBtn?.addEventListener('click', deleteDeck);
    
    backToDashboardQuiz?.addEventListener('click', () => navigateTo(VIEWS.DASHBOARD));
    finishQuizBtn?.addEventListener('click', () => navigateTo(VIEWS.DASHBOARD));

    onAuthStateChanged(auth, handleAuthStateChange);
    lucide.createIcons();
}

// ====================================
// AUTENTICACIÓN
// ====================================
function handleAuthStateChange(user) {
    if (user) {
        currentUserId = user.uid;
        loginView.classList.remove('active');
        loginView.classList.add('hidden');
        mainContent.classList.remove('hidden');
        updateAuthUI(user);
        listenToUserData();
    } else {
        currentUserId = null;
        loginView.classList.remove('hidden');
        loginView.classList.add('active');
        mainContent.classList.add('hidden');
        authContainer.innerHTML = '';
        if (unsubscribeFirestore) {
            unsubscribeFirestore();
            unsubscribeFirestore = null;
        }
        state = { ...defaultState };
    }
}

async function signInWithGoogle() {
    try {
        await signInWithPopup(auth, provider);
    } catch (error) {
        console.error('Error al iniciar sesión:', error);
        showNotification('Error al iniciar sesión. Por favor, intenta de nuevo.');
    }
}

async function signOutUser() {
    try {
        await signOut(auth);
    } catch (error) {
        console.error('Error al cerrar sesión:', error);
        showNotification('Error al cerrar sesión.');
    }
}

function updateAuthUI(user) {
    authContainer.innerHTML = `
        <div class="flex items-center gap-3">
            <div class="flex items-center gap-2 bg-dark-card px-4 py-2 rounded-full">
                <i data-lucide="star" class="w-5 h-5 text-yellow-400"></i>
                <span class="font-bold text-lg">${state.points}</span>
            </div>
            <img src="${user.photoURL}" alt="Profile" class="w-10 h-10 rounded-full border-2 border-primary">
            <button id="logout-btn" class="bg-dark-card hover:bg-slate-600 p-2 rounded-full transition-colors">
                <i data-lucide="log-out" class="w-5 h-5"></i>
            </button>
        </div>
    `;
    lucide.createIcons();
    document.getElementById('logout-btn')?.addEventListener('click', signOutUser);
}

// ====================================
// FIRESTORE
// ====================================
async function saveStateToFirestore() {
    if (!currentUserId || isLoadingFromFirebase) return;
    
    try {
        const dataToSave = {
            ...state,
            pomodoro: {
                duration: state.pomodoro.duration,
                breakDuration: state.pomodoro.breakDuration,
                isRunning: state.pomodoro.isRunning,
                isBreak: state.pomodoro.isBreak,
                endTime: state.pomodoro.endTime
            },
            decks: state.decks.map(deck => ({
                ...deck,
                cards: deck.cards.map(card => ({
                    ...card,
                    nextReviewDate: card.nextReviewDate ? Timestamp.fromDate(new Date(card.nextReviewDate)) : null
                }))
            })),
            lastUpdated: Timestamp.now()
        };
        
        delete dataToSave.selectedDeckId;
        delete dataToSave.currentView;
        
        await setDoc(doc(db, 'users', currentUserId), dataToSave);
    } catch (error) {
        console.error('Error guardando datos:', error);
    }
}

function processLoadedData(data) {
    if (!data) return { ...defaultState };
    
    const processed = {
        ...defaultState,
        ...data,
        decks: (data.decks || []).map(deck => ({
            ...deck,
            cards: (deck.cards || []).map(card => ({
                ...card,
                nextReviewDate: card.nextReviewDate?.toDate ? 
                    card.nextReviewDate.toDate().toISOString().split('T')[0] : 
                    card.nextReviewDate
            }))
        })),
        tasks: data.tasks || [],
        studyLog: data.studyLog || [],
        currentView: VIEWS.DASHBOARD,
        selectedDeckId: null,
        pomodoro: {
            duration: data.pomodoro?.duration || 25,
            breakDuration: data.pomodoro?.breakDuration || 5,
            isRunning: data.pomodoro?.isRunning || false,
            isBreak: data.pomodoro?.isBreak || false,
            endTime: data.pomodoro?.endTime || null
        }
    };
    
    return processed;
}

function listenToUserData() {
    if (!currentUserId) return;
    
    const userDocRef = doc(db, 'users', currentUserId);
    
    unsubscribeFirestore = onSnapshot(userDocRef, (docSnap) => {
        isLoadingFromFirebase = true;
        
        if (docSnap.exists()) {
            const wasRunning = state.pomodoro.isRunning;
            state = processLoadedData(docSnap.data());
            
            // Si el pomodoro estaba corriendo, restaurarlo
            if (state.pomodoro.isRunning && state.pomodoro.endTime) {
                const remaining = state.pomodoro.endTime - Date.now();
                if (remaining > 0 && !wasRunning) {
                    runPomodoro();
                    if (startPomodoroBtn) {
                        startPomodoroBtn.textContent = 'Pausar';
                    }
                }
            }
        } else {
            state = { ...defaultState };
            saveStateToFirestore();
        }
        
        render();
        isLoadingFromFirebase = false;
    }, (error) => {
        console.error('Error escuchando datos:', error);
        showNotification('Error al cargar datos. Por favor, recarga la página.');
        isLoadingFromFirebase = false;
    });
}

// ====================================
// RENDERIZADO
// ====================================
function render() {
    [dashboardView, studyView, manageView, quizView].forEach(view => {
        view?.classList.remove('active');
    });
    
    const currentViewElement = document.getElementById(state.currentView);
    currentViewElement?.classList.add('active');
    
    if (state.currentView === VIEWS.DASHBOARD) {
        renderDashboard();
    } else if (state.currentView === VIEWS.STUDY) {
        renderStudyView();
    } else if (state.currentView === VIEWS.MANAGE) {
        renderManageView();
    } else if (state.currentView === VIEWS.QUIZ) {
        renderQuizView();
    }
    
    if (auth.currentUser) {
        updateAuthUI(auth.currentUser);
    }
    
    lucide.createIcons();
}

function renderDashboard() {
    renderTaskList();
    renderDeckList();
    renderStats();
    updatePomodoroUI();
}

// ====================================
// POMODORO
// ====================================
function startPomodoro() {
    if (state.pomodoro.isRunning) {
        // Pausar
        state.pomodoro.isRunning = false;
        state.pomodoro.endTime = null;
        clearInterval(pomodoroInterval);
        startPomodoroBtn.textContent = 'Iniciar';
        saveStateToFirestore();
    } else {
        // Iniciar
        const duration = state.pomodoro.isBreak ? 
            state.pomodoro.breakDuration : 
            state.pomodoro.duration;
        state.pomodoro.endTime = Date.now() + (duration * 60 * 1000);
        state.pomodoro.isRunning = true;
        startPomodoroBtn.textContent = 'Pausar';
        runPomodoro();
        saveStateToFirestore();
    }
}

function runPomodoro() {
    clearInterval(pomodoroInterval);
    pomodoroInterval = setInterval(() => {
        if (!state.pomodoro.isRunning || !state.pomodoro.endTime) {
            clearInterval(pomodoroInterval);
            return;
        }
        
        const remaining = state.pomodoro.endTime - Date.now();
        
        if (remaining <= 0) {
            handlePomodoroFinish();
        } else {
            updatePomodoroDisplay(remaining);
        }
    }, 100);
}

function updatePomodoroDisplay(milliseconds) {
    const totalSeconds = Math.ceil(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (pomodoroTimer) {
        pomodoroTimer.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
}

function handlePomodoroFinish() {
    clearInterval(pomodoroInterval);
    playPomodoroSound();
    
    if (!state.pomodoro.isBreak) {
        const minutesStudied = state.pomodoro.duration;
        state.studyTimeMinutes += minutesStudied;
        state.points += 10;
        logStudyActivity();
        showNotification(`¡Pomodoro completado! +10 puntos. Toma un descanso de ${state.pomodoro.breakDuration} minutos.`);
        state.pomodoro.isBreak = true;
    } else {
        showNotification('¡Descanso terminado! Listo para otro Pomodoro.');
        state.pomodoro.isBreak = false;
    }
    
    resetPomodoro();
    saveStateToFirestore();
}

function resetPomodoro() {
    clearInterval(pomodoroInterval);
    state.pomodoro.isRunning = false;
    state.pomodoro.endTime = null;
    const duration = state.pomodoro.isBreak ? 
        state.pomodoro.breakDuration : 
        state.pomodoro.duration;
    if (pomodoroTimer) {
        pomodoroTimer.textContent = `${String(duration).padStart(2, '0')}:00`;
    }
    if (startPomodoroBtn) {
        startPomodoroBtn.textContent = 'Iniciar';
    }
    saveStateToFirestore();
}

function updatePomodoroUI() {
    const duration = state.pomodoro.isBreak ? 
        state.pomodoro.breakDuration : 
        state.pomodoro.duration;
    
    if (!state.pomodoro.isRunning) {
        if (pomodoroTimer) {
            pomodoroTimer.textContent = `${String(duration).padStart(2, '0')}:00`;
        }
        if (startPomodoroBtn) {
            startPomodoroBtn.textContent = 'Iniciar';
        }
    } else {
        if (startPomodoroBtn) {
            startPomodoroBtn.textContent = 'Pausar';
        }
    }
}

function playPomodoroSound() {
    try {
        const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTUIGGS57+mlUBELTKXh8bllHAU7k9n0wHQuBSp3xvDd');
        audio.play();
    } catch (error) {
        console.log('No se pudo reproducir el sonido');
    }
}

// ====================================
// TAREAS
// ====================================
function addTask() {
    const taskText = newTaskInput.value.trim();
    const priority = parseInt(taskPrioritySelect.value);
    
    if (!taskText) {
        showNotification('Por favor, escribe una tarea.');
        return;
    }
    
    const newTask = {
        id: Date.now().toString(),
        text: taskText,
        priority: priority,
        createdAt: new Date().toISOString()
    };
    
    state.tasks.push(newTask);
    state.tasks.sort((a, b) => a.priority - b.priority);
    
    newTaskInput.value = '';
    taskPrioritySelect.value = '3';
    
    renderTaskList();
    saveStateToFirestore();
}

function renderTaskList() {
    if (!taskList) return;
    
    if (state.tasks.length === 0) {
        taskList.innerHTML = '<p class="text-slate-400 text-center py-4">No hay tareas pendientes. ¡Añade una!</p>';
        return;
    }
    
    taskList.innerHTML = state.tasks.map(task => {
        const priorityColors = {
            1: 'border-red-500',
            2: 'border-yellow-500',
            3: 'border-green-500'
        };
        const priorityLabels = {
            1: 'Alta',
            2: 'Media',
            3: 'Baja'
        };
        
        return `
            <div class="flex items-center gap-2 bg-dark-bg border-l-4 ${priorityColors[task.priority]} rounded-lg p-3 group hover:bg-slate-700 transition-colors">
                <button data-task-id="${task.id}" data-action="complete" class="flex-shrink-0 w-6 h-6 rounded-full border-2 border-primary hover:bg-primary transition-colors"></button>
                <span class="flex-grow">${task.text}</span>
                <span class="text-xs text-slate-400 px-2 py-1 bg-dark-card rounded-full">${priorityLabels[task.priority]}</span>
                <button data-task-id="${task.id}" data-action="delete" class="flex-shrink-0 text-red-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    <i data-lucide="x" class="w-5 h-5"></i>
                </button>
            </div>
        `;
    }).join('');
    
    taskList.querySelectorAll('[data-task-id]').forEach(btn => {
        btn.addEventListener('click', handleTaskAction);
    });
    
    lucide.createIcons();
}

function handleTaskAction(e) {
    const taskId = e.currentTarget.dataset.taskId;
    const action = e.currentTarget.dataset.action;
    
    if (action === 'complete') {
        completeTask(taskId);
    } else if (action === 'delete') {
        deleteTask(taskId);
    }
}

function completeTask(taskId) {
    state.tasks = state.tasks.filter(t => t.id !== taskId);
    state.points += 5;
    logStudyActivity();
    renderTaskList();
    saveStateToFirestore();
    showNotification('¡Tarea completada! +5 puntos');
}

function deleteTask(taskId) {
    state.tasks = state.tasks.filter(t => t.id !== taskId);
    renderTaskList();
    saveStateToFirestore();
}

// ====================================
// DECKS
// ====================================
function saveNewDeck() {
    const deckName = newDeckNameInput.value.trim();
    
    if (!deckName) {
        showNotification('Por favor, escribe un nombre para el tema.');
        return;
    }
    
    const newDeck = {
        id: Date.now().toString(),
        name: deckName,
        cards: [],
        createdAt: new Date().toISOString()
    };
    
    state.decks.push(newDeck);
    newDeckNameInput.value = '';
    newDeckModal.classList.add('hidden');
    newDeckModal.classList.remove('flex');
    
    renderDeckList();
    saveStateToFirestore();
    showNotification('Tema creado exitosamente.');
}

function renderDeckList() {
    if (!deckList) return;
    
    if (state.decks.length === 0) {
        deckList.innerHTML = `
            <div class="col-span-full text-center py-8 text-slate-400">
                <p>No tienes temas de estudio. ¡Crea tu primer tema para empezar a añadir tarjetas!</p>
            </div>
        `;
        return;
    }
    
    deckList.innerHTML = state.decks.map(deck => {
        const today = getTodayString();
        const dueCards = deck.cards.filter(card => 
            !card.nextReviewDate || card.nextReviewDate <= today
        ).length;
        
        return `
            <div class="bg-dark-card p-6 rounded-2xl shadow-lg hover:shadow-xl transition-shadow">
                <h3 class="text-xl font-bold mb-2">${deck.name}</h3>
                <p class="text-slate-400 mb-4">${deck.cards.length} tarjetas</p>
                <p class="text-primary font-semibold mb-4">${dueCards} para repasar hoy</p>
                <div class="flex flex-wrap gap-2">
                    <button data-deck-id="${deck.id}" data-action="study" class="flex-grow bg-primary hover:bg-primary-dark text-dark-bg font-bold py-2 px-4 rounded-full flex items-center justify-center gap-2 ${dueCards === 0 ? 'opacity-50 cursor-not-allowed' : ''}">
                        <i data-lucide="book-open" class="w-4 h-4"></i>
                        Estudiar
                    </button>
                    <button data-deck-id="${deck.id}" data-action="quiz" class="flex-grow bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-full flex items-center justify-center gap-2 ${deck.cards.length < 4 ? 'opacity-50 cursor-not-allowed' : ''}">
                        <i data-lucide="brain" class="w-4 h-4"></i>
                        Quiz
                    </button>
                    <button data-deck-id="${deck.id}" data-action="manage" class="bg-dark-border hover:bg-slate-600 text-secondary font-bold py-2 px-4 rounded-full flex items-center justify-center gap-2">
                        <i data-lucide="settings" class="w-4 h-4"></i>
                        Gestionar
                    </button>
                </div>
            </div>
        `;
    }).join('');
    
    deckList.querySelectorAll('[data-deck-id]').forEach(btn => {
        btn.addEventListener('click', handleDeckAction);
    });
    
    lucide.createIcons();
}

function handleDeckAction(e) {
    const deckId = e.currentTarget.dataset.deckId;
    const action = e.currentTarget.dataset.action;
    const deck = state.decks.find(d => d.id === deckId);
    
    if (!deck) return;
    
    state.selectedDeckId = deckId;
    
    if (action === 'study') {
        const today = getTodayString();
        const dueCards = deck.cards.filter(card => 
            !card.nextReviewDate || card.nextReviewDate <= today
        ).length;
        
        if (dueCards === 0) {
            showNotification('No hay tarjetas para repasar hoy en este tema.');
            return;
        }
        
        startStudySession();
        navigateTo(VIEWS.STUDY);
    } else if (action === 'quiz') {
        if (deck.cards.length < 4) {
            showNotification('Necesitas al menos 4 tarjetas para hacer un quiz.');
            return;
        }
        
        startQuiz();
        navigateTo(VIEWS.QUIZ);
    } else if (action === 'manage') {
        navigateTo(VIEWS.MANAGE);
    }
}

function deleteDeck() {
    showConfirmation('¿Estás seguro de que quieres eliminar este tema? Se perderán todas las tarjetas.', () => {
        state.decks = state.decks.filter(d => d.id !== state.selectedDeckId);
        state.selectedDeckId = null;
        saveStateToFirestore();
        navigateTo(VIEWS.DASHBOARD);
        showNotification('Tema eliminado.');
    });
}

// ====================================
// TARJETAS
// ====================================
function addCardToDeck() {
    const deck = state.decks.find(d => d.id === state.selectedDeckId);
    if (!deck) return;
    
    const question = document.getElementById('new-card-question').value.trim();
    const answer = document.getElementById('new-card-answer').value.trim();
    const questionImg = document.getElementById('new-card-question-img').value.trim();
    const answerImg = document.getElementById('new-card-answer-img').value.trim();
    
    if (!question || !answer) {
        showNotification('Por favor, completa pregunta y respuesta.');
        return;
    }
    
    const newCard = {
        id: Date.now().toString(),
        question,
        answer,
        questionImg: questionImg || null,
        answerImg: answerImg || null,
        interval: 0,
        repetitions: 0,
        easeFactor: 2.5,
        nextReviewDate: getTodayString(),
        createdAt: new Date().toISOString()
    };
    
    deck.cards.push(newCard);
    
    document.getElementById('new-card-question').value = '';
    document.getElementById('new-card-answer').value = '';
    document.getElementById('new-card-question-img').value = '';
    document.getElementById('new-card-answer-img').value = '';
    
    renderCardList();
    saveStateToFirestore();
    showNotification('Tarjeta añadida exitosamente.');
}

function renderManageView() {
    const deck = state.decks.find(d => d.id === state.selectedDeckId);
    if (!deck) return;
    
    manageDeckName.textContent = deck.name;
    renderCardList();
}

function renderCardList() {
    const deck = state.decks.find(d => d.id === state.selectedDeckId);
    if (!deck || !cardList) return;
    
    if (deck.cards.length === 0) {
        cardList.innerHTML = '<p class="text-slate-400 text-center py-4">No hay tarjetas aún. ¡Añade tu primera tarjeta arriba!</p>';
        return;
    }
    
    cardList.innerHTML = deck.cards.map(card => `
        <div class="bg-dark-bg rounded-lg p-4 flex justify-between items-start group hover:bg-slate-700 transition-colors">
            <div class="flex-grow">
                <p class="font-semibold mb-1">P: ${card.question}</p>
                <p class="text-slate-400 text-sm">R: ${card.answer}</p>
                ${card.nextReviewDate ? `<p class="text-xs text-primary mt-2">Próxima revisión: ${card.nextReviewDate}</p>` : ''}
            </div>
            <button data-card-id="${card.id}" class="text-red-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity ml-4">
                <i data-lucide="trash-2" class="w-5 h-5"></i>
            </button>
        </div>
    `).join('');
    
    cardList.querySelectorAll('[data-card-id]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const cardId = e.currentTarget.dataset.cardId;
            deleteCard(cardId);
        });
    });
    
    lucide.createIcons();
}

function deleteCard(cardId) {
    const deck = state.decks.find(d => d.id === state.selectedDeckId);
    if (!deck) return;
    
    deck.cards = deck.cards.filter(c => c.id !== cardId);
    renderCardList();
    saveStateToFirestore();
}

// ====================================
// ESTUDIO (SRS)
// ====================================
function startStudySession() {
    const deck = state.decks.find(d => d.id === state.selectedDeckId);
    if (!deck) return;
    
    const today = getTodayString();
    const dueCards = deck.cards.filter(card => 
        !card.nextReviewDate || card.nextReviewDate <= today
    );
    
    studySession.cardsToReview = shuffleArray([...dueCards]);
    studySession.currentIndex = 0;
    studySession.pointsEarned = 0;
}

function renderStudyView() {
    const deck = state.decks.find(d => d.id === state.selectedDeckId);
    if (!deck) return;
    
    studyDeckName.textContent = deck.name;
    showNextCard();
}

function showNextCard() {
    if (studySession.currentIndex >= studySession.cardsToReview.length) {
        endStudySession();
        return;
    }
    
    const card = studySession.cardsToReview[studySession.currentIndex];
    const progress = ((studySession.currentIndex) / studySession.cardsToReview.length) * 100;
    
    studyProgress.textContent = `${studySession.currentIndex + 1} / ${studySession.cardsToReview.length}`;
    studyProgressBar.style.width = `${progress}%`;
    
    cardContainer.classList.remove('flipped');
    cardContainer.classList.remove('hidden');
    document.getElementById('study-controls-show').classList.remove('hidden');
    studyControlsRate.classList.add('hidden');
    studyComplete.classList.add('hidden');
    
    const cardFront = document.getElementById('card-front');
    const cardBack = document.getElementById('card-back');
    const cardFrontImg = document.getElementById('card-front-img');
    const cardBackImg = document.getElementById('card-back-img');
    
    cardFront.querySelector('p').textContent = card.question;
    cardBack.querySelector('p').textContent = card.answer;
    
    if (card.questionImg) {
        cardFrontImg.src = card.questionImg;
        cardFrontImg.classList.remove('hidden');
    } else {
        cardFrontImg.classList.add('hidden');
    }
    
    if (card.answerImg) {
        cardBackImg.src = card.answerImg;
        cardBackImg.classList.remove('hidden');
    } else {
        cardBackImg.classList.add('hidden');
    }
    
    document.querySelectorAll('.rate-btn').forEach(btn => {
        btn.replaceWith(btn.cloneNode(true));
    });
    
    document.querySelectorAll('.rate-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const difficulty = e.currentTarget.dataset.difficulty;
            processCardReview(card, difficulty);
        });
    });
}

function processCardReview(card, difficulty) {
    let nextInterval;
    let newEaseFactor = card.easeFactor;
    
    if (difficulty === 'hard') {
        nextInterval = 1;
        newEaseFactor = Math.max(1.3, card.easeFactor - 0.2);
        studySession.pointsEarned += 2;
        state.points += 2;
    } else if (difficulty === 'good') {
        if (card.repetitions === 0) {
            nextInterval = 1;
        } else if (card.repetitions === 1) {
            nextInterval = 6;
        } else {
            nextInterval = Math.round(card.interval * card.easeFactor);
        }
        studySession.pointsEarned += 5;
        state.points += 5;
    } else {
        if (card.repetitions === 0) {
            nextInterval = 4;
        } else {
            nextInterval = Math.round(card.interval * card.easeFactor * 1.3);
        }
        newEaseFactor = card.easeFactor + 0.15;
        studySession.pointsEarned += 7;
        state.points += 7;
    }
    
    const deck = state.decks.find(d => d.id === state.selectedDeckId);
    const cardInDeck = deck.cards.find(c => c.id === card.id);
    
    cardInDeck.interval = nextInterval;
    cardInDeck.repetitions = difficulty === 'hard' ? 0 : card.repetitions + 1;
    cardInDeck.easeFactor = newEaseFactor;
    
    const today = new Date();
    today.setDate(today.getDate() + nextInterval);
    cardInDeck.nextReviewDate = today.toISOString().split('T')[0];
    
    studySession.currentIndex++;
    showNextCard();
}

function endStudySession() {
    studyComplete.classList.remove('hidden');
    document.getElementById('study-controls-show').classList.add('hidden');
    studyControlsRate.classList.add('hidden');
    cardContainer.classList.add('hidden');
    
    sessionPoints.textContent = `Has ganado ${studySession.pointsEarned} puntos`;
    
    logStudyActivity();
    saveStateToFirestore();
}

// ====================================
// QUIZ
// ====================================
function startQuiz() {
    const deck = state.decks.find(d => d.id === state.selectedDeckId);
    if (!deck || deck.cards.length < 4) return;
    
    const numQuestions = Math.min(10, deck.cards.length);
    const selectedCards = shuffleArray([...deck.cards]).slice(0, numQuestions);
    
    quizSession.questions = selectedCards.map(card => generateQuizQuestion(card, deck.cards));
    quizSession.currentIndex = 0;
    quizSession.score = 0;
    quizSession.pointsEarned = 0;
}

function generateQuizQuestion(correctCard, allCards) {
    const incorrectCards = allCards
        .filter(c => c.id !== correctCard.id)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3);
    
    const options = shuffleArray([
        { text: correctCard.answer, correct: true },
        ...incorrectCards.map(c => ({ text: c.answer, correct: false }))
    ]);
    
    return {
        question: correctCard.question,
        options,
        answered: false,
        selectedOption: null
    };
}

function renderQuizView() {
    const deck = state.decks.find(d => d.id === state.selectedDeckId);
    if (!deck) return;
    
    quizDeckName.textContent = `Quiz: ${deck.name}`;
    quizResults.classList.add('hidden');
    quizContainer.classList.remove('hidden');
    showQuizQuestion();
}

function showQuizQuestion() {
    if (quizSession.currentIndex >= quizSession.questions.length) {
        showQuizResults();
        return;
    }
    
    const question = quizSession.questions[quizSession.currentIndex];
    
    quizContainer.innerHTML = `
        <div class="bg-dark-card p-6 rounded-2xl shadow-lg max-w-2xl mx-auto">
            <p class="text-sm text-slate-400 mb-4">Pregunta ${quizSession.currentIndex + 1} de ${quizSession.questions.length}</p>
            <h3 class="text-2xl font-bold mb-6">${question.question}</h3>
            <div class="space-y-3 mb-6">
                ${question.options.map((option, index) => `
                    <button class="quiz-option w-full text-left bg-dark-bg hover:bg-slate-700 p-4 rounded-lg transition-colors border-2 border-transparent" data-option-index="${index}">
                        ${option.text}
                    </button>
                `).join('')}
            </div>
            <div id="quiz-feedback" class="hidden text-center mb-4 text-lg font-semibold"></div>
            <button id="next-question-btn" class="hidden w-full bg-primary hover:bg-primary-dark text-dark-bg font-bold py-3 px-6 rounded-full">Siguiente</button>
        </div>
    `;
    
    document.querySelectorAll('.quiz-option').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const optionIndex = parseInt(e.currentTarget.dataset.optionIndex);
            handleQuizAnswer(optionIndex);
        });
    });
}

function handleQuizAnswer(optionIndex) {
    const question = quizSession.questions[quizSession.currentIndex];
    const selectedOption = question.options[optionIndex];
    
    question.answered = true;
    question.selectedOption = optionIndex;
    
    const buttons = document.querySelectorAll('.quiz-option');
    const feedback = document.getElementById('quiz-feedback');
    const nextBtn = document.getElementById('next-question-btn');
    
    // Deshabilitar todos los botones
    buttons.forEach(btn => btn.disabled = true);
    
    // Colorear opciones
    question.options.forEach((option, index) => {
        const btn = buttons[index];
        
        if (option.correct) {
            btn.classList.add('border-green-500', 'bg-green-900');
        } else if (index === optionIndex) {
            btn.classList.add('border-red-500', 'bg-red-900');
        }
    });
    
    // Mostrar feedback
    if (selectedOption.correct) {
        quizSession.score++;
        quizSession.pointsEarned += 10;
        state.points += 10;
        feedback.textContent = '¡Correcto! +10 puntos';
        feedback.className = 'text-center mb-4 text-lg font-semibold text-green-400';
    } else {
        feedback.textContent = 'Incorrecto. La respuesta correcta está marcada en verde.';
        feedback.className = 'text-center mb-4 text-lg font-semibold text-red-400';
    }
    feedback.classList.remove('hidden');
    
    // Mostrar botón siguiente
    nextBtn.classList.remove('hidden');
    nextBtn.addEventListener('click', () => {
        quizSession.currentIndex++;
        showQuizQuestion();
    });
}


function showQuizResults() {
    quizContainer.classList.add('hidden');
    quizResults.classList.remove('hidden');
    
    const percentage = Math.round((quizSession.score / quizSession.questions.length) * 100);
    quizScore.textContent = `Puntuación: ${quizSession.score} / ${quizSession.questions.length} (${percentage}%)`;
    quizPoints.textContent = `Has ganado ${quizSession.pointsEarned} puntos en este quiz`;
    
    logStudyActivity();
    saveStateToFirestore();
}

// ====================================
// ESTADÍSTICAS
// ====================================
function renderStats() {
    if (!statsStreak || !statsHours || !statsMastery) return;
    
    const streak = calculateStreak();
    const hours = (state.studyTimeMinutes / 60).toFixed(1);
    
    let totalCards = 0;
    let masteredCards = 0;
    
    state.decks.forEach(deck => {
        deck.cards.forEach(card => {
            totalCards++;
            if (card.interval >= 21) {
                masteredCards++;

      // Listener añadir tarjeta (revisado)
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

                // Convertir imágenes a Base64 si se seleccionaron
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
                    nextReviewDate: getTodayString() // String YYYY-MM-DD
                };
                deck.cards.push(newCard);
                renderManageView();
                saveStateToFirestore();
                
                // Limpiar el formulario completamente
                cardQuestionInput.value = '';
                cardAnswerInput.value = '';
                cardQuestionImgInput.value = '';
                cardAnswerImgInput.value = '';
                
                // Ocultar vistas previas
                if (previewQuestionImg) {
                    previewQuestionImg.classList.add('hidden');
                    previewQuestionImg.src = '';
                }
                if (previewAnswerImg) {
                    previewAnswerImg.classList.add('hidden');
                    previewAnswerImg.src = '';
                }
                
                showNotification("Tarjeta añadida exitosamente");
                console.log("Nueva tarjeta añadida:", newCard);
            } else {
                 console.error("No se encontró el deck actual para añadir tarjeta.");
>>>>>>> fec937e (cambios en pomodoro y flashcards)
            }
        });
    });
    
    const masteryPercentage = totalCards > 0 ? Math.round((masteredCards / totalCards) * 100) : 0;
    
    statsStreak.textContent = streak;
    statsHours.textContent = hours;
    statsMastery.textContent = `${masteryPercentage}%`;
    
    if (deckStatsList) {
        if (state.decks.length === 0) {
            deckStatsList.innerHTML = '<p class="text-center text-slate-400 py-4">Añade temas para ver tu progreso.</p>';
        } else {
            deckStatsList.innerHTML = state.decks.map(deck => {
                let deckTotal = deck.cards.length;
                let deckMastered = deck.cards.filter(c => c.interval >= 21).length;
                let deckPercentage = deckTotal > 0 ? Math.round((deckMastered / deckTotal) * 100) : 0;
                
                return `
                    <div class="flex justify-between items-center py-2 border-b border-dark-border last:border-0">
                        <span>${deck.name}</span>
                        <div class="flex items-center gap-3">
                            <span class="text-sm text-slate-400">${deckTotal} tarjetas</span>
                            <span class="font-semibold text-primary">${deckPercentage}%</span>
                        </div>
                    </div>
                `;
<<<<<<< HEAD
            }).join('');
=======
                const finishBtn = document.getElementById('finish-study-session-btn');
                if (finishBtn) {
                    finishBtn.addEventListener('click', () => {
                        navigate(VIEWS.DASHBOARD);
                        saveStateToFirestore(); // Guardar cambios al final
                    });
                }
            }
            if (typeof lucide !== 'undefined') lucide.createIcons();
            return;
        }

        // Mostrar tarjeta actual
        if (studyProgress) studyProgress.textContent = `Progreso: ${currentCardIndex + 1} / ${reviewList.length}`; // +1 para usuario
        const currentCard = reviewList[currentCardIndex];

        // Mostrar pregunta
        if (studyQuestionImg) {
            studyQuestionImg.src = currentCard.questionImg || '';
            studyQuestionImg.classList.toggle('hidden', !currentCard.questionImg);
            studyQuestionImg.onerror = () => { if(studyQuestionImg) studyQuestionImg.classList.add('hidden'); };
        }
        if (studyQuestionTextEl) studyQuestionTextEl.textContent = currentCard.question;

        // Ocultar respuesta (y pre-cargarla)
        if (studyAnswerImg) {
            studyAnswerImg.src = ''; // Limpiar src
            studyAnswerImg.classList.add('hidden');
            studyAnswerImg.onerror = () => { if(studyAnswerImg) studyAnswerImg.classList.add('hidden'); };
        }
        if (studyAnswerTextEl) {
             studyAnswerTextEl.textContent = currentCard.answer; // CORREGIDO: Cargar respuesta correcta
            if (studyAnswerTextEl.parentElement) studyAnswerTextEl.parentElement.classList.add('hidden'); // Ocultar contenedor
        }

        // Controlar visibilidad de botones
        if (studyDifficultyBtns) studyDifficultyBtns.classList.add('hidden');
        if (showAnswerBtn) showAnswerBtn.classList.remove('hidden');
        if (studyCard) studyCard.classList.remove('hidden');

        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    // Listener "Mostrar Respuesta" (revisado)
    if (showAnswerBtn) {
        showAnswerBtn.addEventListener('click', () => {
             if (!state.studySession) return;
            const { cardsToReview, currentCardIndex } = state.studySession;
             const reviewList = Array.isArray(cardsToReview) ? cardsToReview : [];
            if (currentCardIndex >= reviewList.length) return; // Salir si no hay tarjeta actual

            const currentCard = reviewList[currentCardIndex];

            // Mostrar respuesta
            if (studyAnswerImg) {
                studyAnswerImg.src = currentCard.answerImg || '';
                studyAnswerImg.classList.toggle('hidden', !currentCard.answerImg);
            }
             if (studyAnswerTextEl?.parentElement) {
                // El texto ya está cargado, solo mostrar el contenedor
                studyAnswerTextEl.parentElement.classList.remove('hidden');
            }

            // Cambiar botones
            showAnswerBtn.classList.add('hidden');
            if (studyDifficultyBtns) studyDifficultyBtns.classList.remove('hidden');
        });
    }

    // Listener botones dificultad (revisado, asegurar que deck y card existen)
     if (studyDifficultyBtns) {
        studyDifficultyBtns.addEventListener('click', (e) => {
            const difficulty = e.target.closest('button')?.dataset.difficulty;
            if (!difficulty) return;

            if (!state.studySession) return;
            const { cardsToReview, currentCardIndex } = state.studySession;
            const reviewList = Array.isArray(cardsToReview) ? cardsToReview : [];
            if (currentCardIndex >= reviewList.length) return;

            const card = reviewList[currentCardIndex];

            let { interval = 0, easeFactor = 2.5 } = card; // Usar defaults si no existen

            let nextInterval;
            let newEaseFactor = easeFactor;

            if (difficulty === 'easy') {
                nextInterval = getNextInterval(interval, 'easy');
                newEaseFactor = Math.min(3.0, newEaseFactor + 0.15);
                 if (isNaN(state.points)) state.points = 0; state.points += 3;
            } else if (difficulty === 'good') {
                nextInterval = getNextInterval(interval, 'good');
                 if (isNaN(state.points)) state.points = 0; state.points += 2;
            } else { // 'hard'
                nextInterval = 0; // Reiniciar
                newEaseFactor = Math.max(1.3, newEaseFactor - 0.2);
                 if (isNaN(state.points)) state.points = 0; state.points += 1;
            }

            // Calcular nueva fecha de revisión
            const nextReviewDate = new Date(getTodayString() + 'T00:00:00Z'); // Usar Z para UTC
             // Asegurarse que nextInterval es un número finito
            const daysToAdd = Number.isFinite(nextInterval) ? Math.round(nextInterval) : 1;
            nextReviewDate.setDate(nextReviewDate.getDate() + daysToAdd);

             // Encontrar y actualizar la tarjeta original en el estado global 'state.decks'
            const deck = state.decks?.find(d => d.id === state.currentDeckId);
            const cardInDeck = deck?.cards?.find(c => c.id === card.id);
            if (cardInDeck) {
                cardInDeck.interval = nextInterval;
                cardInDeck.easeFactor = newEaseFactor;
                cardInDeck.nextReviewDate = nextReviewDate.toISOString().split('T')[0]; // Guardar como YYYY-MM-DD
                 console.log("Tarjeta actualizada:", cardInDeck);
            } else {
                 console.warn("No se encontró la tarjeta original en el deck para actualizar:", card.id);
            }

            // Avanzar a la siguiente tarjeta en la sesión actual
            state.studySession.currentCardIndex++;
            renderStudyView(); // Mostrar siguiente o fin
             // Guardar cambios después de cada calificación
             saveStateToFirestore();
        });
    }

    // Función SM-2 simplificada (sin cambios)
    function getNextInterval(lastInterval, difficulty) {
        if (difficulty === 'hard') return Math.max(1, Math.floor(lastInterval / 2));
        if (lastInterval === 0) return (difficulty === 'easy') ? 4 : 1;
        if (lastInterval === 1) return (difficulty === 'easy') ? 7 : 3;
        let next = lastInterval * (difficulty === 'easy' ? 2.5 : 2.0);
        return Math.min(Math.round(next), 60);
    }


    // --- Lógica de Quiz (revisada para seguridad) ---
    let quizState = { questions: [], currentQuestionIndex: 0, score: 0, answered: false };

    function startQuiz() {
        if (!Array.isArray(state.decks)) state.decks = [];
        const deck = state.decks.find(d => d.id === state.currentDeckId);
        const cards = Array.isArray(deck?.cards) ? deck.cards : [];
        if (!deck || cards.length < 4) {
             showNotification("Necesitas al menos 4 tarjetas para un quiz.");
            return;
        }

        logStudyActivity(); // Loguear actividad

        const shuffledCards = [...cards].sort(() => Math.random() - 0.5);
        quizState.questions = shuffledCards.map(card => generateQuizQuestion(card, cards));
        quizState.currentQuestionIndex = 0;
        quizState.score = 0;
        quizState.answered = false;

        navigate(VIEWS.QUIZ); // Navegar a la vista
        // renderQuizView(); // render() se llamará automáticamente
    }

    // Generar pregunta de quiz (revisado placeholder)
    function generateQuizQuestion(correctCard, allCards) {
        let options = [correctCard.answer];
        const incorrectCards = allCards.filter(c => c.id !== correctCard.id);
        const shuffledIncorrect = [...incorrectCards].sort(() => Math.random() - 0.5);

        for (let i = 0; options.length < 4 && i < shuffledIncorrect.length; i++) {
             if (!options.includes(shuffledIncorrect[i].answer)) {
                 options.push(shuffledIncorrect[i].answer);
             }
        }
         // Rellenar si faltan opciones
        let fillerIndex = 1;
         while (options.length < 4) {
             const filler = `Opción ${fillerIndex++}`;
             if (!options.includes(filler)) options.push(filler);
             else options.push(Math.random().toString(16).substring(2, 8)); // fallback aleatorio
         }

        options.sort(() => Math.random() - 0.5); // Barajar

        return { question: correctCard.question, options, correctAnswer: correctCard.answer };
    }

    // Renderizar vista de quiz (revisado)
    function renderQuizView() {
        if (!Array.isArray(state.decks)) state.decks = [];
        const deck = state.decks.find(d => d.id === state.currentDeckId);
        if (!deck) { navigate(VIEWS.DASHBOARD); return; }

        if (quizDeckTitle) quizDeckTitle.textContent = `Quiz: ${deck.name}`;
        if (quizFeedback) quizFeedback.classList.add('hidden');
        if (nextQuizQuestionBtn) nextQuizQuestionBtn.classList.add('hidden');

        const { questions, currentQuestionIndex } = quizState;

        // Fin del quiz
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
                    saveStateToFirestore(); // Guardar puntos acumulados
                });
            }
             if (typeof lucide !== 'undefined') lucide.createIcons();
            return;
        }

        // Mostrar pregunta actual
        if (quizProgress) quizProgress.textContent = `Pregunta: ${currentQuestionIndex + 1} / ${questions.length}`;
        const question = questions[currentQuestionIndex];
        if (quizQuestionText) quizQuestionText.textContent = question.question;

        if (quizOptionsList) {
            quizOptionsList.innerHTML = ''; // Limpiar
            question.options.forEach(option => {
                const optionEl = document.createElement('button');
                optionEl.className = 'quiz-option w-full bg-slate-700 hover:bg-slate-600 text-slate-200 text-left p-4 rounded-lg transition-colors';
                optionEl.textContent = option;
                quizOptionsList.appendChild(optionEl);
            });
        }

        quizState.answered = false; // Permitir nueva respuesta
         if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    // Listener opciones quiz (revisado)
    if (quizOptionsList) {
        quizOptionsList.addEventListener('click', (e) => {
            const selectedOption = e.target.closest('.quiz-option');
            if (!selectedOption || quizState.answered) return;

            quizState.answered = true;
            const answer = selectedOption.textContent;
            const question = quizState.questions[quizState.currentQuestionIndex];

            // Deshabilitar y colorear opciones
            quizOptionsList.querySelectorAll('.quiz-option').forEach(btn => {
                btn.disabled = true;
                btn.classList.add('opacity-70'); // Atenuar todas
                if (btn.textContent === question.correctAnswer) {
                     btn.classList.remove('bg-slate-700', 'hover:bg-slate-600', 'opacity-70');
                     btn.classList.add('bg-green-700'); // Verde correcta
                } else if (btn === selectedOption) { // Si es la seleccionada e incorrecta
                     btn.classList.remove('bg-slate-700', 'hover:bg-slate-600', 'opacity-70');
                     btn.classList.add('bg-red-700'); // Rojo incorrecta
                }
            });

            // Dar feedback y puntos
            if (answer === question.correctAnswer) {
                if (quizFeedback) {
                    quizFeedback.textContent = '¡Correcto! +10 puntos';
                    quizFeedback.className = 'p-3 rounded-lg bg-green-900 text-green-200 mt-4';
                }
                quizState.score++;
                 if (isNaN(state.points)) state.points = 0; state.points += 10;
                 // Actualizar puntos en header al instante
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
            // NO guardar aquí, se guarda al final del quiz
        });
    }

    // Listener botón siguiente quiz (sin cambios)
    if (nextQuizQuestionBtn) {
        nextQuizQuestionBtn.addEventListener('click', () => {
            quizState.currentQuestionIndex++;
            renderQuizView();
        });
    }


    // --- Lógica del Pomodoro (sin cambios) ---
    function updatePomodoroUI() {
        if (!pomodoroTimerEl) return;
        const pom = state.pomodoro || defaultState.pomodoro;
        const timeLeft = pom.timeLeft ?? (25 * 60);
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        pomodoroTimerEl.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        if (startPomodoroBtn) startPomodoroBtn.textContent = pom.isRunning ? 'Pausar' : 'Iniciar';
        // Cambio de color de fondo
        if (pom.isBreak) { document.body.classList.add('bg-teal-900'); document.body.classList.remove('bg-slate-900'); }
        else { document.body.classList.remove('bg-teal-900'); document.body.classList.add('bg-slate-900'); }
    }
    function startPomodoro() {
        if (!state.pomodoro) state.pomodoro = { ...defaultState.pomodoro };
        if (state.pomodoro.isRunning) { 
            // PAUSAR: solo detener el timer y actualizar timeLeft
            clearInterval(state.pomodoro.timer); 
            state.pomodoro.isRunning = false;
            // Calcular el tiempo restante actual y guardarlo
            if (state.pomodoro.endTime && state.pomodoro.endTime > Date.now()) {
                state.pomodoro.timeLeft = Math.round((state.pomodoro.endTime - Date.now()) / 1000);
            }
            state.pomodoro.endTime = null; // Limpiar endTime al pausar
        }
        else {
            // INICIAR/REANUDAR: usar el timeLeft actual
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
        state.pomodoro.isRunning = false; state.pomodoro.endTime = null;
        playPomodoroSound(state.pomodoro.isBreak);
        if (state.pomodoro.isBreak) { state.pomodoro.isBreak = false; state.pomodoro.timeLeft = 25 * 60; showNotification("¡Descanso terminado!"); }
        else { state.pomodoro.isBreak = true; state.pomodoro.timeLeft = 5 * 60; if (isNaN(state.points)) state.points = 0; state.points += 25; if (isNaN(state.studyTimeMinutes)) state.studyTimeMinutes = 0; state.studyTimeMinutes += 25; logStudyActivity(); showNotification("¡Pomodoro! +25 pts. Descanso..."); }
        updatePomodoroUI();
        saveStateToFirestore();
    }
    function resetPomodoro() {
        clearInterval(state.pomodoro?.timer);
        state.pomodoro = { ...defaultState.pomodoro }; // Reset completo
        updatePomodoroUI();
        saveStateToFirestore();
    }
    function checkRunningPomodoro() {
        if (state.pomodoro?.endTime && state.pomodoro.endTime > Date.now()) { state.pomodoro.timeLeft = Math.round((state.pomodoro.endTime - Date.now()) / 1000); startPomodoro(); }
        else if (state.pomodoro?.endTime && state.pomodoro.endTime <= Date.now()) { handlePomodoroFinish(); }
    }
    if (startPomodoroBtn) startPomodoroBtn.addEventListener('click', startPomodoro);
    if (resetPomodoroBtn) resetPomodoroBtn.addEventListener('click', resetPomodoro);

    // --- Utilidades ---
    function getTodayString() { return new Date().toISOString().split('T')[0]; }
    
    // Función para convertir archivo de imagen a Base64
    function fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
            reader.readAsDataURL(file);
        });
    }
    
    function showNotification(message) { /* ... sin cambios ... */ }
    let audioCtx; function playPomodoroSound(isBreak) { /* ... sin cambios ... */ }
     // Función para mostrar modal de confirmación (simple)
    function showConfirmationModal(message, onConfirm) {
        // TODO: Implementar un modal HTML en lugar de window.confirm
        if (window.confirm(message)) {
            onConfirm();
>>>>>>> fec937e (cambios en pomodoro y flashcards)
        }
    }
}

function calculateStreak() {
    if (state.studyLog.length === 0) return 0;
    
    const sortedDates = [...state.studyLog].sort().reverse();
    const today = getTodayString();
    let streak = 0;
    
    if (sortedDates[0] !== today) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        
        if (sortedDates[0] !== yesterdayStr) {
            return 0;
        }
    }
    
    let currentDate = new Date(today);
    for (let i = 0; i < sortedDates.length; i++) {
        const dateStr = currentDate.toISOString().split('T')[0];
        
        if (sortedDates.includes(dateStr)) {
            streak++;
            currentDate.setDate(currentDate.getDate() - 1);
        } else {
            break;
        }
    }
    
    return streak;
}

function logStudyActivity() {
    const today = getTodayString();
    
    if (!state.studyLog.includes(today)) {
        state.studyLog.push(today);
    }
}

// ====================================
// NAVEGACIÓN
// ====================================
function navigateTo(view) {
    state.currentView = view;
    render();
}

// ====================================
// UTILIDADES
// ====================================
function getTodayString() {
    return new Date().toISOString().split('T')[0];
}

function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

function showNotification(message) {
    notificationText.textContent = message;
    notificationModal.classList.remove('hidden');
    notificationModal.classList.add('flex');
}

function showConfirmation(message, callback) {
    confirmText.textContent = message;
    confirmCallback = callback;
    confirmModal.classList.remove('hidden');
    confirmModal.classList.add('flex');
}