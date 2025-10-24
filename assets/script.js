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

// --- AUTENTICACIÓN DE FIREBASE ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        // Usuario logueado
        console.log("Usuario autenticado:", user.email);
        currentUserId = user.uid;
        
        // Mostrar contenido principal y ocultar login
        showMainApp();
        
        // Cargar datos del usuario desde Firestore
        loadUserDataFromFirestore();
        
        // Actualizar header con info del usuario
        updateAuthUI(user);
        
    } else {
        // Usuario no logueado
        console.log("Usuario no autenticado");
        currentUserId = null;
        
        // Mostrar pantalla de login y ocultar contenido
        showLoginScreen();
        
        // Limpiar datos locales
        if (unsubscribeFromFirestore) {
            unsubscribeFromFirestore();
        }
        state = { ...defaultState };
    }
});

function showMainApp() {
    const loginView = document.getElementById('login-view');
    const mainContent = document.getElementById('main-content');
    
    if (loginView) {
        loginView.classList.add('hidden');
        loginView.classList.remove('active');
    }
    if (mainContent) {
        mainContent.classList.remove('hidden');
    }
}

function showLoginScreen() {
    const loginView = document.getElementById('login-view');
    const mainContent = document.getElementById('main-content');
    
    if (mainContent) {
        mainContent.classList.add('hidden');
    }
    if (loginView) {
        loginView.classList.remove('hidden');
        loginView.classList.add('active');
    }
}

function updateAuthUI(user) {
    const authContainer = document.getElementById('auth-container');
    if (user && authContainer) {
        authContainer.innerHTML = `
            <div class="flex items-center gap-3">
                <div class="text-right">
                    <div class="text-sm font-medium text-slate-200">${user.displayName}</div>
                    <div id="points-display" class="text-sm font-bold text-yellow-400 flex items-center gap-1">
                        ⭐ <span>${state.points}</span>
                    </div>
                </div>
                <img src="${user.photoURL}" alt="Perfil" class="w-10 h-10 rounded-full border-2 border-primary">
                <button id="logout-btn" class="text-slate-400 hover:text-slate-200 transition-colors">
                    <i data-lucide="log-out" class="w-5 h-5"></i>
                </button>
            </div>
        `;
        
        // Re-crear iconos de lucide
        lucide.createIcons();
        
        // Agregar event listener al botón de logout
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', logout);
        }
    }
}

async function loginWithGoogle() {
    try {
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(auth, provider);
        console.log("Login exitoso:", result.user.email);
        showNotification(`¡Bienvenido, ${result.user.displayName}!`);
    } catch (error) {
        console.error("Error en login:", error);
        let errorMessage = "Error al iniciar sesión. ";
        
        if (error.code === 'auth/popup-blocked') {
            errorMessage += "El popup fue bloqueado. Permite popups para este sitio.";
        } else if (error.code === 'auth/popup-closed-by-user') {
            errorMessage += "Login cancelado.";
        } else {
            errorMessage += "Inténtalo de nuevo.";
        }
        
        showNotification(errorMessage);
    }
}

async function logout() {
    try {
        await signOut(auth);
        showNotification("Sesión cerrada correctamente");
    } catch (error) {
        console.error("Error en logout:", error);
        showNotification("Error al cerrar sesión");
    }
}

function loadUserDataFromFirestore() {
    if (!currentUserId) return;
    
    const userDocRef = doc(db, "users", currentUserId);
    
    // Escuchar cambios en tiempo real
    unsubscribeFromFirestore = onSnapshot(userDocRef, (docSnapshot) => {
        if (docSnapshot.exists()) {
            const userData = docSnapshot.data();
            console.log("Datos cargados desde Firestore:", userData);
            
            // Actualizar estado local con datos de Firestore
            state = { ...defaultState, ...userData };
            
            // Restaurar temporizador del pomodoro si es necesario
            if (state.pomodoro) {
                if (state.pomodoro.timer) {
                    delete state.pomodoro.timer;
                }
                if (state.pomodoro.endTime && state.pomodoro.isRunning) {
                    checkRunningPomodoro();
                }
            }
            
            // Actualizar todas las vistas
            render();
            
        } else {
            console.log("No hay datos previos, usando estado por defecto");
            // Guardar estado inicial
            saveStateToFirestore();
        }
    }, (error) => {
        console.error("Error cargando datos de Firestore:", error);
    });
}

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
    const loginView = document.getElementById('login-view'); // Asegúrate que este ID existe en tu HTML
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

    // --- AGREGAR EVENT LISTENER PARA LOGIN ---
    if (loginBtn) {
        loginBtn.addEventListener('click', loginWithGoogle);
    }

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
        }
    }
    
    function logStudyActivity() {
        const today = getTodayString();
        const todayLogIndex = state.studyLog.findIndex(log => log.date === today);
        
        if (todayLogIndex !== -1) {
            state.studyLog[todayLogIndex].sessions++;
        } else {
            state.studyLog.push({
                date: today,
                sessions: 1
            });
        }
    }

    // --- Utilidades de Estudio ---
    
    function isCardDueForReview(card) {
        if (!card.nextReviewDate) return true;
        
        let reviewDate;
        if (card.nextReviewDate instanceof Timestamp) {
            reviewDate = card.nextReviewDate.toDate();
        } else {
            reviewDate = new Date(card.nextReviewDate);
        }
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        return reviewDate <= today;
    }

    function updateCardReviewDate(card, difficulty) {
        const today = new Date();
        let daysToAdd;
        
        switch (difficulty) {
            case 'again':
                daysToAdd = 1;
                break;
            case 'hard':
                daysToAdd = card.easeFactor ? Math.max(1, Math.round(card.interval * 0.8)) : 2;
                break;
            case 'good':
                daysToAdd = card.easeFactor ? Math.round(card.interval * card.easeFactor) : 3;
                break;
            case 'easy':
                daysToAdd = card.easeFactor ? Math.round(card.interval * card.easeFactor * 1.3) : 5;
                break;
            default:
                daysToAdd = 1;
        }
        
        card.interval = daysToAdd;
        card.easeFactor = card.easeFactor || 2.5;
        
        if (difficulty === 'again') {
            card.easeFactor = Math.max(1.3, card.easeFactor - 0.2);
        } else if (difficulty === 'hard') {
            card.easeFactor = Math.max(1.3, card.easeFactor - 0.15);
        } else if (difficulty === 'easy') {
            card.easeFactor = card.easeFactor + 0.15;
        }
        
        const nextReview = new Date(today);
        nextReview.setDate(today.getDate() + daysToAdd);
        card.nextReviewDate = Timestamp.fromDate(nextReview);
        
        card.reviewCount = (card.reviewCount || 0) + 1;
        card.lastReviewed = Timestamp.now();
    }

    function calculateMasteryLevel(card) {
        if (!card.reviewCount) return 0;
        
        const reviewCount = card.reviewCount;
        const interval = card.interval || 1;
        
        if (reviewCount >= 5 && interval >= 21) return 100; // Dominado
        if (reviewCount >= 3 && interval >= 7) return 75;   // Avanzado
        if (reviewCount >= 2 && interval >= 3) return 50;   // Intermedio
        if (reviewCount >= 1) return 25;                    // Principiante
        return 0; // Sin revisar
    }

    // --- Navegación ---
    
    function navigate(view) {
        views.forEach(v => v.classList.add('hidden'));
        document.getElementById(view).classList.remove('hidden');
        state.currentView = view;
        
        if (view === VIEWS.DASHBOARD) {
            renderDashboard();
        }
    }

    // --- Renderizado Dashboard ---
    
    function renderDashboard() {
        if (pointsEl) pointsEl.textContent = state.points;
        renderDecks();
        renderTasks();
        updateStats();
        updatePomodoroUI();
    }

    function renderDecks() {
        if (!deckList) return;
        
        deckList.innerHTML = '';
        
        if (state.decks.length === 0) {
            if (noDecksMessage) noDecksMessage.classList.remove('hidden');
            return;
        }
        
        if (noDecksMessage) noDecksMessage.classList.add('hidden');
        
        state.decks.forEach(deck => {
            const deckEl = document.createElement('div');
            deckEl.className = 'bg-slate-700 p-6 rounded-lg border border-slate-600';
            
            const totalCards = deck.cards ? deck.cards.length : 0;
            const dueCards = deck.cards ? deck.cards.filter(isCardDueForReview).length : 0;
            const masteredCards = deck.cards ? deck.cards.filter(card => calculateMasteryLevel(card) === 100).length : 0;
            
            deckEl.innerHTML = `
                <h3 class="text-lg font-semibold text-slate-200 mb-3">${deck.name}</h3>
                <div class="space-y-2 text-sm text-slate-400 mb-4">
                    <div class="flex justify-between">
                        <span>Total de cartas:</span>
                        <span>${totalCards}</span>
                    </div>
                    <div class="flex justify-between">
                        <span>Para revisar:</span>
                        <span class="text-teal-400">${dueCards}</span>
                    </div>
                    <div class="flex justify-between">
                        <span>Dominadas:</span>
                        <span class="text-green-400">${masteredCards}</span>
                    </div>
                </div>
                <div class="flex gap-2">
                    <button 
                        class="flex-1 bg-teal-600 hover:bg-teal-500 text-white px-4 py-2 rounded-lg text-sm transition-colors study-btn"
                        data-deck-id="${deck.id}"
                        ${dueCards === 0 ? 'disabled' : ''}
                    >
                        ${dueCards === 0 ? 'No hay cartas para revisar' : 'Estudiar'}
                    </button>
                    <button class="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm transition-colors quiz-btn" data-deck-id="${deck.id}">
                        Quiz
                    </button>
                    <button class="bg-slate-600 hover:bg-slate-500 text-white px-4 py-2 rounded-lg text-sm transition-colors manage-btn" data-deck-id="${deck.id}">
                        Gestionar
                    </button>
                </div>
            `;
            
            deckList.appendChild(deckEl);
        });
        
        // Event listeners para botones de deck
        deckList.querySelectorAll('.study-btn:not([disabled])').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const deckId = e.target.dataset.deckId;
                startStudySession(deckId);
            });
        });
        
        deckList.querySelectorAll('.quiz-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const deckId = e.target.dataset.deckId;
                startQuiz(deckId);
            });
        });
        
        deckList.querySelectorAll('.manage-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const deckId = e.target.dataset.deckId;
                manageDeck(deckId);
            });
        });
    }

    function renderTasks() {
        if (!taskList) return;
        
        taskList.innerHTML = '';
        
        const sortedTasks = [...state.tasks].sort((a, b) => {
            const priorityOrder = { 'alta': 3, 'media': 2, 'baja': 1 };
            if (a.completed === b.completed) {
                return priorityOrder[b.priority] - priorityOrder[a.priority];
            }
            return a.completed ? 1 : -1;
        });
        
        sortedTasks.forEach(task => {
            const taskEl = document.createElement('div');
            taskEl.className = `flex items-center gap-3 p-3 rounded-lg border ${
                task.completed 
                    ? 'bg-slate-800 border-slate-700 opacity-60' 
                    : 'bg-slate-700 border-slate-600'
            }`;
            
            const priorityColors = {
                'alta': 'bg-red-500',
                'media': 'bg-yellow-500',
                'baja': 'bg-green-500'
            };
            
            taskEl.innerHTML = `
                <button class="w-5 h-5 rounded border-2 border-slate-400 flex items-center justify-center transition-colors ${
                    task.completed ? 'bg-teal-500 border-teal-500' : 'hover:border-teal-400'
                }" data-task-id="${task.id}">
                    ${task.completed ? '<i data-lucide="check" class="w-3 h-3 text-white"></i>' : ''}
                </button>
                <div class="w-3 h-3 rounded-full ${priorityColors[task.priority]}"></div>
                <span class="flex-1 text-slate-200 ${task.completed ? 'line-through' : ''}">${task.text}</span>
                <button class="text-slate-400 hover:text-red-400 delete-task-btn" data-task-id="${task.id}">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
            `;
            
            taskList.appendChild(taskEl);
        });
        
        lucide.createIcons();
        
        // Event listeners para tareas
        taskList.querySelectorAll('button[data-task-id]').forEach(btn => {
            if (btn.classList.contains('delete-task-btn')) {
                btn.addEventListener('click', (e) => {
                    const taskId = e.target.closest('button').dataset.taskId;
                    deleteTask(taskId);
                });
            } else {
                btn.addEventListener('click', (e) => {
                    const taskId = e.target.closest('button').dataset.taskId;
                    toggleTask(taskId);
                });
            }
        });
    }

    function updateStats() {
        // Calcular racha de días
        const streak = calculateStudyStreak();
        if (streakEl) streakEl.textContent = streak;
        
        // Tiempo total de estudio
        if (studyTimeEl) studyTimeEl.textContent = `${Math.floor(state.studyTimeMinutes / 60)}h ${state.studyTimeMinutes % 60}m`;
        
        // Dominio total
        const totalCards = state.decks.reduce((acc, deck) => acc + (deck.cards ? deck.cards.length : 0), 0);
        const masteredCards = state.decks.reduce((acc, deck) => 
            acc + (deck.cards ? deck.cards.filter(card => calculateMasteryLevel(card) === 100).length : 0), 0
        );
        const domainPercentage = totalCards > 0 ? Math.round((masteredCards / totalCards) * 100) : 0;
        if (totalDomainEl) totalDomainEl.textContent = `${domainPercentage}%`;
        
        // Dominio por tema
        if (domainByDeckList) {
            domainByDeckList.innerHTML = '';
            state.decks.forEach(deck => {
                const deckCards = deck.cards ? deck.cards.length : 0;
                const deckMastered = deck.cards ? deck.cards.filter(card => calculateMasteryLevel(card) === 100).length : 0;
                const deckPercentage = deckCards > 0 ? Math.round((deckMastered / deckCards) * 100) : 0;
                
                const deckStatEl = document.createElement('div');
                deckStatEl.className = 'flex justify-between text-sm';
                deckStatEl.innerHTML = `
                    <span class="text-slate-300">${deck.name}</span>
                    <span class="text-slate-400">${deckPercentage}%</span>
                `;
                domainByDeckList.appendChild(deckStatEl);
            });
        }

        // ACTUALIZAR PUNTOS EN EL HEADER
        const pointsDisplay = document.getElementById('points-display');
        if (pointsDisplay) {
            const pointsSpan = pointsDisplay.querySelector('span');
            if (pointsSpan) {
                pointsSpan.textContent = state.points;
            }
        }
    }

    function calculateStudyStreak() {
        if (state.studyLog.length === 0) return 0;
        
        const sortedLog = [...state.studyLog].sort((a, b) => new Date(b.date) - new Date(a.date));
        const today = getTodayString();
        
        let streak = 0;
        let currentDate = new Date(today);
        
        for (const log of sortedLog) {
            const logDate = log.date;
            const currentDateStr = currentDate.toISOString().split('T')[0];
            
            if (logDate === currentDateStr) {
                streak++;
                currentDate.setDate(currentDate.getDate() - 1);
            } else {
                break;
            }
        }
        
        return streak;
    }

    // --- Gestión de Tareas ---
    
    function addTask() {
        const text = taskInput.value.trim();
        const priority = taskPriority.value;
        
        if (!text) return;
        
        const newTask = {
            id: Date.now().toString(),
            text,
            priority,
            completed: false,
            createdAt: new Date().toISOString()
        };
        
        state.tasks.push(newTask);
        taskInput.value = '';
        renderTasks();
        saveStateToFirestore();
        
        showNotification('Tarea agregada');
    }

    function toggleTask(taskId) {
        const task = state.tasks.find(t => t.id === taskId);
        if (task) {
            task.completed = !task.completed;
            if (task.completed) {
                state.points += 5;
                showNotification('Tarea completada! +5 puntos');
            }
            renderTasks();
            renderDashboard();
            saveStateToFirestore();
        }
    }

    function deleteTask(taskId) {
        state.tasks = state.tasks.filter(t => t.id !== taskId);
        renderTasks();
        saveStateToFirestore();
        showNotification('Tarea eliminada');
    }

    // Event listeners para tareas
    addTaskBtn?.addEventListener('click', addTask);
    taskInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addTask();
    });

    // --- Gestión de Decks ---
    
    function createNewDeck() {
        const deckName = prompt('Nombre del nuevo tema de estudio:');
        if (!deckName || !deckName.trim()) return;
        
        const newDeck = {
            id: Date.now().toString(),
            name: deckName.trim(),
            cards: [],
            createdAt: new Date().toISOString()
        };
        
        state.decks.push(newDeck);
        renderDashboard();
        saveStateToFirestore();
        showNotification('Nuevo tema creado');
        
        // Ir directamente a gestionar el nuevo deck
        manageDeck(newDeck.id);
    }

    function manageDeck(deckId) {
        const deck = state.decks.find(d => d.id === deckId);
        if (!deck) return;
        
        state.currentDeckId = deckId;
        manageDeckTitle.textContent = deck.name;
        
        renderManageDeckView(deck);
        navigate(VIEWS.MANAGE);
    }

    function renderManageDeckView(deck) {
        cardList.innerHTML = '';
        
        if (!deck.cards || deck.cards.length === 0) {
            cardList.innerHTML = '<p class="text-slate-400 text-center py-8">No hay cartas en este tema. ¡Agrega la primera!</p>';
            return;
        }
        
        deck.cards.forEach((card, index) => {
            const cardEl = document.createElement('div');
            cardEl.className = 'bg-slate-700 p-4 rounded-lg border border-slate-600';
            
            const masteryLevel = calculateMasteryLevel(card);
            const masteryColor = masteryLevel >= 75 ? 'text-green-400' : masteryLevel >= 50 ? 'text-yellow-400' : 'text-red-400';
            
            cardEl.innerHTML = `
                <div class="flex justify-between items-start mb-3">
                    <h4 class="font-medium text-slate-200">Carta ${index + 1}</h4>
                    <div class="flex items-center gap-2">
                        <span class="text-xs ${masteryColor}">${masteryLevel}% dominada</span>
                        <button class="text-slate-400 hover:text-red-400 delete-card-btn" data-card-index="${index}">
                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                        </button>
                    </div>
                </div>
                <div class="space-y-3">
                    <div>
                        <label class="text-xs text-slate-400 uppercase tracking-wide">Pregunta</label>
                        <p class="text-slate-200 mt-1">${card.question}</p>
                        ${card.questionImg ? `<img src="${card.questionImg}" alt="Imagen pregunta" class="mt-2 max-w-xs rounded">` : ''}
                    </div>
                    <div>
                        <label class="text-xs text-slate-400 uppercase tracking-wide">Respuesta</label>
                        <p class="text-slate-200 mt-1">${card.answer}</p>
                        ${card.answerImg ? `<img src="${card.answerImg}" alt="Imagen respuesta" class="mt-2 max-w-xs rounded">` : ''}
                    </div>
                </div>
            `;
            
            cardList.appendChild(cardEl);
        });
        
        lucide.createIcons();
        
        // Event listeners para eliminar cartas
        cardList.querySelectorAll('.delete-card-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const cardIndex = parseInt(e.target.closest('button').dataset.cardIndex);
                deleteCard(deck.id, cardIndex);
            });
        });
    }

    function addCard() {
        const deck = state.decks.find(d => d.id === state.currentDeckId);
        if (!deck) return;
        
        const question = cardQuestionInput.value.trim();
        const answer = cardAnswerInput.value.trim();
        
        if (!question || !answer) {
            showNotification('La pregunta y respuesta son obligatorias');
            return;
        }
        
        const newCard = {
            id: Date.now().toString(),
            question,
            answer,
            questionImg: cardQuestionImgInput.value || null,
            answerImg: cardAnswerImgInput.value || null,
            createdAt: new Date().toISOString(),
            reviewCount: 0,
            interval: 1,
            easeFactor: 2.5,
            nextReviewDate: Timestamp.now()
        };
        
        if (!deck.cards) deck.cards = [];
        deck.cards.push(newCard);
        
        // Limpiar formulario
        cardQuestionInput.value = '';
        cardAnswerInput.value = '';
        cardQuestionImgInput.value = '';
        cardAnswerImgInput.value = '';
        
        renderManageDeckView(deck);
        saveStateToFirestore();
        showNotification('Carta agregada');
    }

    function deleteCard(deckId, cardIndex) {
        const deck = state.decks.find(d => d.id === deckId);
        if (!deck || !deck.cards) return;
        
        if (confirm('¿Estás seguro de eliminar esta carta?')) {
            deck.cards.splice(cardIndex, 1);
            renderManageDeckView(deck);
            saveStateToFirestore();
            showNotification('Carta eliminada');
        }
    }

    function deleteDeck() {
        const deck = state.decks.find(d => d.id === state.currentDeckId);
        if (!deck) return;
        
        if (confirm(`¿Estás seguro de eliminar el tema "${deck.name}" y todas sus cartas?`)) {
            state.decks = state.decks.filter(d => d.id !== state.currentDeckId);
            navigate(VIEWS.DASHBOARD);
            saveStateToFirestore();
            showNotification('Tema eliminado');
        }
    }

    // Event listeners para gestión de decks
    newDeckBtn?.addEventListener('click', createNewDeck);
    saveCardBtn?.addEventListener('click', addCard);
    deleteDeckBtn?.addEventListener('click', deleteDeck);

    // --- Sesión de Estudio ---
    
    function startStudySession(deckId) {
        const deck = state.decks.find(d => d.id === deckId);
        if (!deck || !deck.cards) return;
        
        const cardsToReview = deck.cards.filter(isCardDueForReview);
        
        if (cardsToReview.length === 0) {
            showNotification('No hay cartas para revisar en este tema');
            return;
        }
        
        // Mezclar cartas
        for (let i = cardsToReview.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [cardsToReview[i], cardsToReview[j]] = [cardsToReview[j], cardsToReview[i]];
        }
        
        state.studySession = {
            deckId,
            cardsToReview,
            currentCardIndex: 0,
            correctAnswers: 0
        };
        
        studyDeckTitle.textContent = deck.name;
        renderStudyView();
        navigate(VIEWS.STUDY);
    }

    function renderStudyView() {
        const { cardsToReview, currentCardIndex } = state.studySession;
        
        if (currentCardIndex >= cardsToReview.length) {
            // Sesión completada
            const accuracy = Math.round((state.studySession.correctAnswers / cardsToReview.length) * 100);
            const bonusPoints = accuracy >= 80 ? 20 : accuracy >= 60 ? 10 : 5;
            
            state.points += bonusPoints;
            logStudyActivity();
            
            studyCard.innerHTML = `
                <div class="text-center py-8">
                    <div class="text-6xl mb-4">🎉</div>
                    <h2 class="text-2xl font-bold text-slate-200 mb-4">¡Sesión Completada!</h2>
                    <div class="space-y-2 text-slate-300">
                        <p>Cartas revisadas: ${cardsToReview.length}</p>
                        <p>Precisión: ${accuracy}%</p>
                        <p class="text-teal-400">+${bonusPoints} puntos bonus</p>
                    </div>
                    <button id="finish-study-btn" class="mt-6 bg-teal-600 hover:bg-teal-500 text-white px-6 py-3 rounded-lg transition-colors">
                        Volver al Dashboard
                    </button>
                </div>
            `;
            
            document.getElementById('finish-study-btn').addEventListener('click', () => {
                navigate(VIEWS.DASHBOARD);
                saveStateToFirestore();
            });
            return;
        }

        const currentCard = cardsToReview[currentCardIndex];
        studyProgress.textContent = `Carta ${currentCardIndex + 1} de ${cardsToReview.length}`;
        
        // Mostrar pregunta
        studyQuestionTextEl.textContent = currentCard.question;
        if (currentCard.questionImg) {
            studyQuestionImg.src = currentCard.questionImg;
            studyQuestionImg.classList.remove('hidden');
        } else {
            studyQuestionImg.classList.add('hidden');
        }
        
        // Ocultar respuesta inicialmente
        studyAnswerTextEl.textContent = currentCard.answer;
        if (currentCard.answerImg) {
            studyAnswerImg.src = currentCard.answerImg;
            studyAnswerImg.classList.remove('hidden');
        } else {
            studyAnswerImg.classList.add('hidden');
        }
        
        // Configurar botones
        document.getElementById('study-answer').classList.add('hidden');
        showAnswerBtn.classList.remove('hidden');
        studyDifficultyBtns.classList.add('hidden');
    }

    function showStudyAnswer() {
        document.getElementById('study-answer').classList.remove('hidden');
        showAnswerBtn.classList.add('hidden');
        studyDifficultyBtns.classList.remove('hidden');
    }

    function answerCard(difficulty) {
        const { cardsToReview, currentCardIndex, deckId } = state.studySession;
        const currentCard = cardsToReview[currentCardIndex];
        const deck = state.decks.find(d => d.id === deckId);
        const cardInDeck = deck.cards.find(c => c.id === currentCard.id);
        
        if (cardInDeck) {
            updateCardReviewDate(cardInDeck, difficulty);
        }
        
        // Puntos por dificultad
        const points = { again: 1, hard: 3, good: 5, easy: 8 };
        state.points += points[difficulty] || 0;
        
        if (difficulty === 'good' || difficulty === 'easy') {
            state.studySession.correctAnswers++;
        }
        
        // Siguiente carta
        state.studySession.currentCardIndex++;
        renderStudyView();
    }

    // Event listeners para estudio
    showAnswerBtn?.addEventListener('click', showStudyAnswer);
    
    document.getElementById('answer-again')?.addEventListener('click', () => answerCard('again'));
    document.getElementById('answer-hard')?.addEventListener('click', () => answerCard('hard'));
    document.getElementById('answer-good')?.addEventListener('click', () => answerCard('good'));
    document.getElementById('answer-easy')?.addEventListener('click', () => answerCard('easy'));

    // --- Quiz ---
    
    let quizState = {
        deckId: null,
        questions: [],
        currentQuestionIndex: 0,
        score: 0,
        answered: false
    };

    function startQuiz(deckId) {
        const deck = state.decks.find(d => d.id === deckId);
        if (!deck || !deck.cards || deck.cards.length < 4) {
            showNotification('Necesitas al menos 4 cartas para hacer un quiz');
            return;
        }
        
        const questions = generateQuizQuestions(deck.cards);
        if (questions.length === 0) {
            showNotification('No se pudieron generar preguntas para el quiz');
            return;
        }
        
        quizState = {
            deckId,
            questions,
            currentQuestionIndex: 0,
            score: 0,
            answered: false
        };
        
        quizDeckTitle.textContent = deck.name;
        renderQuizView();
        navigate(VIEWS.QUIZ);
    }

    function generateQuizQuestions(cards, numQuestions = 10) {
        const shuffledCards = [...cards].sort(() => 0.5 - Math.random());
        const questions = [];
        
        for (let i = 0; i < Math.min(numQuestions, shuffledCards.length); i++) {
            const correctCard = shuffledCards[i];
            const otherCards = shuffledCards.filter(c => c.id !== correctCard.id);
            
            if (otherCards.length < 3) break;
            
            const wrongOptions = otherCards
                .sort(() => 0.5 - Math.random())
                .slice(0, 3)
                .map(c => c.answer);
            
            const allOptions = [correctCard.answer, ...wrongOptions]
                .sort(() => 0.5 - Math.random());
            
            questions.push({
                question: correctCard.question,
                options: allOptions,
                correctAnswer: correctCard.answer
            });
        }
        
        return questions;
    }

    function renderQuizView() {
        const { questions, currentQuestionIndex } = quizState;
        
        quizFeedback.classList.add('hidden');
        nextQuizQuestionBtn.classList.add('hidden');
        
        if (currentQuestionIndex >= questions.length) {
            // Quiz completado
            const accuracy = Math.round((quizState.score / questions.length) * 100);
            const bonusPoints = quizState.score * 5;
            state.points += bonusPoints;
            
            document.getElementById('quiz-content').innerHTML = `
                <div class="text-center py-8">
                    <div class="text-6xl mb-4">🏆</div>
                    <h2 class="text-2xl font-bold text-slate-200 mb-4">¡Quiz Completado!</h2>
                    <div class="space-y-2 text-slate-300">
                        <p>Puntuación: ${quizState.score}/${questions.length}</p>
                        <p>Precisión: ${accuracy}%</p>
                        <p class="text-teal-400">+${bonusPoints} puntos</p>
                    </div>
                    <button id="finish-quiz-btn" class="mt-6 bg-teal-600 hover:bg-teal-500 text-white px-6 py-3 rounded-lg transition-colors">
                        Volver al Dashboard
                    </button>
                </div>
            `;
            
            document.getElementById('finish-quiz-btn').addEventListener('click', () => {
                navigate(VIEWS.DASHBOARD);
                saveStateToFirestore();
            });
            return;
        }

        quizProgress.textContent = `Pregunta: ${currentQuestionIndex + 1} / ${questions.length}`;
        const question = questions[currentQuestionIndex];
        quizQuestionText.textContent = question.question;
        
        quizOptionsList.innerHTML = '';
        question.options.forEach(option => {
            const optionEl = document.createElement('button');
            optionEl.className = 'quiz-option w-full bg-slate-700 hover:bg-slate-600 text-slate-200 text-left p-4 rounded-lg transition-colors';
            optionEl.textContent = option;
            quizOptionsList.appendChild(optionEl);
        });

        quizState.answered = false;
    }

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
            quizFeedback.textContent = '¡Correcto! +10 puntos';
            quizFeedback.className = 'p-3 rounded-lg bg-green-900 text-green-200 mt-4';
            quizState.score++;
            state.points += 10;
        } else {
            quizFeedback.textContent = `Incorrecto. La respuesta era: ${question.correctAnswer}`;
            quizFeedback.className = 'p-3 rounded-lg bg-red-900 text-red-200 mt-4';
            selectedOption.classList.remove('bg-slate-700', 'opacity-70');
            selectedOption.classList.add('bg-red-700');
        }

        quizFeedback.classList.remove('hidden');
        nextQuizQuestionBtn.classList.remove('hidden');
    });

    nextQuizQuestionBtn.addEventListener('click', () => {
        quizState.currentQuestionIndex++;
        renderQuizView();
    });

    // --- Nueva función render() que actualiza toda la UI ---
    function render() {
        updateStats(); // Esto actualizará los puntos en el header
        renderDashboard();
    }

    // --- Lógica del Pomodoro ---
    
    function updatePomodoroUI() {
        if (!pomodoroTimerEl) return;
        // Asegurarse que state.pomodoro y timeLeft existen
        const timeLeft = state.pomodoro?.timeLeft ?? (25 * 60); 
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        pomodoroTimerEl.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        
        if (startPomodoroBtn) startPomodoroBtn.textContent = state.pomodoro?.isRunning ? 'Pausar' : 'Iniciar';
        
        // Cambiar color de fondo según si es descanso o no
        if (state.pomodoro?.isBreak) {
            document.body.classList.add('bg-teal-900');
            document.body.classList.remove('bg-slate-900');
        } else {
            document.body.classList.remove('bg-teal-900');
            document.body.classList.add('bg-slate-900');
        }
    }

    function startPomodoro() {
        // Asegurarse que state.pomodoro existe
        if (!state.pomodoro) state.pomodoro = defaultState.pomodoro;

        if (state.pomodoro.isRunning) { // Pausar
            clearInterval(state.pomodoro.timer);
            state.pomodoro.isRunning = false;
            // Guardamos el tiempo restante al pausar para el cálculo de endTime si se reanuda
            // No reseteamos endTime aquí
        } else { // Iniciar o Reanudar
            state.pomodoro.isRunning = true;
            
            // Si no hay endTime o ya pasó, calcular uno nuevo
            if (!state.pomodoro.endTime || state.pomodoro.endTime <= Date.now()) {
                 state.pomodoro.endTime = Date.now() + (state.pomodoro.timeLeft * 1000);
            }
            // Si hay endTime futuro (reanudar después de recarga), ajustar timeLeft
            else { 
                state.pomodoro.timeLeft = Math.round((state.pomodoro.endTime - Date.now()) / 1000);
            }

            // Iniciar intervalo
            state.pomodoro.timer = setInterval(() => {
                const now = Date.now();
                const timeLeftMs = state.pomodoro.endTime - now;
                
                if (timeLeftMs <= 0) { // Tiempo terminado
                    handlePomodoroFinish();
                } else { // Actualizar tiempo restante
                    state.pomodoro.timeLeft = Math.round(timeLeftMs / 1000);
                }
                updatePomodoroUI(); // Actualizar UI en cada tick
            }, 1000);
        }
        updatePomodoroUI(); // Actualizar UI al iniciar/pausar
        // Guardar estado al iniciar/pausar (para persistir isRunning y endTime)
        saveStateToFirestore(); 
    }
    
    function handlePomodoroFinish() {
        clearInterval(state.pomodoro.timer);
        state.pomodoro.isRunning = false;
        state.pomodoro.endTime = null; // Limpiar endTime al finalizar
        
        playPomodoroSound(state.pomodoro.isBreak); // Reproducir sonido

        if (state.pomodoro.isBreak) { // Si terminó un descanso
            state.pomodoro.isBreak = false;
            state.pomodoro.timeLeft = 25 * 60; // Volver a tiempo de estudio
            showNotification("¡Descanso terminado! Es hora de enfocarse.");
        } else { // Si terminó un pomodoro de estudio
            state.pomodoro.isBreak = true;
            state.pomodoro.timeLeft = 5 * 60; // Iniciar tiempo de descanso
            state.points += 25; // Sumar puntos
            state.studyTimeMinutes += 25; // Sumar tiempo estudiado
            logStudyActivity(); // Registrar actividad
            showNotification("¡Pomodoro completado! +25 puntos. ¡Toma un descanso!");
        }
        
        updatePomodoroUI(); // Actualizar UI
        render(); // Actualizar toda la UI incluídos los puntos
        saveStateToFirestore(); // Guardar el nuevo estado (isBreak, timeLeft, puntos, etc.)
    }

    function resetPomodoro() {
        clearInterval(state.pomodoro.timer); // Detener timer si está corriendo
        state.pomodoro.isRunning = false;
        state.pomodoro.isBreak = false;
        state.pomodoro.timeLeft = 25 * 60; // Reiniciar tiempo a 25 min
        state.pomodoro.endTime = null; // Limpiar endTime
        updatePomodoroUI(); // Actualizar UI
        saveStateToFirestore(); // Guardar estado reseteado
    }
    
    // Chequea si había un pomodoro corriendo al cargar la página
    function checkRunningPomodoro() {
        if (!state.pomodoro) return; // Salir si no hay estado de pomodoro
        // Si hay un endTime futuro
        if (state.pomodoro.endTime && state.pomodoro.endTime > Date.now()) {
            // Calcular tiempo restante y reanudar
            state.pomodoro.timeLeft = Math.round((state.pomodoro.endTime - Date.now()) / 1000);
            startPomodoro(); // Reanuda el intervalo y actualiza UI
        } 
        // Si hay un endTime pasado (la página se recargó después de que terminó)
        else if (state.pomodoro.endTime && state.pomodoro.endTime <= Date.now()) {
            // Manejar como si acabara de terminar
            handlePomodoroFinish(); 
        }
    }

    // Añadir listeners a los botones del Pomodoro
    if (startPomodoroBtn) startPomodoroBtn.addEventListener('click', startPomodoro);
    if (resetPomodoroBtn) resetPomodoroBtn.addEventListener('click', resetPomodoro);


    // --- Utilidades ---
    
    // Obtiene la fecha de hoy como 'YYYY-MM-DD'
    function getTodayString() {
        return new Date().toISOString().split('T')[0]; 
    }

    // Muestra una notificación temporal en la parte inferior
    function showNotification(message) {
        if (!notification) return;
        notification.textContent = message;
        // Hacer visible y animar entrada
        notification.classList.remove('hidden', 'opacity-0', 'translate-y-full');
        notification.classList.add('opacity-100', '-translate-y-4');
        
        // Ocultar después de 3 segundos
        setTimeout(() => {
            // Animar salida
            notification.classList.remove('opacity-100', '-translate-y-4');
            notification.classList.add('opacity-0', 'translate-y-full');
            // Ocultar completamente después de la animación
            setTimeout(() => notification.classList.add('hidden'), 500); 
        }, 3000);
    }
    
    // Contexto de Audio Web (para sonidos)
    let audioCtx;
    // Reproduce un sonido simple (beep)
    function playPomodoroSound(isBreak) {
        try {
            // Crear contexto de audio si no existe (importante hacerlo tras interacción del usuario)
            if (!audioCtx) {
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (!audioCtx) return; // Salir si Web Audio no es compatible
            
            // Crear oscilador (genera tono) y gain (controla volumen)
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            
            // Conectar nodos: oscilador -> gain -> salida de audio
            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            
            // Configurar oscilador
            oscillator.type = 'sine'; // Tipo de onda
            // Frecuencia diferente para descanso y estudio
            oscillator.frequency.setValueAtTime(isBreak ? 660 : 440, audioCtx.currentTime); 
            // Volumen (0 a 1)
            gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime); 
            
            // Iniciar y detener el sonido (dura 0.5 segundos)
            oscillator.start(audioCtx.currentTime);
            oscillator.stop(audioCtx.currentTime + 0.5);
            
        } catch (e) {
            // Capturar errores (ej: navegador no soporta Web Audio)
            console.error("Error al reproducir sonido:", e); 
        }
    }

    // Llamada inicial para renderizar la app al cargar
    render(); 

}); // Fin de DOMContentLoaded