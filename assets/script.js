console.log("--- SCRIPT DE FOCUS DECK v2 CARGADO ---"); // <-- ¡NUEVA LÍNEA DE PRUEBA!

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
    arrayUnion
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

    // --- Elementos del DOM ---
    // Vistas
    const views = document.querySelectorAll('.view');
    const dashboardView = document.getElementById('dashboard-view');
    const studyView = document.getElementById('study-view');
    const manageDeckView = document.getElementById('manage-deck-view');
    const quizView = document.getElementById('quiz-view');
    
    // Autenticación (¡REFERENCIAS CLAVE!)
    const authContainer = document.getElementById('auth-container');
    const loginView = document.getElementById('login-view');
    const mainContent = document.getElementById('main-content');
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const userProfilePic = document.getElementById('user-profile-pic');
    const pointsContainer = document.getElementById('points-container'); // Para ocultar puntos
    
    // --- Pomodoro ---
    const pomodoroTimerEl = document.getElementById('pomodoro-timer');
    const startPomodoroBtn = document.getElementById('start-pomodoro-btn');
    const resetPomodoroBtn = document.getElementById('reset-pomodoro-btn');

    // --- Tareas ---
    const taskInput = document.getElementById('task-input');
    const taskPriority = document.getElementById('task-priority');
    const addTaskBtn = document.getElementById('add-task-btn');
    const taskList = document.getElementById('task-list');

    // --- Puntos ---
    const pointsEl = document.getElementById('points');

    // --- Temas (Decks) ---
    const newDeckBtn = document.getElementById('new-deck-btn');
    const deckList = document.getElementById('deck-list');
    const noDecksMessage = document.getElementById('no-decks-message');

    // --- Estadísticas ---
    const streakEl = document.getElementById('streak-days');
    const studyTimeEl = document.getElementById('study-time');
    const totalDomainEl = document.getElementById('total-domain');
    const domainByDeckList = document.getElementById('domain-by-deck-list');

    // --- Gestionar Tema (Manage) ---
    const manageDeckTitle = document.getElementById('manage-deck-title');
    const cardList = document.getElementById('card-list');
    const addCardForm = document.getElementById('add-card-form');
    const cardQuestionInput = document.getElementById('card-question');
    const cardAnswerInput = document.getElementById('card-answer');
    const cardQuestionImgInput = document.getElementById('card-question-img');
    const cardAnswerImgInput = document.getElementById('card-answer-img');
    const saveCardBtn = document.getElementById('save-card-btn');
    const deleteDeckBtn = document.getElementById('delete-deck-btn');
    
    // --- Sesión de Estudio (Study) ---
    const studyDeckTitle = document.getElementById('study-deck-title');
    const studyProgress = document.getElementById('study-progress');
    const studyCard = document.getElementById('study-card');
    const studyQuestionImg = document.getElementById('study-question-img');
    const studyQuestionTextEl = document.getElementById('study-question-text');
    const studyAnswerImg = document.getElementById('study-answer-img');
    const studyAnswerTextEl = document.getElementById('study-answer-text');
    const showAnswerBtn = document.getElementById('show-answer-btn');
    const studyDifficultyBtns = document.getElementById('study-difficulty-btns');

    // --- Quiz ---
    const quizDeckTitle = document.getElementById('quiz-deck-title');
    const quizProgress = document.getElementById('quiz-progress');
    const quizQuestionText = document.getElementById('quiz-question-text');
    const quizOptionsList = document.getElementById('quiz-options');
    const quizFeedback = document.getElementById('quiz-feedback');
    const nextQuizQuestionBtn = document.getElementById('next-quiz-question-btn');
    
    // --- Notificaciones ---
    const notification = document.getElementById('notification');

    // --- Navegación ---
    document.getElementById('back-to-dashboard-study').addEventListener('click', () => navigate(VIEWS.DASHBOARD));
    document.getElementById('back-to-dashboard-manage').addEventListener('click', () => navigate(VIEWS.DASHBOARD));
    document.getElementById('back-to-dashboard-quiz').addEventListener('click', () => navigate(VIEWS.DASHBOARD));


    // --- State Management & Persistence ---
    
    async function saveStateToFirestore() {
        if (!currentUserId) {
            console.warn("Intento de guardado sin usuario logueado.");
            return;
        }
        try {
            const stateToSave = { ...state };
            if (stateToSave.pomodoro) {
                 delete stateToSave.pomodoro.timer; 
            }
            stateToSave.studySession = defaultState.studySession;

            if (stateToSave.decks) {
                stateToSave.decks.forEach(deck => {
                    if (deck.cards) {
                        deck.cards.forEach(card => {
                            if (card.nextReviewDate && !(card.nextReviewDate instanceof Timestamp)) {
                                try {
                                    const date = new Date(card.nextReviewDate + 'T00:00:00');
                                    if (!isNaN(date.getTime())) {
                                        card.nextReviewDate = Timestamp.fromDate(date);
                                    } else {
                                        card.nextReviewDate = Timestamp.now();
                                    }
                                } catch(e) {
                                    console.error("Error convirtiendo fecha:", card.nextReviewDate, e);
                                    card.nextReviewDate = Timestamp.now();
                                }
                            } else if (!card.nextReviewDate) {
                                card.nextReviewDate = Timestamp.now();
                            }
                        });
                    }
                });
            }
            
            const userDocRef = doc(db, "users", currentUserId);
            await setDoc(userDocRef, stateToSave, { merge: true });
        } catch (error) {
            console.error("Error guardando estado en Firestore: ", error);
            showNotification("Error al guardar tu progreso. Revisa tu conexión.");
        }
    }

    function listenToUserData(userId) {
        if (unsubscribeFromFirestore) {
            unsubscribeFromFirestore();
        }
        
        const userDocRef = doc(db, "users", userId);
        
        unsubscribeFromFirestore = onSnapshot(userDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const firestoreData = docSnap.data();
                state = { ...defaultState, ...firestoreData };

                // --- MIGRACIÓN DE DATOS ---
                const defaultPomodoro = { timer: null, timeLeft: 25 * 60, isBreak: false, isRunning: false, endTime: null };
                state.pomodoro = { ...defaultPomodoro, ...(state.pomodoro || {}) };
                if (state.pomodoro.isRunning) {
                    state.pomodoro.isRunning = false; 
                }
                
                state.studySession = defaultState.studySession; 
                
                if (state.decks) {
                    state.decks.forEach(deck => {
                        if (deck.cards) {
                            deck.cards.forEach(card => {
                                card.questionImg = card.questionImg || null;
                                card.answerImg = card.answerImg || null;
                                if (card.nextReviewDate && card.nextReviewDate.toDate) {
                                    card.nextReviewDate = card.nextReviewDate.toDate().toISOString().split('T')[0];
                                } else if (!card.nextReviewDate) {
                                    card.nextReviewDate = getTodayString();
                                }
                            });
                        }
                    });
                }
                
            } else {
                console.log("Usuario nuevo, creando documento...");
                state = { ...defaultState };
                saveStateToFirestore(); 
            }
            
            render();
            checkRunningPomodoro();
            
        }, (error) => {
            console.error("Error escuchando datos de Firestore: ", error);
            showNotification("Error al cargar tus datos. Intenta recargar la página.");
        });
    }
    
    async function logStudyActivity() {
        const today = getTodayString();
        if (!state.studyLog.includes(today)) {
            console.log("Registrando actividad de estudio para la racha de hoy.");
            state.studyLog.push(today);
            
            if (currentUserId) {
                try {
                    const userDocRef = doc(db, "users", currentUserId);
                    await updateDoc(userDocRef, {
                        studyLog: arrayUnion(today)
                    });
                } catch(e) {
                    console.error("Error actualizando studyLog: ", e);
                    await saveStateToFirestore();
                }
            }
            renderStats();
        }
    }


    // --- Lógica de Autenticación (¡CORREGIDA!) ---

    /**
     * Maneja el estado de autenticación del usuario.
     */
    onAuthStateChanged(auth, (user) => {
        if (user) {
            // Usuario está logueado
            currentUserId = user.uid;
            console.log("Usuario logueado:", currentUserId);
            
            // --- ¡CORRECCIÓN DOBLE! ---
            // Ocultamos el modal de login Y la vista de login (para estar 100% seguros)
            if (authContainer) authContainer.classList.add('hidden');
            if (loginView) loginView.classList.add('hidden');

            // Mostramos la app principal
            if (mainContent) mainContent.classList.remove('hidden');
            
            // Mostramos la info del usuario en el header
            if (user.photoURL) {
                userProfilePic.src = user.photoURL;
                userProfilePic.classList.remove('hidden');
            }
            if (logoutBtn) logoutBtn.classList.remove('hidden');
            if (pointsContainer) pointsContainer.classList.remove('hidden'); // Mostrar puntos

            // Empezamos a escuchar los datos de ESTE usuario
            listenToUserData(currentUserId);
            
        } else {
            // Usuario está deslogueado
            currentUserId = null;
            console.log("Usuario deslogueado.");

            // --- ¡CORRECCIÓN DOBLE! ---
            // Mostramos el modal de login Y la vista de login
            if (authContainer) authContainer.classList.remove('hidden');
            if (loginView) loginView.classList.remove('hidden');

            // Ocultamos la app principal
            if (mainContent) mainContent.classList.add('hidden');
            
            // Ocultamos info de usuario en el header
            if (userProfilePic) userProfilePic.classList.add('hidden');
            if (logoutBtn) logoutBtn.classList.add('hidden');
            if (pointsContainer) pointsContainer.classList.add('hidden'); // Ocultar puntos
            
            // Dejamos de escuchar datos
            if (unsubscribeFromFirestore) {
                unsubscribeFromFirestore();
                unsubscribeFromFirestore = null;
            }
            
            // Reseteamos el estado al por defecto
            state = { ...defaultState };
            render(); // Renderizará un dashboard vacío (que está oculto)
        }
    });

    /**
     * Inicia el pop-up de login con Google
     */
    if (loginBtn) {
        loginBtn.addEventListener('click', async () => {
            const provider = new GoogleAuthProvider();
            try {
                await signInWithPopup(auth, provider);
                // onAuthStateChanged se encargará del resto
            } catch (error) {
                console.error("Error al iniciar sesión: ", error);
                if (error.code !== 'auth/popup-closed-by-user') {
                    showNotification("Error al iniciar sesión. Inténtalo de nuevo.");
                }
            }
        });
    }

    /**
     * Cierra la sesión del usuario
     */
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                await signOut(auth);
                // onAuthStateChanged se encargará del resto
            } catch (error) {
                console.error("Error al cerrar sesión: ", error);
                showNotification("Error al cerrar sesión.");
            }
        });
    }


    // --- Lógica de la App ---

    function navigate(viewId) {
        state.currentView = viewId;
        render();
    }

    function render() {
        if (!views) return;
        views.forEach(v => v.classList.add('hidden'));

        switch (state.currentView) {
            case VIEWS.DASHBOARD:
                if (dashboardView) dashboardView.classList.remove('hidden');
                renderDashboard();
                break;
            case VIEWS.MANAGE:
                if (manageDeckView) manageDeckView.classList.remove('hidden');
                renderManageView();
                break;
            case VIEWS.STUDY:
                if (studyView) studyView.classList.remove('hidden');
                renderStudyView();
                break;
            case VIEWS.QUIZ:
                if (quizView) quizView.classList.remove('hidden');
                renderQuizView();
                break;
            default:
                if (dashboardView) dashboardView.classList.remove('hidden');
                renderDashboard();
        }
        
        if (pointsEl) pointsEl.textContent = state.points;
        updatePomodoroUI();
        if (lucide) lucide.createIcons();
    }

    // --- Render Dashboard ---
    function renderDashboard() {
        renderTaskList();
        renderDeckList();
        renderStats();
    }

    // --- Lógica de Tareas ---
    function renderTaskList() {
        if (!taskList) return;
        taskList.innerHTML = '';
        if (!state.tasks || state.tasks.length === 0) {
            taskList.innerHTML = '<p class="text-sm text-slate-400 px-3">No hay tareas pendientes. ¡Añade una!</p>';
            return;
        }

        const priorityOrder = { 'Alta': 3, 'Media': 2, 'Baja': 1 };
        const sortedTasks = [...state.tasks].sort((a, b) => {
            if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
                return priorityOrder[b.priority] - priorityOrder[a.priority];
            }
            return b.id - a.id;
        });

        sortedTasks.forEach(task => {
            const taskEl = document.createElement('div');
            const priorityColor = {
                'Alta': 'border-red-500',
                'Media': 'border-yellow-500',
                'Baja': 'border-teal-500',
            }[task.priority];

            taskEl.className = `flex items-center justify-between p-3 bg-slate-800 rounded-lg border-l-4 ${priorityColor} mb-2 group`;
            taskEl.innerHTML = `
                <div class="flex items-center">
                    <button data-task-id="${task.id}" class="complete-task-btn p-1 text-slate-400 hover:text-white mr-3">
                        <i data-lucide="circle" class="w-5 h-5"></i>
                    </button>
                    <span class="text-slate-200">${task.text}</span>
                </div>
                <button data-task-id="${task.id}" class="delete-task-btn p-1 text-slate-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
            `;
            taskList.appendChild(taskEl);
        });
    }

    if (addTaskBtn) {
        addTaskBtn.addEventListener('click', () => {
            const text = taskInput.value.trim();
            const priority = taskPriority.value;
            if (text) {
                if (!state.tasks) state.tasks = [];
                state.tasks.push({
                    id: Date.now(),
                    text,
                    priority,
                    completed: false
                });
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
                state.tasks = state.tasks.filter(t => t.id !== taskId);
                state.points += 10;
                logStudyActivity();
                render();
                saveStateToFirestore();
                showNotification("¡Tarea completada! +10 puntos");
            }

            if (deleteBtn) {
                const taskId = Number(deleteBtn.dataset.taskId);
                state.tasks = state.tasks.filter(t => t.id !== taskId);
                renderTaskList();
                saveStateToFirestore();
            }
        });
    }

    // --- Lógica de Temas (Decks) ---
    function renderDeckList() {
        if (!deckList || !noDecksMessage) return;
        deckList.innerHTML = '';
        if (!state.decks || state.decks.length === 0) {
            noDecksMessage.classList.remove('hidden');
            return;
        }
        
        noDecksMessage.classList.add('hidden');
        const today = getTodayString();

        state.decks.forEach(deck => {
            const cardsToReview = deck.cards.filter(c => c.nextReviewDate <= today).length;
            const deckEl = document.createElement('div');
            deckEl.className = 'bg-slate-800 p-5 rounded-lg shadow-lg flex flex-col justify-between';
            deckEl.innerHTML = `
                <div>
                    <h3 class="text-xl font-bold text-white truncate mb-2">${deck.name}</h3>
                    <p class="text-sm text-slate-400 mb-4">${deck.cards.length} tarjeta(s)</p>
                    ${cardsToReview > 0 
                        ? `<span class="inline-block bg-teal-600 text-teal-100 text-xs font-semibold px-2 py-1 rounded-full mb-4">${cardsToReview} para repasar hoy</span>`
                        : `<span class="inline-block bg-slate-700 text-slate-300 text-xs font-semibold px-2 py-1 rounded-full mb-4">¡Al día!</span>`
                    }
                </div>
                <div class="flex gap-2">
                    <button data-deck-id="${deck.id}" class="study-deck-btn flex-1 bg-teal-600 hover:bg-teal-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors ${cardsToReview === 0 ? 'opacity-50 cursor-not-allowed' : ''}" ${cardsToReview === 0 ? 'disabled' : ''}>
                        Estudiar
                    </button>
                    <button data-deck-id="${deck.id}" class="quiz-deck-btn flex-1 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors ${deck.cards.length < 4 ? 'opacity-50 cursor-not-allowed' : ''}" ${deck.cards.length < 4 ? 'disabled' : ''}>
                        Quiz
                    </button>
                    <button data-deck-id="${deck.id}" class="manage-deck-btn bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 px-3 rounded-lg transition-colors">
                        <i data-lucide="settings-2" class="w-5 h-5"></i>
                    </button>
                </div>
            `;
            deckList.appendChild(deckEl);
        });
    }

    if (newDeckBtn) {
        newDeckBtn.addEventListener('click', () => {
            const deckName = prompt("Introduce el nombre del nuevo tema:");
            if (deckName && deckName.trim()) {
                if (!state.decks) state.decks = [];
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
                navigate(VIEWS.QUIZ);
            }
            if (manageBtn) {
                state.currentDeckId = manageBtn.dataset.deckId;
                navigate(VIEWS.MANAGE);
            }
        });
    }
    
    // --- Lógica de Estadísticas ---
    function renderStats() {
        if (!streakEl || !studyTimeEl || !totalDomainEl || !domainByDeckList) return;
        
        const today = getTodayString();
        const streak = calculateStreak(today, state.studyLog || []);
        streakEl.textContent = streak;

        const totalHours = ((state.studyTimeMinutes || 0) / 60).toFixed(1);
        studyTimeEl.textContent = totalHours;

        let totalCards = 0;
        let totalMasteredCards = 0;
        domainByDeckList.innerHTML = '';

        if (!state.decks || state.decks.length === 0) {
            domainByDeckList.innerHTML = '<p class="text-sm text-slate-400 px-3">Añade temas para ver tu progreso.</p>';
        } else {
            state.decks.forEach(deck => {
                if (deck.cards && deck.cards.length > 0) {
                    const masteredCards = deck.cards.filter(c => getNextInterval(c.interval || 0, 'easy') >= 21).length;
                    const domain = (masteredCards / deck.cards.length) * 100;

                    totalCards += deck.cards.length;
                    totalMasteredCards += masteredCards;

                    const deckStatEl = document.createElement('div');
                    deckStatEl.className = 'mb-3 px-3';
                    deckStatEl.innerHTML = `
                        <div class="flex justify-between items-center mb-1">
                            <span class="text-sm text-slate-300 truncate">${deck.name}</span>
                            <span class="text-sm font-semibold text-white">${Math.round(domain)}%</span>
                        </div>
                        <div class="w-full bg-slate-700 rounded-full h-2">
                            <div class="bg-teal-500 h-2 rounded-full" style="width: ${domain}%"></div>
                        </div>
                    `;
                    domainByDeckList.appendChild(deckStatEl);
                }
            });
        }

        const globalDomain = (totalCards > 0) ? (totalMasteredCards / totalCards) * 100 : 0;
        totalDomainEl.textContent = `${Math.round(globalDomain)}%`;
    }

    function calculateStreak(todayString, studyLog) {
        let streak = 0;
        const dates = new Set(studyLog);
        
        if (dates.size === 0) return 0;
        
        let currentDate = new Date(todayString + 'T00:00:00');

        while (dates.has(currentDate.toISOString().split('T')[0])) {
            streak++;
            currentDate.setDate(currentDate.getDate() - 1);
        }
        
        if (!dates.has(todayString)) {
            let yesterday = new Date(todayString + 'T00:00:00');
            yesterday.setDate(yesterday.getDate() - 1);
            if (dates.has(yesterday.toISOString().split('T')[0])) {
                streak = 0;
                currentDate = yesterday;
                while (dates.has(currentDate.toISOString().split('T')[0])) {
                    streak++;
                    currentDate.setDate(currentDate.getDate() - 1);
                }
                return streak;
            } else {
                return 0;
            }
        }
        
        return streak;
    }


    // --- Lógica de Gestionar Tema (Manage) ---
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
        
        if (deck.cards.length === 0) {
            cardList.innerHTML = '<p class="text-sm text-slate-400 px-3">No hay tarjetas. ¡Añade la primera!</p>';
            return;
        }

        deck.cards.forEach(card => {
            const cardEl = document.createElement('div');
            cardEl.className = 'bg-slate-800 p-4 rounded-lg mb-2 flex justify-between items-start group';
            cardEl.innerHTML = `
                <div class="flex-1 overflow-hidden">
                    ${card.questionImg ? `<img src="${card.questionImg}" class="max-w-full h-auto max-h-20 rounded mb-2" onerror="this.style.display='none'">` : ''}
                    <p class="text-slate-300 font-semibold truncate"><strong class="text-teal-400">P:</strong> ${card.question}</p>
                    ${card.answerImg ? `<img src="${card.answerImg}" class="max-w-full h-auto max-h-20 rounded mt-2 mb-2" onerror="this.style.display='none'">` : ''}
                    <p class="text-slate-300 truncate"><strong class="text-teal-400">R:</strong> ${card.answer}</p>
                </div>
                <button data-card-id="${card.id}" class="delete-card-btn p-1 text-slate-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity ml-4">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
            `;
            cardList.appendChild(cardEl);
        });
    }

    if (addCardForm) {
        addCardForm.addEventListener('submit', (e) => {
            e.preventDefault();
            if (!state.decks) state.decks = [];
            const deck = state.decks.find(d => d.id === state.currentDeckId);
            if (deck) {
                const newCard = {
                    id: 'card_' + Date.now(),
                    question: cardQuestionInput.value.trim(),
                    answer: cardAnswerInput.value.trim(),
                    questionImg: cardQuestionImgInput.value.trim() || null,
                    answerImg: cardAnswerImgInput.value.trim() || null,
                    interval: 0,
                    easeFactor: 2.5,
                    nextReviewDate: getTodayString()
                };
                deck.cards.push(newCard);
                renderManageView();
                saveStateToFirestore();
                addCardForm.reset();
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
            if (confirm("¿Estás seguro de que quieres eliminar este tema y todas sus tarjetas? Esta acción no se puede deshacer.")) {
                state.decks = state.decks.filter(d => d.id !== state.currentDeckId);
                navigate(VIEWS.DASHBOARD);
                saveStateToFirestore();
            }
        });
    }


    // --- Lógica de Sesión de Estudio (Study) ---

    function startStudySession() {
        if (!state.decks) state.decks = [];
        const deck = state.decks.find(d => d.id === state.currentDeckId);
        if (!deck) return;

        const today = getTodayString();
        const cardsToReview = deck.cards
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
        const { cardsToReview, currentCardIndex } = state.studySession;
        if (!state.decks) state.decks = [];
        const deck = state.decks.find(d => d.id === state.currentDeckId);
        
        if (!deck) {
            navigate(VIEWS.DASHBOARD);
            return;
        }

        if (studyDeckTitle) studyDeckTitle.textContent = deck.name;
        
        if (currentCardIndex >= cardsToReview.length) {
            if (studyProgress) studyProgress.textContent = `Progreso: ${cardsToReview.length} / ${cardsToReview.length}`;
            if (studyCard) {
                studyCard.innerHTML = `
                    <div class="text-center p-8">
                        <h3 class="text-2xl font-bold text-white mb-4">¡Sesión completada!</h3>
                        <p class="text-lg text-slate-300 mb-6">Repasaste ${cardsToReview.length} tarjetas.</p>
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
            return;
        }
        
        if (studyProgress) studyProgress.textContent = `Progreso: ${currentCardIndex} / ${cardsToReview.length}`;
        const currentCard = cardsToReview[currentCardIndex];
        
        if (studyQuestionImg) {
            studyQuestionImg.src = currentCard.questionImg || '';
            studyQuestionImg.classList.toggle('hidden', !currentCard.questionImg);
            studyQuestionImg.onerror = () => { studyQuestionImg.classList.add('hidden'); };
        }
        if (studyQuestionTextEl) studyQuestionTextEl.textContent = currentCard.question;
        
        if (studyAnswerImg) {
            studyAnswerImg.src = '';
            studyAnswerImg.classList.add('hidden');
            studyAnswerImg.onerror = () => { studyAnswerImg.classList.add('hidden'); };
        }
        
        if (studyAnswerTextEl) {
            studyAnswerTextEl.textContent = currentCard.answer;
            if (studyAnswerTextEl.parentElement) studyAnswerTextEl.parentElement.classList.add('hidden');
        }
        
        if (studyDifficultyBtns) studyDifficultyBtns.classList.add('hidden');
        if (showAnswerBtn) showAnswerBtn.classList.remove('hidden');
        if (studyCard) studyCard.classList.remove('hidden');
    }

    if (showAnswerBtn) {
        showAnswerBtn.addEventListener('click', () => {
            const { cardsToReview, currentCardIndex } = state.studySession;
            const currentCard = cardsToReview[currentCardIndex];
            
            if (studyAnswerImg) {
                studyAnswerImg.src = currentCard.answerImg || '';
                studyAnswerImg.classList.toggle('hidden', !currentCard.answerImg);
            }
            if (studyAnswerTextEl && studyAnswerTextEl.parentElement) {
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

            const { cardsToReview, currentCardIndex } = state.studySession;
            const card = cardsToReview[currentCardIndex];

            let { interval, easeFactor } = card;
            interval = interval || 0;
            easeFactor = easeFactor || 2.5;

            let nextInterval;
            let newEaseFactor = easeFactor;

            if (difficulty === 'easy') {
                nextInterval = getNextInterval(interval, 'easy');
                newEaseFactor += 0.1;
                state.points += 3;
            } else if (difficulty === 'good') {
                nextInterval = getNextInterval(interval, 'good');
                state.points += 2;
            } else {
                nextInterval = 0;
                newEaseFactor = Math.max(1.3, easeFactor - 0.2);
                state.points += 1;
            }
            
            const nextReviewDate = new Date(getTodayString() + 'T00:00:00');
            nextReviewDate.setDate(nextReviewDate.getDate() + nextInterval);
            
            const deck = state.decks.find(d => d.id === state.currentDeckId);
            const cardInDeck = deck.cards.find(c => c.id === card.id);
            if (cardInDeck) {
                cardInDeck.interval = nextInterval;
                cardInDeck.easeFactor = newEaseFactor;
                cardInDeck.nextReviewDate = nextReviewDate.toISOString().split('T')[0];
            }

            state.studySession.currentCardIndex++;
            renderStudyView();
        });
    }
    
    function getNextInterval(lastInterval, difficulty) {
        if (difficulty === 'hard') return 1;
        if (lastInterval === 0) {
             return (difficulty === 'easy') ? 4 : 1;
        }
        if (lastInterval === 1) {
            return (difficulty === 'easy') ? 7 : 3;
        }
        let next = lastInterval * 2;
        if (difficulty === 'easy') next += 1;
        return Math.min(next, 60);
    }
    

    // --- Lógica de Quiz ---
    
    let quizState = {
        questions: [],
        currentQuestionIndex: 0,
        score: 0,
        answered: false
    };

    function startQuiz() {
        if (!state.decks) state.decks = [];
        const deck = state.decks.find(d => d.id === state.currentDeckId);
        if (!deck || deck.cards.length < 4) return;

        logStudyActivity();

        const shuffledCards = [...deck.cards].sort(() => Math.random() - 0.5);
        const selectedCards = shuffledCards;

        quizState.questions = selectedCards.map(card => {
            return generateQuizQuestion(card, deck.cards);
        });
        
        quizState.currentQuestionIndex = 0;
        quizState.score = 0;
        quizState.answered = false;

        renderQuizView();
    }

    function generateQuizQuestion(correctCard, allCards) {
        let options = [correctCard.answer];
        
        const incorrectCards = allCards.filter(c => c.id !== correctCard.id);
        const shuffledIncorrect = incorrectCards.sort(() => Math.random() - 0.5);
        
        for (let i = 0; i < 3 && i < shuffledIncorrect.length; i++) {
            options.push(shuffledIncorrect[i].answer);
        }

        options.sort(() => Math.random() - 0.5);

        return {
            question: correctCard.question,
            options: options,
            correctAnswer: correctCard.answer
        };
    }
    
    function renderQuizView() {
        if (!state.decks) state.decks = [];
        const deck = state.decks.find(d => d.id === state.currentDeckId);
        if (!deck) {
            navigate(VIEWS.DASHBOARD);
            return;
        }

        if (quizDeckTitle) quizDeckTitle.textContent = `Quiz: ${deck.name}`;
        if (quizFeedback) {
            quizFeedback.classList.add('hidden');
            quizFeedback.textContent = '';
        }
        if (nextQuizQuestionBtn) nextQuizQuestionBtn.classList.add('hidden');
        
        const { questions, currentQuestionIndex } = quizState;

        if (currentQuestionIndex >= questions.length) {
            const scorePercent = (questions.length > 0) ? (quizState.score / questions.length) * 100 : 0;
            if (quizQuestionText) quizQuestionText.textContent = '¡Quiz completado!';
            if (quizOptionsList) {
                quizOptionsList.innerHTML = `
                    <p class="text-xl text-center text-slate-300">
                        Tu puntuación: ${quizState.score} / ${questions.length} (${Math.round(scorePercent)}%)
                    </p>
                    <button id="finish-quiz-btn" class="w-full mt-6 bg-teal-600 hover:bg-teal-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors">
                        Volver al Dashboard
                    </button>
                `;
                const finishBtn = document.getElementById('finish-quiz-btn');
                if (finishBtn) {
                    finishBtn.addEventListener('click', () => {
                        navigate(VIEWS.DASHBOARD);
                        saveStateToFirestore();
                    });
                }
            }
            return;
        }

        if (quizProgress) quizProgress.textContent = `Pregunta: ${currentQuestionIndex + 1} / ${questions.length}`;
        const question = questions[currentQuestionIndex];
        if (quizQuestionText) quizQuestionText.textContent = question.question;
        
        if (quizOptionsList) quizOptionsList.innerHTML = '';
        question.options.forEach(option => {
            const optionEl = document.createElement('button');
            optionEl.className = 'quiz-option w-full bg-slate-700 hover:bg-slate-600 text-slate-200 text-left p-4 rounded-lg transition-colors';
            optionEl.textContent = option;
            if (quizOptionsList) quizOptionsList.appendChild(optionEl);
        });

        quizState.answered = false;
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
                    btn.classList.remove('bg-slate-700', 'hover:bg-slate-600');
                    btn.classList.add('bg-green-700');
                }
            });
            
            if (answer === question.correctAnswer) {
                if (quizFeedback) {
                    quizFeedback.textContent = '¡Correcto! +10 puntos';
                    quizFeedback.className = 'p-3 rounded-lg bg-green-900 text-green-200 mt-4';
                }
                quizState.score++;
                state.points += 10;
            } else {
                if (quizFeedback) {
                    quizFeedback.textContent = `Incorrecto. La respuesta era: ${question.correctAnswer}`;
                    quizFeedback.className = 'p-3 rounded-lg bg-red-900 text-red-200 mt-4';
                }
                selectedOption.classList.remove('bg-slate-700', 'opacity-70');
                selectedOption.classList.add('bg-red-700');
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


    // --- Lógica del Pomodoro ---
    
    function updatePomodoroUI() {
        if (!pomodoroTimerEl) return;
        const minutes = Math.floor(state.pomodoro.timeLeft / 60);
        const seconds = state.pomodoro.timeLeft % 60;
        pomodoroTimerEl.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        
        if (startPomodoroBtn) startPomodoroBtn.textContent = state.pomodoro.isRunning ? 'Pausar' : 'Iniciar';
        
        if (state.pomodoro.isBreak) {
            document.body.classList.add('bg-teal-900');
            document.body.classList.remove('bg-slate-900');
        } else {
            document.body.classList.remove('bg-teal-900');
            document.body.classList.add('bg-slate-900');
        }
    }

    function startPomodoro() {
        if (state.pomodoro.isRunning) {
            clearInterval(state.pomodoro.timer);
            state.pomodoro.isRunning = false;
            state.pomodoro.endTime = null;
        } else {
            state.pomodoro.isRunning = true;
            
            if (!state.pomodoro.endTime || state.pomodoro.endTime <= Date.now()) {
                 state.pomodoro.endTime = Date.now() + (state.pomodoro.timeLeft * 1000);
            }
            else {
                state.pomodoro.timeLeft = Math.round((state.pomodoro.endTime - Date.now()) / 1000);
            }

            state.pomodoro.timer = setInterval(() => {
                const now = Date.now();
                const timeLeftMs = state.pomodoro.endTime - now;
                
                if (timeLeftMs <= 0) {
                    handlePomodoroFinish();
                } else {
                    state.pomodoro.timeLeft = Math.round(timeLeftMs / 1000);
                }
                updatePomodoroUI();
            }, 1000);
        }
        updatePomodoroUI();
    }
    
    function handlePomodoroFinish() {
        clearInterval(state.pomodoro.timer);
        state.pomodoro.isRunning = false;
        state.pomodoro.endTime = null;
        
        playPomodoroSound(state.pomodoro.isBreak);

        if (state.pomodoro.isBreak) {
            state.pomodoro.isBreak = false;
            state.pomodoro.timeLeft = 25 * 60;
            showNotification("¡Descanso terminado! Es hora de enfocarse.");
        } else {
            state.pomodoro.isBreak = true;
            state.pomodoro.timeLeft = 5 * 60;
            state.points += 25;
            state.studyTimeMinutes += 25;
            logStudyActivity();
            showNotification("¡Pomodoro completado! +25 puntos. ¡Toma un descanso!");
        }
        
        updatePomodoroUI();
        saveStateToFirestore();
    }

    function resetPomodoro() {
        clearInterval(state.pomodoro.timer);
        state.pomodoro.isRunning = false;
        state.pomodoro.isBreak = false;
        state.pomodoro.timeLeft = 25 * 60;
        state.pomodoro.endTime = null;
        updatePomodoroUI();
        saveStateToFirestore();
    }
    
    function checkRunningPomodoro() {
        if (state.pomodoro.endTime && state.pomodoro.endTime > Date.now()) {
            state.pomodoro.timeLeft = Math.round((state.pomodoro.endTime - Date.now()) / 1000);
            startPomodoro();
        } else if (state.pomodoro.endTime && state.pomodoro.endTime <= Date.now()) {
            handlePomodoroFinish();
        }
    }

    if (startPomodoroBtn) startPomodoroBtn.addEventListener('click', startPomodoro);
    if (resetPomodoroBtn) resetPomodoroBtn.addEventListener('click', resetPomodoro);


    // --- Utilidades ---
    
    function getTodayString() {
        return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    }

    function showNotification(message) {
        if (!notification) return;
        notification.textContent = message;
        notification.classList.remove('hidden', 'opacity-0', 'translate-y-full');
        notification.classList.add('opacity-100', '-translate-y-4');
        
        setTimeout(() => {
            notification.classList.remove('opacity-100', '-translate-y-4');
            notification.classList.add('opacity-0', 'translate-y-full');
            setTimeout(() => notification.classList.add('hidden'), 500);
        }, 3000);
    }
    
    let audioCtx;
    function playPomodoroSound(isBreak) {
        try {
            if (!audioCtx) {
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (!audioCtx) return; // Salir si Web Audio no es compatible
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(isBreak ? 660 : 440, audioCtx.currentTime); 
            gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
            
            oscillator.start(audioCtx.currentTime);
            oscillator.stop(audioCtx.currentTime + 0.5);
        } catch (e) {
            console.error("Error al reproducir sonido:", e);
        }
    }
});