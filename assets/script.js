console.log("--- SCRIPT DE FOCUS DECK v4 CARGADO ---"); // <-- v4!

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
    getDoc // Necesario para la carga inicial robusta
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


// --- CONFIGURACIÓN DE FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyC6tqffatZ7NhMm5bGRh0kmjCLymj0DD74", // Asegúrate que esta sigue siendo tu clave correcta
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
        MANAGE: 'deck-manage-view',
        QUIZ: 'quiz-view',
    };

    // --- Elementos del DOM ---
    const views = document.querySelectorAll('.view');
    const dashboardView = document.getElementById('dashboard-view');
    const studyView = document.getElementById('study-view');
    const manageDeckView = document.getElementById('deck-manage-view');
    const quizView = document.getElementById('quiz-view');
    const authContainer = document.getElementById('auth-container');
    const loginView = document.getElementById('login-view');
    const mainContent = document.getElementById('main-content');
    const loginBtn = document.getElementById('login-btn');
    
    // Elementos del dashboard
    const pomodoroTimerEl = document.getElementById('pomodoro-timer');
    const startPomodoroBtn = document.getElementById('start-pomodoro');
    const resetPomodoroBtn = document.getElementById('reset-pomodoro');
    const taskInput = document.getElementById('new-task-input'); // CORREGIDO: era 'task-input'
    const taskPriority = document.getElementById('task-priority');
    const addTaskBtn = document.getElementById('add-task-btn');
    const taskList = document.getElementById('task-list');
    const addDeckBtn = document.getElementById('add-deck-btn');
    const deckList = document.getElementById('deck-list');
    const streakEl = document.getElementById('streak-days');
    const studyTimeEl = document.getElementById('study-time');
    const totalDomainEl = document.getElementById('total-domain');
    const domainByDeckList = document.getElementById('domain-by-deck-list');
    
    // Elementos de gestión de deck
    const manageDeckTitle = document.getElementById('manage-deck-name');
    const cardList = document.getElementById('card-list');
    const cardQuestionInput = document.getElementById('new-card-question');
    const cardAnswerInput = document.getElementById('new-card-answer');
    const cardQuestionImgInput = document.getElementById('new-card-question-img');
    const cardAnswerImgInput = document.getElementById('new-card-answer-img');
    const addCardToDeckBtn = document.getElementById('add-card-to-deck-btn');
    const deleteDeckBtn = document.getElementById('delete-deck-btn');
    
    // Elementos de estudio
    const studyDeckTitle = document.getElementById('study-deck-title');
    const studyProgress = document.getElementById('study-progress');
    const studyCard = document.getElementById('study-card');
    const cardFront = document.getElementById('card-front');
    const cardBack = document.getElementById('card-back');
    const showAnswerBtn = document.getElementById('show-answer-btn');
    const studyControlsShow = document.getElementById('study-controls-show');
    const studyControlsRate = document.getElementById('study-controls-rate');
    const studyComplete = document.getElementById('study-complete');
    const finishSessionBtn = document.getElementById('finish-session-btn');
    
    // Elementos de quiz
    const quizDeckTitle = document.getElementById('quiz-deck-name');
    const quizContainer = document.getElementById('quiz-container');
    const quizResults = document.getElementById('quiz-results');
    const finishQuizBtn = document.getElementById('finish-quiz-btn');
    
    // Modales
    const newDeckModal = document.getElementById('new-deck-modal');
    const newDeckNameInput = document.getElementById('new-deck-name');
    const saveDeckModalBtn = document.getElementById('save-deck-modal');
    const cancelDeckModalBtn = document.getElementById('cancel-deck-modal');
    const notificationModal = document.getElementById('notification-modal');
    const notificationText = document.getElementById('notification-text');
    const notificationOkBtn = document.getElementById('notification-ok-btn');

    // --- Navegación ---
    document.getElementById('back-to-dashboard-study')?.addEventListener('click', () => navigate(VIEWS.DASHBOARD));
    document.getElementById('back-to-dashboard-manage')?.addEventListener('click', () => navigate(VIEWS.DASHBOARD));
    document.getElementById('back-to-dashboard-quiz')?.addEventListener('click', () => navigate(VIEWS.DASHBOARD));

    // --- State Management & Persistence ---
    async function saveStateToFirestore() {
        if (!currentUserId) return;
        console.log("Guardando estado para:", currentUserId, state);
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
                                nextReviewDateTS = Timestamp.fromDate(new Date());
                            }
                        } catch (e) {
                            console.error("Error convirtiendo nextReviewDate a Timestamp:", e);
                            nextReviewDateTS = Timestamp.fromDate(new Date());
                        }
                    } else if (!nextReviewDateTS) {
                        nextReviewDateTS = Timestamp.fromDate(new Date());
                    }
                    return { ...card, nextReviewDate: nextReviewDateTS };
                })
            }));

            const userDocRef = doc(db, "users", currentUserId);
            await setDoc(userDocRef, stateToSave, { merge: true });
            console.log("Estado guardado exitosamente en Firestore");
        } catch (error) {
            console.error("Error guardando estado:", error);
            showNotification("Error guardando datos. Verifica tu conexión.");
        }
    }

    function processLoadedData(data) {
        console.log("Procesando datos cargados:", data);
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
                const questionImg = card.questionImg || null;
                const answerImg = card.answerImg || null;
                return { ...card, nextReviewDate: nextReviewDateStr, questionImg, answerImg };
            })
        }));
        console.log("Estado procesado final:", loadedState);
        return loadedState;
    }

    function listenToUserData(userId) {
        if (unsubscribeFromFirestore) unsubscribeFromFirestore();

        const userDocRef = doc(db, "users", userId);
        console.log("Estableciendo listener onSnapshot para usuario:", userId);

        unsubscribeFromFirestore = onSnapshot(userDocRef, (docSnap) => {
            console.log("Recibido snapshot de Firestore. Existe:", docSnap.exists());
            if (docSnap.exists()) {
                state = processLoadedData(docSnap.data());
            } else {
                console.log("Documento no existe en Firestore para el usuario. Usando estado por defecto.");
                state = { ...defaultState };
            }
            render();
            checkRunningPomodoro();
        }, (error) => {
            console.error("Error en listener onSnapshot: ", error);
            showNotification("Error al sincronizar datos. Intenta recargar.");
        });
    }

    async function logStudyActivity() {
        const today = getTodayString();
        if (!Array.isArray(state.studyLog)) state.studyLog = [];
        if (!state.studyLog.includes(today)) {
            console.log("Registrando actividad de estudio para racha.");
            state.studyLog.push(today);

            if (currentUserId) {
                try {
                    const userDocRef = doc(db, "users", currentUserId);
                    await updateDoc(userDocRef, { studyLog: arrayUnion(today) });
                    console.log("StudyLog actualizado en Firestore.");
                } catch(e) {
                    console.error("Error actualizando studyLog con arrayUnion: ", e);
                    await saveStateToFirestore();
                }
            }
            renderStats();
        }
    }

    // --- Lógica de Autenticación ---
    onAuthStateChanged(auth, (user) => {
        console.log("Auth state changed. User:", user ? user.uid : 'null');
        if (user) {
            currentUserId = user.uid;
            
            // Mostrar app, ocultar login
            if (loginView) {
                loginView.style.display = 'none';
            }
            if (mainContent) {
                mainContent.classList.remove('hidden');
            }

            updateAuthUI(user);
            listenToUserData(currentUserId);

        } else {
            currentUserId = null;
            
            // Mostrar login, ocultar app
            if (loginView) {
                loginView.style.display = 'block';
            }
            if (mainContent) {
                mainContent.classList.add('hidden');
            }

            updateAuthUI(null);

            if (unsubscribeFromFirestore) {
                unsubscribeFromFirestore();
                unsubscribeFromFirestore = null;
            }
            state = { ...defaultState };
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
            console.log("Iniciando popup de login...");
            await signInWithPopup(auth, provider);
        } catch (error) {
            console.error("Error al iniciar sesión: ", error);
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
            console.error("Error al cerrar sesión: ", error);
            showNotification("Error al cerrar sesión.");
        }
    }

    if (loginBtn) {
        loginBtn.addEventListener('click', loginWithGoogle);
    }

    // --- Lógica de la App ---
    function navigate(viewId) {
        state.currentView = viewId;
        render();
    }

    function render() {
        if (!views || !state) return;
        console.log("Renderizando vista:", state.currentView, "con estado:", state);

        views.forEach(v => v.classList.remove('active'));

        switch (state.currentView) {
            case VIEWS.DASHBOARD:
                if (dashboardView) {
                    dashboardView.classList.add('active');
                    renderDashboard();
                }
                break;
            case VIEWS.MANAGE:
                if (manageDeckView) {
                    manageDeckView.classList.add('active');
                    renderManageView();
                }
                break;
            case VIEWS.STUDY:
                if (studyView) {
                    studyView.classList.add('active');
                    renderStudyView();
                }
                break;
            case VIEWS.QUIZ:
                if (quizView) {
                    quizView.classList.add('active');
                    renderQuizView();
                }
                break;
            default:
                if (dashboardView) {
                    dashboardView.classList.add('active');
                    renderDashboard();
                }
        }

        // Actualizar puntos en el header
        const pointsDisplay = document.getElementById('points');
        if (pointsDisplay) pointsDisplay.textContent = `${state.points || 0} pts`;

        updatePomodoroUI();
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    function renderDashboard() {
        console.log("Renderizando Dashboard...");
        renderTaskList();
        renderDeckList();
        renderStats();
    }

    function renderTaskList() {
        if (!taskList) return;
        const tasks = Array.isArray(state.tasks) ? state.tasks : [];
        taskList.innerHTML = '';
        
        if (tasks.length === 0) {
            taskList.innerHTML = '<p class="text-slate-400 text-center py-4">No hay tareas</p>';
            return;
        }

        tasks.sort((a, b) => a.priority - b.priority).forEach((task, index) => {
            const taskEl = document.createElement('div');
            taskEl.className = `task-item flex items-center gap-3 p-3 bg-dark-bg rounded-lg ${task.completed ? 'opacity-60' : ''}`;
            
            const priorityColors = {
                1: 'bg-red-500',
                2: 'bg-yellow-500',
                3: 'bg-green-500'
            };
            
            taskEl.innerHTML = `
                <div class="w-3 h-3 rounded-full ${priorityColors[task.priority] || 'bg-gray-500'}"></div>
                <span class="flex-grow ${task.completed ? 'line-through text-slate-500' : ''}">${task.text}</span>
                <button class="complete-task-btn text-primary hover:text-primary-dark" data-index="${index}">
                    <i data-lucide="${task.completed ? 'rotate-ccw' : 'check'}" class="w-4 h-4"></i>
                </button>
                <button class="delete-task-btn text-red-400 hover:text-red-300" data-index="${index}">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
            `;
            taskList.appendChild(taskEl);
        });

        taskList.querySelectorAll('.complete-task-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.currentTarget.dataset.index);
                if (state.tasks[index]) {
                    state.tasks[index].completed = !state.tasks[index].completed;
                    renderTaskList();
                    saveStateToFirestore();
                }
            });
        });

        taskList.querySelectorAll('.delete-task-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.currentTarget.dataset.index);
                state.tasks.splice(index, 1);
                renderTaskList();
                saveStateToFirestore();
            });
        });
    }

    function renderDeckList() {
        if (!deckList) return;
        const decks = Array.isArray(state.decks) ? state.decks : [];
        deckList.innerHTML = '';

        if (decks.length === 0) {
            deckList.innerHTML = `
                <div class="col-span-full text-center py-8">
                    <p class="text-slate-400 mb-4">No tienes temas de estudio aún</p>
                    <p class="text-sm text-slate-500">Crea tu primer tema para comenzar</p>
                </div>
            `;
            return;
        }

        decks.forEach(deck => {
            const cards = Array.isArray(deck.cards) ? deck.cards : [];
            const totalCards = cards.length;
            const cardsToReview = cards.filter(card => card.nextReviewDate <= getTodayString()).length;
            
            const deckEl = document.createElement('div');
            deckEl.className = 'deck-card bg-dark-card p-6 rounded-2xl shadow-lg hover:shadow-xl transition-shadow cursor-pointer';
            deckEl.innerHTML = `
                <div class="flex-grow">
                    <h3 class="text-xl font-bold mb-3 leading-tight">${deck.name}</h3>
                    <div class="flex justify-between items-center text-sm text-slate-300 mb-4">
                        <span>${totalCards} tarjetas</span>
                        <span class="text-primary">${cardsToReview} por revisar</span>
                    </div>
                </div>
                <div class="flex gap-2 mt-auto">
                    <button class="study-deck-btn bg-primary hover:bg-primary-dark text-dark-bg font-semibold py-2 px-3 rounded-full text-xs" data-deck-id="${deck.id}">
                        Estudiar
                    </button>
                    <button class="manage-deck-btn bg-dark-border hover:bg-slate-600 text-secondary font-semibold py-2 px-3 rounded-full text-xs" data-deck-id="${deck.id}">
                        Gestionar
                    </button>
                    <button class="quiz-deck-btn bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-3 rounded-full text-xs" data-deck-id="${deck.id}">
                        Quiz
                    </button>
                </div>
            `;
            deckList.appendChild(deckEl);
        });

        // Event listeners para los botones
        deckList.querySelectorAll('.study-deck-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const deckId = e.currentTarget.dataset.deckId;
                startStudySession(deckId);
            });
        });

        deckList.querySelectorAll('.manage-deck-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const deckId = e.currentTarget.dataset.deckId;
                manageDeck(deckId);
            });
        });

        deckList.querySelectorAll('.quiz-deck-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const deckId = e.currentTarget.dataset.deckId;
                startQuiz(deckId);
            });
        });
    }

    function renderStats() {
        if (!streakEl || !studyTimeEl || !totalDomainEl) return;
        
        const streak = calculateStreak();
        const studyTime = (state.studyTimeMinutes || 0) / 60;
        const totalDomain = calculateTotalDomain();

        streakEl.textContent = streak;
        studyTimeEl.textContent = studyTime.toFixed(1);
        totalDomainEl.textContent = `${Math.round(totalDomain)}%`;

        if (domainByDeckList) {
            const decks = Array.isArray(state.decks) ? state.decks : [];
            domainByDeckList.innerHTML = '';

            if (decks.length === 0) {
                domainByDeckList.innerHTML = '<p class="text-slate-400">No hay temas para mostrar estadísticas</p>';
                return;
            }

            decks.forEach(deck => {
                const domain = calculateDeckDomain(deck);
                const progressEl = document.createElement('div');
                progressEl.className = 'mb-3';
                progressEl.innerHTML = `
                    <div class="flex justify-between text-sm mb-1">
                        <span>${deck.name}</span>
                        <span class="text-primary">${Math.round(domain)}%</span>
                    </div>
                    <div class="w-full bg-dark-border rounded-full h-2">
                        <div class="progress-bar-inner bg-primary h-2 rounded-full" style="width: ${domain}%"></div>
                    </div>
                `;
                domainByDeckList.appendChild(progressEl);
            });
        }
    }

    function renderManageView() {
        const deck = state.decks.find(d => d.id === state.currentDeckId);
        if (!deck || !manageDeckTitle) return;

        manageDeckTitle.textContent = deck.name;

        if (cardList) {
            const cards = Array.isArray(deck.cards) ? deck.cards : [];
            cardList.innerHTML = '';

            if (cards.length === 0) {
                cardList.innerHTML = '<p class="text-slate-400 text-center py-4">No hay tarjetas en este tema</p>';
                return;
            }

            cards.forEach((card, index) => {
                const cardEl = document.createElement('div');
                cardEl.className = 'card-item bg-dark-bg p-4 rounded-lg';
                cardEl.innerHTML = `
                    <div class="flex justify-between items-start">
                        <div class="flex-grow">
                            <p class="font-semibold mb-1">${card.question}</p>
                            <p class="text-sm text-slate-400">${card.answer}</p>
                            <p class="text-xs text-slate-500 mt-2">Próxima revisión: ${card.nextReviewDate}</p>
                        </div>
                        <button class="delete-card-btn text-red-400 hover:text-red-300 ml-3" data-index="${index}">
                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                        </button>
                    </div>
                `;
                cardList.appendChild(cardEl);
            });

            cardList.querySelectorAll('.delete-card-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const index = parseInt(e.currentTarget.dataset.index);
                    deck.cards.splice(index, 1);
                    renderManageView();
                    saveStateToFirestore();
                });
            });
        }
    }

    function renderStudyView() {
        const deck = state.decks.find(d => d.id === state.currentDeckId);
        if (!deck) return;

        if (studyDeckTitle) studyDeckTitle.textContent = `Estudiando: ${deck.name}`;

        const { cardsToReview, currentCardIndex } = state.studySession;

        if (currentCardIndex >= cardsToReview.length) {
            showStudyComplete();
            return;
        }

        const card = cardsToReview[currentCardIndex];
        if (!card) return;

        if (studyProgress) {
            studyProgress.textContent = `Tarjeta ${currentCardIndex + 1} de ${cardsToReview.length}`;
        }

        // Mostrar la tarjeta
        if (cardFront && cardBack) {
            const frontText = cardFront.querySelector('p');
            const backText = cardBack.querySelector('p');
            const frontImg = document.getElementById('card-front-img');
            const backImg = document.getElementById('card-back-img');

            if (frontText) frontText.textContent = card.question;
            if (backText) backText.textContent = card.answer;
            
            if (frontImg && card.questionImg) {
                frontImg.src = card.questionImg;
                frontImg.classList.remove('hidden');
            } else if (frontImg) {
                frontImg.classList.add('hidden');
            }

            if (backImg && card.answerImg) {
                backImg.src = card.answerImg;
                backImg.classList.remove('hidden');
            } else if (backImg) {
                backImg.classList.add('hidden');
            }
        }

        // Reset card flip
        if (studyCard) {
            studyCard.classList.remove('flipped');
        }

        // Show/hide controls
        if (studyControlsShow) studyControlsShow.classList.remove('hidden');
        if (studyControlsRate) studyControlsRate.classList.add('hidden');
        if (studyComplete) studyComplete.classList.add('hidden');
    }

    function renderQuizView() {
        // Implementación básica del quiz
        const deck = state.decks.find(d => d.id === state.currentDeckId);
        if (!deck || !quizDeckTitle) return;

        quizDeckTitle.textContent = `Quiz: ${deck.name}`;
        
        if (quizContainer) {
            quizContainer.innerHTML = '<p class="text-center text-slate-400">Quiz en desarrollo...</p>';
        }
    }

    // --- Funciones auxiliares ---
    function getTodayString() {
        return new Date().toISOString().split('T')[0];
    }

    function calculateStreak() {
        if (!Array.isArray(state.studyLog) || state.studyLog.length === 0) return 0;
        
        const sortedLog = [...state.studyLog].sort().reverse();
        const today = getTodayString();
        let streak = 0;
        
        for (let i = 0; i < sortedLog.length; i++) {
            const expectedDate = new Date();
            expectedDate.setDate(expectedDate.getDate() - i);
            const expectedDateStr = expectedDate.toISOString().split('T')[0];
            
            if (sortedLog[i] === expectedDateStr) {
                streak++;
            } else {
                break;
            }
        }
        
        return streak;
    }

    function calculateTotalDomain() {
        const decks = Array.isArray(state.decks) ? state.decks : [];
        if (decks.length === 0) return 0;
        
        const totalDomain = decks.reduce((sum, deck) => sum + calculateDeckDomain(deck), 0);
        return totalDomain / decks.length;
    }

    function calculateDeckDomain(deck) {
        const cards = Array.isArray(deck.cards) ? deck.cards : [];
        if (cards.length === 0) return 0;
        
        const masteredCards = cards.filter(card => (card.reviewCount || 0) >= 3 && (card.difficulty || 0) <= 1).length;
        return (masteredCards / cards.length) * 100;
    }

    function showNotification(message) {
        if (notificationText) notificationText.textContent = message;
        if (notificationModal) notificationModal.classList.remove('hidden');
    }

    // --- Event Listeners ---
    
    // Tareas
    if (addTaskBtn && taskInput) {
        addTaskBtn.addEventListener('click', () => {
            const text = taskInput.value.trim();
            const priority = parseInt(taskPriority?.value || 3);
            
            if (text) {
                if (!Array.isArray(state.tasks)) state.tasks = [];
                state.tasks.push({
                    id: Date.now(),
                    text: text,
                    priority: priority,
                    completed: false,
                    createdAt: new Date().toISOString()
                });
                taskInput.value = '';
                renderTaskList();
                saveStateToFirestore();
            }
        });

        taskInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                addTaskBtn.click();
            }
        });
    }

    // Decks
    if (addDeckBtn) {
        addDeckBtn.addEventListener('click', () => {
            if (newDeckModal) newDeckModal.classList.remove('hidden');
        });
    }

    if (saveDeckModalBtn && newDeckNameInput) {
        saveDeckModalBtn.addEventListener('click', () => {
            const name = newDeckNameInput.value.trim();
            if (name) {
                if (!Array.isArray(state.decks)) state.decks = [];
                state.decks.push({
                    id: Date.now().toString(),
                    name: name,
                    cards: [],
                    createdAt: new Date().toISOString()
                });
                newDeckNameInput.value = '';
                if (newDeckModal) newDeckModal.classList.add('hidden');
                renderDeckList();
                saveStateToFirestore();
            }
        });
    }

    if (cancelDeckModalBtn) {
        cancelDeckModalBtn.addEventListener('click', () => {
            if (newDeckModal) newDeckModal.classList.add('hidden');
            if (newDeckNameInput) newDeckNameInput.value = '';
        });
    }

    // Gestión de tarjetas
    if (addCardToDeckBtn) {
        addCardToDeckBtn.addEventListener('click', () => {
            const question = cardQuestionInput?.value.trim();
            const answer = cardAnswerInput?.value.trim();
            const questionImg = cardQuestionImgInput?.value.trim() || null;
            const answerImg = cardAnswerImgInput?.value.trim() || null;

            if (question && answer) {
                const deck = state.decks.find(d => d.id === state.currentDeckId);
                if (deck) {
                    if (!Array.isArray(deck.cards)) deck.cards = [];
                    deck.cards.push({
                        id: Date.now().toString(),
                        question: question,
                        answer: answer,
                        questionImg: questionImg,
                        answerImg: answerImg,
                        nextReviewDate: getTodayString(),
                        reviewCount: 0,
                        difficulty: 0,
                        createdAt: new Date().toISOString()
                    });
                    
                    // Limpiar inputs
                    if (cardQuestionInput) cardQuestionInput.value = '';
                    if (cardAnswerInput) cardAnswerInput.value = '';
                    if (cardQuestionImgInput) cardQuestionImgInput.value = '';
                    if (cardAnswerImgInput) cardAnswerImgInput.value = '';
                    
                    renderManageView();
                    saveStateToFirestore();
                    showNotification('Tarjeta añadida exitosamente');
                }
            }
        });
    }

    if (deleteDeckBtn) {
        deleteDeckBtn.addEventListener('click', () => {
            if (confirm('¿Estás seguro de que quieres eliminar este tema? Esta acción no se puede deshacer.')) {
                const deckIndex = state.decks.findIndex(d => d.id === state.currentDeckId);
                if (deckIndex !== -1) {
                    state.decks.splice(deckIndex, 1);
                    navigate(VIEWS.DASHBOARD);
                    saveStateToFirestore();
                    showNotification('Tema eliminado');
                }
            }
        });
    }

    // Estudio
    if (showAnswerBtn) {
        showAnswerBtn.addEventListener('click', () => {
            if (studyCard) studyCard.classList.add('flipped');
            if (studyControlsShow) studyControlsShow.classList.add('hidden');
            if (studyControlsRate) studyControlsRate.classList.remove('hidden');
        });
    }

    if (studyControlsRate) {
        studyControlsRate.addEventListener('click', (e) => {
            const btn = e.target.closest('.rate-btn');
            if (!btn) return;

            const difficulty = btn.dataset.difficulty;
            const { cardsToReview, currentCardIndex } = state.studySession;
            const card = cardsToReview[currentCardIndex];

            if (card) {
                // Actualizar estadísticas de la tarjeta
                card.reviewCount = (card.reviewCount || 0) + 1;
                
                // Calcular próxima fecha de revisión
                let daysToAdd = 1;
                switch (difficulty) {
                    case 'easy':
                        daysToAdd = 7;
                        card.difficulty = Math.max(0, (card.difficulty || 0) - 1);
                        if (isNaN(state.points)) state.points = 0;
                        state.points += 15;
                        break;
                    case 'good':
                        daysToAdd = 3;
                        if (isNaN(state.points)) state.points = 0;
                        state.points += 10;
                        break;
                    case 'hard':
                        daysToAdd = 1;
                        card.difficulty = (card.difficulty || 0) + 1;
                        if (isNaN(state.points)) state.points = 0;
                        state.points += 5;
                        break;
                }

                const nextDate = new Date();
                nextDate.setDate(nextDate.getDate() + daysToAdd);
                card.nextReviewDate = nextDate.toISOString().split('T')[0];

                // Actualizar puntos en header
                const pointsDisplay = document.getElementById('points');
                if (pointsDisplay) pointsDisplay.textContent = `${state.points} pts`;

                // Pasar a la siguiente tarjeta
                state.studySession.currentCardIndex++;
                renderStudyView();
                
                // Registrar actividad
                logStudyActivity();
                saveStateToFirestore();
            }
        });
    }

    if (finishSessionBtn) {
        finishSessionBtn.addEventListener('click', () => {
            navigate(VIEWS.DASHBOARD);
        });
    }

    // Modales
    if (notificationOkBtn) {
        notificationOkBtn.addEventListener('click', () => {
            if (notificationModal) notificationModal.classList.add('hidden');
        });
    }

    // Pomodoro
    function updatePomodoroUI() {
        if (!pomodoroTimerEl) return;
        const pom = state.pomodoro || defaultState.pomodoro;
        const timeLeft = pom.timeLeft ?? (25 * 60);
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        pomodoroTimerEl.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        if (startPomodoroBtn) startPomodoroBtn.textContent = pom.isRunning ? 'Pausar' : 'Iniciar';
    }

    function startPomodoro() {
        if (!state.pomodoro) state.pomodoro = { ...defaultState.pomodoro };
        if (state.pomodoro.isRunning) {
            clearInterval(state.pomodoro.timer);
            state.pomodoro.isRunning = false;
        } else {
            state.pomodoro.isRunning = true;
            state.pomodoro.endTime = state.pomodoro.endTime && state.pomodoro.endTime > Date.now() ? 
                state.pomodoro.endTime : Date.now() + (state.pomodoro.timeLeft * 1000);
            
            if (state.pomodoro.endTime > Date.now()) {
                state.pomodoro.timeLeft = Math.round((state.pomodoro.endTime - Date.now()) / 1000);
            }
            
            state.pomodoro.timer = setInterval(() => {
                const timeLeftMs = (state.pomodoro.endTime || 0) - Date.now();
                if (timeLeftMs <= 0) {
                    handlePomodoroFinish();
                } else {
                    state.pomodoro.timeLeft = Math.round(timeLeftMs / 1000);
                }
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
            showNotification("¡Pomodoro completado! +25 pts. Tiempo de descanso...");
            
            // Actualizar puntos en header
            const pointsDisplay = document.getElementById('points');
            if (pointsDisplay) pointsDisplay.textContent = `${state.points} pts`;
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
            startPomodoro();
        } else if (state.pomodoro?.endTime && state.pomodoro.endTime <= Date.now()) {
            handlePomodoroFinish();
        }
    }

    if (startPomodoroBtn) startPomodoroBtn.addEventListener('click', startPomodoro);
    if (resetPomodoroBtn) resetPomodoroBtn.addEventListener('click', resetPomodoro);

    // --- Funciones de navegación ---
    function manageDeck(deckId) {
        state.currentDeckId = deckId;
        navigate(VIEWS.MANAGE);
    }

    function startStudySession(deckId) {
        const deck = state.decks.find(d => d.id === deckId);
        if (!deck) return;

        const cardsToReview = deck.cards.filter(card => 
            card.nextReviewDate <= getTodayString()
        );

        if (cardsToReview.length === 0) {
            showNotification('No hay tarjetas para revisar hoy en este tema.');
            return;
        }

        state.currentDeckId = deckId;
        state.studySession = {
            cardsToReview: cardsToReview,
            currentCardIndex: 0,
            correctAnswers: 0
        };

        navigate(VIEWS.STUDY);
    }

    function startQuiz(deckId) {
        state.currentDeckId = deckId;
        navigate(VIEWS.QUIZ);
    }

    function showStudyComplete() {
        if (studyControlsShow) studyControlsShow.classList.add('hidden');
        if (studyControlsRate) studyControlsRate.classList.add('hidden');
        if (studyComplete) {
            studyComplete.classList.remove('hidden');
            const sessionPoints = studyComplete.querySelector('#session-points');
            if (sessionPoints) {
                const points = state.studySession.cardsToReview.length * 10;
                sessionPoints.textContent = `¡Has ganado ${points} puntos en esta sesión!`;
            }
        }
    }

});