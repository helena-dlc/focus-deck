// --- IMPORTACIONES DE FIREBASE  ---
// Usamos los CDN oficiales de Firebase como módulos ES
// Import the functions you need from the SDKs you need
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
    Timestamp 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


// --- CONFIGURACIÓN DE FIREBASE (¡TUS LLAVES!) ---
// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyC6tqffatZ7NhMm5bGRh0kmjCLymj0DD74", // Corregí el espacio en blanco
  authDomain: "focus-deck.firebaseapp.com",
  projectId: "focus-deck",
  storageBucket: "focus-deck.firebasestorage.app",
  messagingSenderId: "81821453657",
  appId: "1:81821453657:web:deb38c2d4b00113bec9048",
  measurementId: "G-YNNE0HPCK2"
};

// --- INICIALIZAR FIREBASE (¡NUEVO!) ---
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);

// --- ESTADO GLOBAL ---
let currentUserId = null; // ID del usuario logueado
let unsubscribeFromFirestore = null; // Función para dejar de escuchar cambios

// Estado inicial para un nuevo usuario
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
// El estado activo de la aplicación
let state = { ...defaultState }; 


document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();

    const VIEWS = {
        DASHBOARD: 'dashboard-view',
        STUDY: 'study-view',
        MANAGE: 'deck-manage-view',
        QUIZ: 'quiz-view',
    };

    // --- DOM Elements ---
    // ¡NUEVOS elementos de Auth!
    const authContainer = document.getElementById('auth-container');
    const loginView = document.getElementById('login-view');
    const mainContent = document.getElementById('main-content');
    const loginBtn = document.getElementById('login-btn');
    
    // El 'pointsDisplay' ahora se crea dinámicamente, así que lo buscamos de otra forma
    // const pointsDisplay = document.getElementById('points-display'); 
    const deckList = document.getElementById('deck-list');
    const newDeckModal = document.getElementById('new-deck-modal');
    const newDeckNameInput = document.getElementById('new-deck-name');
    
    // --- Pomodoro ---
    const pomodoroTimerEl = document.getElementById('pomodoro-timer');
    const startPomodoroBtn = document.getElementById('start-pomodoro');
    const resetPomodoroBtn = document.getElementById('reset-pomodoro');
    
    // --- Tareas ---
    const taskList = document.getElementById('task-list');
    const newTaskInput = document.getElementById('new-task-input');
    const taskPriority = document.getElementById('task-priority');
    const addTaskBtn = document.getElementById('add-task-btn');
    
    // --- Stats ---
    const statsStreak = document.getElementById('stats-streak');
    const statsHours = document.getElementById('stats-hours');
    const statsMastery = document.getElementById('stats-mastery');
    const statsDeckProgress = document.getElementById('stats-deck-progress');

    // --- Vistas ---
    const studyView = document.getElementById('study-view');
    const dashboardView = document.getElementById('dashboard-view');
    const manageDeckView = document.getElementById('deck-manage-view');
    const quizView = document.getElementById('quiz-view');
    
    // --- Study Session ---
    const studyDeckName = document.getElementById('study-deck-name');
    const studyProgressText = document.getElementById('study-progress-text');
    const studyProgressBar = document.querySelector('#study-progress-bar .progress-bar-inner');
    const cardContainer = document.querySelector('.card');
    const cardFront = document.getElementById('card-front').querySelector('p');
    const cardBack = document.getElementById('card-back').querySelector('p');
    const cardFrontImg = document.getElementById('card-front-img');
    const cardBackImg = document.getElementById('card-back-img');
    const studyControlsShow = document.getElementById('study-controls-show');
    const studyControlsRate = document.getElementById('study-controls-rate');
    const showAnswerBtn = document.getElementById('show-answer-btn');
    const studyComplete = document.getElementById('study-complete');
    const sessionPointsEl = document.getElementById('session-points');
    
    // --- Manage Deck ---
    const manageDeckName = document.getElementById('manage-deck-name');
    const deleteDeckBtn = document.getElementById('delete-deck-btn');
    const newCardQuestion = document.getElementById('new-card-question');
    const newCardAnswer = document.getElementById('new-card-answer');
    const newCardQuestionImg = document.getElementById('new-card-question-img');
    const newCardAnswerImg = document.getElementById('new-card-answer-img');
    const addCardToDeckBtn = document.getElementById('add-card-to-deck-btn');
    const cardList = document.getElementById('card-list');

    // --- Quiz ---
    const quizDeckName = document.getElementById('quiz-deck-name');
    const quizContainer = document.getElementById('quiz-container');
    const quizResults = document.getElementById('quiz-results');
    const quizScore = document.getElementById('quiz-score');
    const quizPoints = document.getElementById('quiz-points');
    const finishQuizBtn = document.getElementById('finish-quiz-btn');

    // --- Modals ---
    const notificationModal = document.getElementById('notification-modal');
    const notificationText = document.getElementById('notification-text');
    const notificationOkBtn = document.getElementById('notification-ok-btn');
    
    const confirmModal = document.getElementById('confirm-modal');
    const confirmText = document.getElementById('confirm-text');
    const confirmOkBtn = document.getElementById('confirm-ok-btn');
    const confirmCancelBtn = document.getElementById('confirm-cancel-btn');


    // --- Event Listeners ---
    document.getElementById('add-deck-btn').addEventListener('click', () => newDeckModal.classList.remove('hidden'));
    document.getElementById('cancel-deck-modal').addEventListener('click', () => newDeckModal.classList.add('hidden'));
    document.getElementById('save-deck-modal').addEventListener('click', saveNewDeck);

    deckList.addEventListener('click', handleDeckListClick);
    cardList.addEventListener('click', handleCardListClick);
    taskList.addEventListener('click', handleTaskListClick);
    addTaskBtn.addEventListener('click', addTask);
    
    showAnswerBtn.addEventListener('click', () => {
        cardContainer.classList.add('is-flipped');
        studyControlsShow.classList.add('hidden');
        studyControlsRate.classList.remove('hidden');
    });

    studyControlsRate.addEventListener('click', e => {
        if (e.target.classList.contains('rate-btn')) {
            processCardReview(e.target.dataset.difficulty);
            setTimeout(showNextCard, 300); // Dar tiempo a ver el feedback
        }
    });
    
    document.getElementById('finish-session-btn').addEventListener('click', () => navigate(VIEWS.DASHBOARD));
    document.getElementById('back-to-dashboard-study').addEventListener('click', () => navigate(VIEWS.DASHBOARD));
    document.getElementById('back-to-dashboard-manage').addEventListener('click', () => navigate(VIEWS.DASHBOARD));
    document.getElementById('back-to-dashboard-quiz').addEventListener('click', () => navigate(VIEWS.DASHBOARD));


    // --- State Management & Persistence (¡REHECHO CON FIREBASE!) ---
    
    /**
     * Guarda el estado actual de la aplicación en Firestore.
     * Esta función reemplaza a saveState() con localStorage.
     */
    async function saveStateToFirestore() {
        if (!currentUserId) {
            console.warn("Intento de guardado sin usuario logueado.");
            return;
        }
        try {
            // Creamos una copia del estado para no guardar cosas innecesarias
            const stateToSave = { ...state };
            
            // No guardamos el timer, solo la info de tiempo
            // Hacemos una copia profunda de pomodoro para no afectar el estado local
            stateToSave.pomodoro = { ...state.pomodoro };
            delete stateToSave.pomodoro.timer; 
            
            // No guardamos sesiones de estudio
            stateToSave.studySession = { ...defaultState.studySession };
            
            // Convertimos las fechas de las tarjetas (si existen) a Timestamps de Firestore
            stateToSave.decks = stateToSave.decks.map(deck => ({
                ...deck,
                cards: deck.cards.map(card => {
                    const cardCopy = { ...card };
                    if (cardCopy.nextReviewDate && !(cardCopy.nextReviewDate instanceof Timestamp)) {
                        try {
                            // Asumimos que es un string ISO "YYYY-MM-DD"
                            cardCopy.nextReviewDate = Timestamp.fromDate(new Date(cardCopy.nextReviewDate + 'T12:00:00Z')); // Usar mediodía UTC
                        } catch(e) {
                            console.error("Error convirtiendo fecha:", cardCopy.nextReviewDate, e);
                            cardCopy.nextReviewDate = Timestamp.now();
                        }
                    } else if (!cardCopy.nextReviewDate) {
                         cardCopy.nextReviewDate = Timestamp.now();
                    }
                    return cardCopy;
                })
            }));
            
            const userDocRef = doc(db, "users", currentUserId);
            // Usamos setDoc (sin merge) para sobreescribir. Esto asegura que si eliminamos un mazo, se elimine de la BD.
            await setDoc(userDocRef, stateToSave);
        } catch (error) {
            console.error("Error guardando estado en Firestore: ", error);
            showNotification("Error al guardar tu progreso. Revisa tu conexión.");
        }
    }

    /**
     * Escucha cambios en los datos del usuario desde Firestore en tiempo real.
     * Reemplaza a loadState()
     */
    function listenToUserData(userId) {
        // Si ya hay una escucha, la cancelamos
        if (unsubscribeFromFirestore) {
            unsubscribeFromFirestore();
        }
        
        const userDocRef = doc(db, "users", userId);
        
        unsubscribeFromFirestore = onSnapshot(userDocRef, (docSnap) => {
            if (docSnap.exists()) {
                // --- El usuario ya tiene datos guardados ---
                const firestoreData = docSnap.data();
                
                // Cargamos el estado desde Firestore
                state = { ...defaultState, ...firestoreData };

                // --- MIGRACIÓN DE DATOS (igual que antes) ---
                const defaultPomodoro = { timer: null, timeLeft: 25 * 60, isBreak: false, isRunning: false, endTime: null };
                // Mantenemos el timer local, pero cargamos el resto
                state.pomodoro = { 
                    timer: state.pomodoro ? state.pomodoro.timer : null, // Preservar el timer local si existe
                    ...defaultPomodoro, 
                    ...(firestoreData.pomodoro || {}) 
                };
                if (state.pomodoro.isRunning) {
                    state.pomodoro.isRunning = false; // Siempre pausado al cargar
                }
                
                state.studySession = defaultState.studySession; // Nunca cargamos una sesión en progreso
                
                // Convertir Timestamps de Firestore a strings "YYYY-MM-DD"
                if (state.decks) {
                    state.decks.forEach(deck => {
                        if (deck.cards) {
                            deck.cards.forEach(card => {
                                // Asegurar que las tarjetas tienen las nuevas props
                                card.questionImg = card.questionImg || null;
                                card.answerImg = card.answerImg || null;
                                // Convertir Timestamp a string
                                if (card.nextReviewDate && card.nextReviewDate.toDate) {
                                    card.nextReviewDate = card.nextReviewDate.toDate().toISOString().split('T')[0];
                                }
                            });
                        }
                    });
                }
                // --- FIN MIGRACIÓN ---
                
            } else {
                // --- Es un usuario nuevo ---
                console.log("Usuario nuevo, creando documento...");
                state = { ...defaultState };
                saveStateToFirestore(); // Guardamos el estado inicial en la nube
            }
            
            // Renderizamos la app con los datos cargados
            console.log("Estado cargado:", state);
            render();
            // Re-chequear pomodoro por si se recargó la página
            checkRunningPomodoro();
            
        }, (error) => {
            console.error("Error escuchando datos de Firestore: ", error);
            showNotification("Error al cargar tus datos. Intenta recargar la página.");
        });
    }

    // --- LÓGICA DE AUTENTICACIÓN (¡NUEVO!) ---
    
    /**
     * Maneja el estado de autenticación del usuario.
     * Esta es la función MÁS IMPORTANTE. Se dispara al cargar la página.
     */
    onAuthStateChanged(auth, (user) => {
        if (user) {
            // --- Usuario está LOGUEADO ---
            console.log("Usuario logueado:", user.uid);
            currentUserId = user.uid;
            
            // Mostrar la app principal y ocultar el login
            loginView.classList.remove('active');
            loginView.classList.add('hidden');
            mainContent.classList.remove('hidden');
            
            // Renderizar el perfil del usuario en el header
            renderUserProfile(user);
            
            // Empezar a escuchar sus datos
            listenToUserData(user.uid);
            
        } else {
            // --- Usuario está DESLOGUEADO ---
            console.log("Usuario deslogueado.");
            currentUserId = null;
            
            // Mostrar el login y ocultar la app
            loginView.classList.add('active');
            loginView.classList.remove('hidden');
            mainContent.classList.add('hidden');
            
            // Renderizar el botón de login
            renderLoginButton();
            
            // Dejar de escuchar datos
            if (unsubscribeFromFirestore) {
                unsubscribeFromFirestore();
            }
            
            // Resetear el estado al por defecto
            state = { ...defaultState };
            render(); // Renderizar la app vacía (oculta)
        }
    });

    /**
     * Muestra el botón de "Iniciar Sesión"
     */
    function renderLoginButton() {
        authContainer.innerHTML = `
            <button id="login-btn-header" class="bg-primary hover:bg-primary-dark text-dark-bg font-bold py-2 px-4 rounded-full text-sm transition-colors">
                Iniciar Sesión
            </button>
        `;
        // El listener de #login-btn (el grande) ya está, podemos añadir uno a este también
        document.getElementById('login-btn-header').addEventListener('click', signInWithGoogle);
    }

    /**
     * Muestra la foto, puntos y botón de "Cerrar Sesión" del usuario
     */
    function renderUserProfile(user) {
        authContainer.innerHTML = `
            <div class="flex items-center gap-2 bg-dark-card px-4 py-2 rounded-full shadow-lg">
                <i data-lucide="star" class="w-5 h-5 text-yellow-400"></i>
                <span id="points-display" class="text-lg font-semibold">${state.points}</span>
            </div>
            <img src="${user.photoURL}" alt="${user.displayName}" class="w-10 h-10 rounded-full border-2 border-primary">
            <button id="logout-btn" class="text-slate-400 hover:text-primary p-2 rounded-full transition-colors">
                <i data-lucide="log-out" class="w-5 h-5"></i>
            </button>
        `;
        lucide.createIcons();
        
        // Añadir listener al botón de logout
        document.getElementById('logout-btn').addEventListener('click', signOutUser);
    }

    /**
     * Inicia el popup de "Iniciar Sesión con Google"
     */
    async function signInWithGoogle() {
        const provider = new GoogleAuthProvider();
        try {
            await signInWithPopup(auth, provider);
            // onAuthStateChanged se encargará del resto
        } catch (error) {
            console.error("Error al iniciar sesión con Google: ", error);
            showNotification("Error al iniciar sesión. Inténtalo de nuevo.");
        }
    }

    /**
     * Cierra la sesión del usuario
     */
    async function signOutUser() {
        try {
            await signOut(auth);
            // onAuthStateChanged se encargará del resto
        } catch (error) {
            console.error("Error al cerrar sesión: ", error);
        }
    }
    
    // Asignar el listener al botón de login principal
    loginBtn.addEventListener('click', signInWithGoogle);


    // --- FIN LÓGICA DE AUTENTICACIÓN ---


    // --- REEMPLAZAR saveState() por saveStateToFirestore() ---
    // Esta función ahora solo llama a la nueva
    function saveState() {
        // Usamos un pequeño debounce para no saturar firestore
        // (Aunque para esta app no es crítico, es buena práctica)
        setTimeout(saveStateToFirestore, 300);
    }
    
    // Esta función ya no es necesaria, onAuthStateChanged la reemplaza
    // function loadState() { ... }
    
    function addPoints(amount) {
        state.points = Math.max(0, state.points + amount);
        renderPoints();
    }
    
    function renderPoints() {
        // Modificado para que solo actualice si el elemento existe
        const pointsEl = document.getElementById('points-display');
        if (pointsEl) {
            pointsEl.textContent = state.points;
            pointsEl.classList.add('animate-pulse');
            setTimeout(() => {
                if(pointsEl) pointsEl.classList.remove('animate-pulse');
            }, 500);
        }
    }

    // --- Notification & Confirm Modals ---
    function showNotification(message) {
        notificationText.textContent = message;
        notificationModal.classList.remove('hidden');
    }
    
    notificationOkBtn.addEventListener('click', () => {
        notificationModal.classList.add('hidden');
    });

    function showConfirm(message, onConfirm) {
        confirmText.textContent = message;
        confirmModal.classList.remove('hidden');
        
        // Remover listeners antiguos antes de añadir nuevos
        const newOkBtn = confirmOkBtn.cloneNode(true);
        confirmOkBtn.parentNode.replaceChild(newOkBtn, confirmOkBtn);
        confirmOkBtn = newOkBtn; // Actualizar la referencia
        
        const newCancelBtn = confirmCancelBtn.cloneNode(true);
        confirmCancelBtn.parentNode.replaceChild(newCancelBtn, confirmCancelBtn);
        confirmCancelBtn = newCancelBtn; // Actualizar la referencia
        
        confirmOkBtn.addEventListener('click', () => {
            confirmModal.classList.add('hidden');
            onConfirm(); // Ejecutar la acción confirmada
        });
        
        confirmCancelBtn.addEventListener('click', () => {
            confirmModal.classList.add('hidden');
        });
    }

    
    // --- Navigation ---
    function navigate(viewId, deckId = null) {
        document.querySelectorAll('.view').forEach(v => {
            v.classList.remove('active');
            if(v.id !== viewId) v.classList.add('hidden');
        });
        
        const targetView = document.getElementById(viewId);
        if (targetView) {
            targetView.classList.add('active');
            targetView.classList.remove('hidden');
        } else {
            console.error(`Vista no encontrada: ${viewId}`);
            document.getElementById(VIEWS.DASHBOARD).classList.add('active');
            document.getElementById(VIEWS.DASHBOARD).classList.remove('hidden');
        }

        state.currentView = viewId;
        
        if (deckId) {
            state.currentDeckId = deckId;
        }

        // Preparar la vista
        if (viewId === VIEWS.STUDY) {
            startStudySession(state.currentDeckId);
        } else if (viewId === VIEWS.MANAGE) {
            const deck = state.decks.find(d => d.id === state.currentDeckId);
            manageDeckName.textContent = deck.name;
            renderCardList(state.currentDeckId);
        } else if (viewId === VIEWS.QUIZ) {
            startQuiz(state.currentDeckId);
        } else if (viewId === VIEWS.DASHBOARD) {
            renderDecks();
            renderStats();
            renderTasks();
        }
        
        // saveState(); // Guardar el estado de la vista
    }
    
    // --- Rendering ---
    function render() {
        if (!currentUserId) return; // No renderizar nada si no está logueado

        // Renderizar el perfil de usuario si está logueado (esto actualiza los puntos)
        if (auth.currentUser) {
            renderUserProfile(auth.currentUser);
        }
        renderDecks();
        renderTasks();
        renderStats();
        updatePomodoroDisplay();
    }

    function renderDecks() {
        deckList.innerHTML = '';
        if (state.decks.length === 0) {
            deckList.innerHTML = `<p class="text-slate-400 col-span-full text-center">No tienes temas de estudio. ¡Crea tu primer tema para empezar a añadir tarjetas!</p>`;
            return;
        }
        
        const now = new Date().toISOString().split('T')[0];
        
        state.decks.forEach(deck => {
            const cardsToReview = deck.cards.filter(c => !c.nextReviewDate || c.nextReviewDate <= now).length;
            const deckEl = document.createElement('div');
            deckEl.className = 'bg-dark-card p-5 rounded-2xl shadow-lg transition-transform hover:scale-105 cursor-pointer';
            deckEl.dataset.deckId = deck.id;
            
            deckEl.innerHTML = `
                <h3 class="text-xl font-bold truncate mb-2">${deck.name}</h3>
                <p class="text-slate-400 text-sm mb-4">${deck.cards.length} tarjeta(s)</p>
                ${cardsToReview > 0 ? 
                    `<span class="bg-primary text-dark-bg text-xs font-bold px-3 py-1 rounded-full">${cardsToReview} para repasar hoy</span>` : 
                    `<span class="bg-dark-border text-slate-300 text-xs font-bold px-3 py-1 rounded-full">Al día</span>`
                }
                <div class="flex gap-2 mt-4">
                    <button data-action="study" class="flex-1 bg-primary hover:bg-primary-dark text-dark-bg font-bold py-2 px-3 rounded-full text-sm">Estudiar</button>
                    <button data-action="quiz" class="flex-1 bg-dark-border hover:bg-slate-600 text-secondary font-bold py-2 px-3 rounded-full text-sm">Quiz</button>
                    <button data-action="manage" class="p-2 bg-dark-border hover:bg-slate-600 text-secondary rounded-full"><i data-lucide="settings-2" class="w-4 h-4 pointer-events-none"></i></button>
                </div>
            `;
            deckList.appendChild(deckEl);
        });
        lucide.createIcons();
    }
    
    function renderTasks() {
        taskList.innerHTML = '';
        if (state.tasks.length === 0) {
            taskList.innerHTML = `<p class="text-slate-400 text-center">No hay tareas pendientes. ¡Añade una!</p>`;
            return;
        }
        
        // Ordenar por prioridad (1=Alta, 3=Baja) y luego por fecha
        const sortedTasks = [...state.tasks].sort((a, b) => {
            if (a.completed !== b.completed) {
                return a.completed ? 1 : -1; // Incompletas primero
            }
            if (a.priority !== b.priority) {
                return a.priority - b.priority; // Prioridad alta (1) primero
            }
            return new Date(a.id) - new Date(b.id); // Más antiguas primero
        });
        
        sortedTasks.forEach(task => {
            const taskEl = document.createElement('div');
            const priorityColors = { 1: 'border-red-500', 2: 'border-yellow-500', 3: 'border-blue-500' };
            taskEl.className = `flex items-center gap-3 bg-dark-bg p-3 rounded-lg border-l-4 ${priorityColors[task.priority]} ${task.completed ? 'opacity-50' : ''}`;
            taskEl.dataset.taskId = task.id;
            taskEl.innerHTML = `
                <button data-action="toggle" class="p-0 m-0 text-slate-400 hover:text-primary">
                    <i data-lucide="${task.completed ? 'check-square' : 'square'}" class="w-6 h-6 pointer-events-none"></i>
                </button>
                <span class="flex-grow ${task.completed ? 'line-through text-slate-500' : ''}">${task.text}</span>
                <button data-action="delete" class="p-0 m-0 text-slate-500 hover:text-red-500">
                    <i data-lucide="trash-2" class="w-5 h-5 pointer-events-none"></i>
                </button>
            `;
            taskList.appendChild(taskEl);
        });
        lucide.createIcons();
    }

    // --- Stats ---
    function renderStats() {
        statsStreak.textContent = calculateStreak();
        statsHours.textContent = (state.studyTimeMinutes / 60).toFixed(1);

        const allCards = state.decks.flatMap(d => d.cards);
        const totalCards = allCards.length;
        if (totalCards === 0) {
            statsMastery.textContent = '0%';
            statsDeckProgress.innerHTML = `<p class="text-slate-400 text-center">Añade temas para ver tu progreso.</p>`;
            return;
        }
        
        // Dominio = tarjetas con intervalo > 21 días
        const masteredCards = allCards.filter(c => c.interval >= 21).length;
        statsMastery.textContent = `${Math.round((masteredCards / totalCards) * 100)}%`;
        
        // Progreso por tema
        statsDeckProgress.innerHTML = '';
        state.decks.forEach(deck => {
            const total = deck.cards.length;
            if (total === 0) return;
            const mastered = deck.cards.filter(c => c.interval >= 21).length;
            const masteryPercent = Math.round((mastered / total) * 100);
            
            const progressEl = document.createElement('div');
            progressEl.innerHTML = `
                <div class="flex justify-between text-sm mb-1">
                    <span class="font-medium">${deck.name}</span>
                    <span class="text-slate-400">${masteryPercent}%</span>
                </div>
                <div class="w-full bg-dark-border rounded-full h-2.5">
                  <div class="bg-primary h-2.5 rounded-full" style="width: ${masteryPercent}%"></div>
                </div>
            `;
            statsDeckProgress.appendChild(progressEl);
        });
    }

    function calculateStreak() {
        if (!state.studyLog || state.studyLog.length === 0) return 0;

        const uniqueDays = [...new Set(state.studyLog)].sort((a,b) => new Date(b) - new Date(a));
        let streak = 0;
        let today = new Date();
        
        // Función para comparar solo YYYY-MM-DD
        const isSameDay = (d1, d2) => 
            d1.getFullYear() === d2.getFullYear() &&
            d1.getMonth() === d2.getMonth() &&
            d1.getDate() === d2.getDate();

        // Chequear si hoy está en el log
        if (uniqueDays.some(dayStr => isSameDay(new Date(dayStr), today))) {
            streak = 1;
            let yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);

            for (let i = 1; i < uniqueDays.length; i++) {
                if (isSameDay(new Date(uniqueDays[i]), yesterday)) {
                    streak++;
                    yesterday.setDate(yesterday.getDate() - 1);
                } else {
                    break;
                }
            }
        }
        // Chequear si ayer está en el log (si hoy no está)
        else {
            let yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            if (uniqueDays.some(dayStr => isSameDay(new Date(dayStr), yesterday))) {
                 streak = 1; // Empezó ayer
                 let dayBeforeYesterday = new Date(yesterday);
                 dayBeforeYesterday.setDate(dayBeforeYesterday.getDate() - 1);
                 
                 for (let i = 1; i < uniqueDays.length; i++) {
                     if (isSameDay(new Date(uniqueDays[i]), dayBeforeYesterday)) {
                        streak++;
                        dayBeforeYesterday.setDate(dayBeforeYesterday.getDate() - 1);
                     } else {
                        break;
                     }
                 }
            }
        }
        return streak;
    }

    // --- Log de día de estudio ---
    function logStudyDay() {
        const today = new Date().toISOString().split('T')[0];
        if (!state.studyLog) {
            state.studyLog = [];
        }
        if (!state.studyLog.includes(today)) {
            state.studyLog.push(today);
            console.log("Día de estudio registrado:", today);
        }
    }

    // --- Deck Management ---
    function saveNewDeck() {
        const name = newDeckNameInput.value.trim();
        if (name) {
            const newDeck = {
                id: `deck-${Date.now()}`,
                name: name,
                cards: []
            };
            state.decks.push(newDeck);
            newDeckNameInput.value = '';
            newDeckModal.classList.add('hidden');
            renderDecks();
            saveState(); // ¡CAMBIO A saveState() que llama a Firestore!
        }
    }
    
    function handleDeckListClick(e) {
        const target = e.target.closest('[data-action]');
        if (!target) return;
        
        const action = target.dataset.action;
        const deckEl = e.target.closest('[data-deck-id]');
        const deckId = deckEl.dataset.deckId;

        if (action === 'study') {
            navigate(VIEWS.STUDY, deckId);
        } else if (action === 'quiz') {
            const deck = state.decks.find(d => d.id === deckId);
            if (deck.cards.length < 4) {
                showNotification("Necesitas al menos 4 tarjetas en este tema para generar un quiz.");
            } else {
                navigate(VIEWS.QUIZ, deckId);
            }
        } else if (action === 'manage') {
            navigate(VIEWS.MANAGE, deckId);
        }
    }

    deleteDeckBtn.addEventListener('click', () => {
        // CAMBIO: Usar modal de confirmación
        showConfirm('¿Seguro que quieres eliminar este tema y todas sus tarjetas? Esta acción no se puede deshacer.', () => {
            state.decks = state.decks.filter(d => d.id !== state.currentDeckId);
            saveState(); // ¡CAMBIO!
            navigate(VIEWS.DASHBOARD);
            renderDecks();
            renderStats(); // Actualizar stats
        });
    });

    // --- Card Management ---
    function handleCardListClick(e) {
        const target = e.target.closest('[data-action]');
        if (!target) return;
        
        if (target.dataset.action === 'delete') {
            showConfirm('¿Eliminar esta tarjeta?', () => {
                const cardId = target.dataset.cardId;
                const deck = state.decks.find(d => d.id === state.currentDeckId);
                deck.cards = deck.cards.filter(c => c.id !== cardId);
                saveState(); // ¡CAMBIO!
                renderCardList(state.currentDeckId);
                renderStats(); // Actualizar stats
            });
        }
    }

    function renderCardList(deckId) {
        const deck = state.decks.find(d => d.id === deckId);
        cardList.innerHTML = '';
        if (deck.cards.length === 0) {
            cardList.innerHTML = `<p class="text-slate-400 text-center">No hay tarjetas en este tema.</p>`;
            return;
        }
        
        // Mostrar las más nuevas primero
        [...deck.cards].reverse().forEach(card => {
            const cardEl = document.createElement('div');
            cardEl.className = 'bg-dark-bg p-4 rounded-lg flex items-center justify-between';
            cardEl.innerHTML = `
                <div class="flex-1 min-w-0">
                    <p class="truncate"><strong>P:</strong> ${card.question}</p>
                    <p class="truncate"><strong>R:</strong> ${card.answer}</p>
                    ${card.questionImg ? `<img src="${card.questionImg}" class="h-10 w-10 rounded mt-1 object-cover" onerror="this.style.display='none'; this.src=''">` : ''}
                </div>
                <button data-action="delete" data-card-id="${card.id}" class="ml-4 text-slate-500 hover:text-red-500 p-2">
                    <i data-lucide="trash-2" class="w-5 h-5 pointer-events-none"></i>
                </button>
            `;
            cardList.appendChild(cardEl);
        });
        lucide.createIcons();
    }

    addCardToDeckBtn.addEventListener('click', () => {
        const question = newCardQuestion.value.trim();
        const answer = newCardAnswer.value.trim();
        const questionImg = newCardQuestionImg.value.trim();
        const answerImg = newCardAnswerImg.value.trim();
        
        const deck = state.decks.find(d => d.id === state.currentDeckId);

        if (deck && (question || questionImg)) { // Permitir tarjetas solo con imagen
            const newCard = {
                id: `card-${Date.now()}`,
                question: question,
                answer: answer,
                questionImg: questionImg || null, // NUEVO
                answerImg: answerImg || null, // NUEVO
                easeFactor: 2.5,
                interval: 0,
                repetitions: 0,
                nextReviewDate: new Date().toISOString().split('T')[0] // Se convertirá a Timestamp al guardar
            };
            deck.cards.push(newCard);
            
            newCardQuestion.value = '';
            newCardAnswer.value = '';
            newCardQuestionImg.value = ''; // NUEVO
            newCardAnswerImg.value = ''; // NUEVO
            saveState(); // ¡CAMBIO!
            renderCardList(state.currentDeckId);
            renderStats(); // Actualizar stats
        } else {
            showNotification('La tarjeta debe tener al menos una pregunta o una imagen de pregunta.');
        }
    });

    // --- Study Session ---
    function startStudySession(deckId) {
        const deck = state.decks.find(d => d.id === deckId);
        studyDeckName.textContent = deck.name;
        resetStudyView();
        
        const now = new Date().toISOString().split('T')[0];
        // ¡OJO! Filtro modificado para comparar fechas como strings
        state.studySession.cardsToReview = deck.cards
            .map(c => ({...c})) // Copiar tarjetas para no modificar el estado
            .filter(c => !c.nextReviewDate || c.nextReviewDate <= now)
            .sort(() => 0.5 - Math.random()); // Mezclar
        
        state.studySession.currentCardIndex = 0;
        state.studySession.correctAnswers = 0;
        
        if (state.studySession.cardsToReview.length > 0) {
            showNextCard();
        } else {
            endStudySession(); // No hay tarjetas para repasar
        }
    }
    
    function resetStudyView() {
        studyControlsShow.classList.remove('hidden');
        studyControlsRate.classList.add('hidden');
        studyComplete.classList.add('hidden');
        cardContainer.classList.remove('is-flipped');
        studyProgressBar.style.width = '0%';
    }

    function showNextCard() {
         if (state.studySession.currentCardIndex >= state.studySession.cardsToReview.length) {
            endStudySession();
            return;
         }
         
        resetStudyView();
        
        const card = state.studySession.cardsToReview[state.studySession.currentCardIndex];
        
        // Frente
        cardFront.textContent = card.question;
        if (card.questionImg) {
            cardFrontImg.src = card.questionImg;
            cardFrontImg.classList.remove('hidden');
        } else {
            cardFrontImg.src = '';
            cardFrontImg.classList.add('hidden');
        }
        
        // Dorso
        cardBack.textContent = card.answer;
         if (card.answerImg) {
            cardBackImg.src = card.answerImg;
            cardBackImg.classList.remove('hidden');
        } else {
            cardBackImg.src = '';
            cardBackImg.classList.add('hidden');
        }

        updateStudyProgress();
    }
    
    function updateStudyProgress() {
        const total = state.studySession.cardsToReview.length;
        const current = state.studySession.currentCardIndex;
        studyProgressText.textContent = `Progreso: ${current} / ${total}`;
        studyProgressBar.style.width = `${total > 0 ? (current / total) * 100 : 0}%`;
    }

    // Spaced Repetition Algorithm (simplified SM-2)
    function processCardReview(difficulty) {
        const cardInSession = state.studySession.cardsToReview[state.studySession.currentCardIndex];
        
        // --- ¡IMPORTANTE! Modificar la tarjeta en el *estado principal*, no en la copia de la sesión
        const deck = state.decks.find(d => d.id === state.currentDeckId);
        const card = deck.cards.find(c => c.id === cardInSession.id);
        
        if (!card) {
            console.error("No se encontró la tarjeta original en el estado.");
            return;
        }
        // ---
        
        let quality;
        if (difficulty === 'hard') {
            quality = 0;
        } else if (difficulty === 'good') {
            quality = 3;
            state.studySession.correctAnswers++;
        } else { // easy
            quality = 5;
            state.studySession.correctAnswers++;
        }

        if (quality < 3) {
            // Repetir
            card.repetitions = 0;
            card.interval = 0;
            // Poner al final de la cola de esta sesión
            state.studySession.cardsToReview.push(cardInSession);
        } else {
            // Acertada
            if (card.repetitions === 0) {
                card.interval = 1;
            } else if (card.repetitions === 1) {
                card.interval = 6;
            } else {
                card.interval = Math.round(card.interval * card.easeFactor);
            }
            card.repetitions++;
        }

        card.easeFactor = Math.max(1.3, card.easeFactor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));

        const nextReview = new Date();
        nextReview.setHours(12, 0, 0, 0); // Estandarizar a mediodía
        nextReview.setDate(nextReview.getDate() + card.interval);
        card.nextReviewDate = nextReview.toISOString().split('T')[0]; // Guardar como string

        state.studySession.currentCardIndex++;
        saveState(); // ¡CAMBIO! Guardar el estado de la tarjeta
    }

    function endStudySession() {
        studyProgressText.textContent = `Progreso: ${state.studySession.cardsToReview.length} / ${state.studySession.cardsToReview.length}`;
        studyProgressBar.style.width = '100%';
        studyComplete.classList.remove('hidden');
        studyControlsShow.classList.add('hidden');
        studyControlsRate.classList.add('hidden');
        
        const pointsEarned = state.studySession.correctAnswers * 2;
        addPoints(pointsEarned);
        sessionPointsEl.textContent = `Ganaste ${pointsEarned} puntos en esta sesión.`;
        
        logStudyDay(); // <-- AÑADIDO: Registra el día de estudio
        saveState();   // ¡CAMBIO!
        
        renderStats(); // Actualizar stats al terminar
    }
    
    // --- Sonido ---
    let audioCtx;
    function playNotificationSound(type = 'study') {
        if (!audioCtx) {
            try {
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            } catch (e) {
                console.warn('Web Audio API is not supported in this browser');
                return;
            }
        }
        
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }

        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(type === 'study' ? 440 : 523.25, audioCtx.currentTime); // A4 for study, C5 for break
        gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);

        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.5); // 0.5 segundos de sonido
    }
    
    // --- Pomodoro Logic ---
    function updatePomodoroDisplay() {
        const minutes = Math.floor(state.pomodoro.timeLeft / 60);
        const seconds = state.pomodoro.timeLeft % 60;
        pomodoroTimerEl.textContent = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
        document.title = `${pomodoroTimerEl.textContent} - Focus Deck`;
    }
    
    startPomodoroBtn.addEventListener('click', () => {
         // --- NUEVO: Reanudar AudioContext si es necesario (para Chrome) ---
         if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        
        if (state.pomodoro.isRunning) {
            // --- PAUSAR ---
            clearInterval(state.pomodoro.timer);
            state.pomodoro.isRunning = false;
            // Guardar el tiempo restante basado en el endTime
            if (state.pomodoro.endTime) {
                 state.pomodoro.timeLeft = Math.round((state.pomodoro.endTime - Date.now()) / 1000);
            }
            state.pomodoro.endTime = null;
            startPomodoroBtn.textContent = 'Reanudar';
            saveState(); // ¡CAMBIO! Guardar estado de pausa
        } else {
            // --- INICIAR o REANUDAR ---
            state.pomodoro.isRunning = true;
            startPomodoroBtn.textContent = 'Pausar';
            
            // Calcular el tiempo final
            state.pomodoro.endTime = Date.now() + (state.pomodoro.timeLeft * 1000);
            
            state.pomodoro.timer = setInterval(() => {
                const newTimeLeft = Math.round((state.pomodoro.endTime - Date.now()) / 1000);
                state.pomodoro.timeLeft = Math.max(0, newTimeLeft);
                updatePomodoroDisplay();
                
                if (state.pomodoro.timeLeft <= 0) {
                    clearInterval(state.pomodoro.timer);
                    state.pomodoro.isRunning = false;
                    handlePomodoroFinish(); // Esta función ya guarda el estado
                }
            }, 1000);
            saveState(); // ¡CAMBIO! Guardar estado de inicio
        }
    });
    
    resetPomodoroBtn.addEventListener('click', () => {
        clearInterval(state.pomodoro.timer);
        state.pomodoro.isRunning = false;
        state.pomodoro.isBreak = false;
        state.pomodoro.timeLeft = 25 * 60;
        state.pomodoro.endTime = null;
        updatePomodoroDisplay();
        pomodoroTimerEl.classList.remove('text-green-400');
        startPomodoroBtn.textContent = 'Iniciar';
        saveState(); // ¡CAMBIO!
    });

    function handlePomodoroFinish() {
        playNotificationSound(state.pomodoro.isBreak ? 'break' : 'study');
        
        if (!state.pomodoro.isBreak) {
            // --- TERMINA ESTUDIO, EMPIEZA DESCANSO ---
            addPoints(10);
            state.studyTimeMinutes += 25; // NUEVO: Log de tiempo
            logStudyDay(); // NUEVO: Log de racha
            
            showNotification("¡Pomodoro completado! Tómate un descanso de 5 minutos.");
            state.pomodoro.timeLeft = 5 * 60;
            state.pomodoro.isBreak = true;
            pomodoroTimerEl.classList.add('text-green-400');
            startPomodoroBtn.click(); // Esto iniciará el descanso y guardará el estado
        } else {
            // --- TERMINA DESCANSO, RESETEAR ---
            showNotification("¡Descanso terminado! Listo para otra sesión.");
            state.pomodoro.isBreak = false;
            pomodoroTimerEl.classList.remove('text-green-400');
            resetPomodoroBtn.click(); // Esto reseteará y guardará el estado
        }
    }
    
    // --- Tareas Logic ---
    function addTask() {
        const text = newTaskInput.value.trim();
        if (text) {
            const newTask = {
                id: `task-${Date.now()}`,
                text: text,
                priority: parseInt(taskPriority.value),
                completed: false
            };
            state.tasks.push(newTask);
            newTaskInput.value = '';
            saveState(); // ¡CAMBIO!
            renderTasks();
        }
    }

    function handleTaskListClick(e) {
        const target = e.target.closest('[data-action]');
        if (!target) return;
        
        const taskId = e.target.closest('[data-task-id]').dataset.taskId;
        const action = target.dataset.action;
        
        if (action === 'toggle') {
            const task = state.tasks.find(t => t.id === taskId);
            task.completed = !task.completed;
            if (task.completed) {
                addPoints(5);
                logStudyDay(); // <-- AÑADIDO: Registra el día de estudio
            } else {
                addPoints(-5);
            }
            saveState(); // ¡CAMBIO!
            renderTasks();
        } else if (action === 'delete') {
            showConfirm('¿Eliminar esta tarea?', () => {
                state.tasks = state.tasks.filter(t => t.id !== taskId);
                saveState(); // ¡CAMBIO!
                renderTasks();
            });
        }
    }
    
    // --- Quiz Logic ---
    function startQuiz(deckId) {
        const deck = state.decks.find(d => d.id === deckId);
        quizDeckName.textContent = `Quiz: ${deck.name}`;
        quizContainer.innerHTML = ''; // Limpiar quiz anterior
        quizResults.classList.add('hidden');
        quizContainer.classList.remove('hidden');

        // Seleccionar 10 tarjetas al azar, o todas si son menos de 10
        const shuffled = [...deck.cards].sort(() => 0.5 - Math.random());
        const questions = shuffled.slice(0, Math.min(10, shuffled.length));
        
        questions.forEach((card, index) => {
            const questionEl = document.createElement('div');
            questionEl.className = 'quiz-question bg-dark-card p-6 rounded-2xl mb-4';
            questionEl.dataset.cardId = card.id;

            // Crear opciones de respuesta
            const incorrectAnswers = shuffled
                .filter(c => c.id !== card.id)
                .map(c => c.answer)
                .slice(0, 3);
            
            const options = [...incorrectAnswers, card.answer].sort(() => 0.5 - Math.random());
            
            questionEl.innerHTML = `
                <p class="text-lg font-semibold mb-1">${index + 1}. ${card.question}</p>
                ${card.questionImg ? `<img src="${card.questionImg}" class="max-h-40 rounded-lg my-2" onerror="this.style.display='none'; this.src=''">` : ''}
                <div class="space-y-2 mt-4">
                    ${options.map(option => `
                        <div>
                            <label class="flex items-center gap-3 p-3 bg-dark-bg rounded-lg hover:bg-dark-border cursor-pointer">
                                <input type="radio" name="q${index}" value="${btoa(option)}" class="form-radio text-primary focus:ring-primary">
                                <span>${option}</span>
                            </label>
                        </div>
                    `).join('')}
                </div>
            `;
            quizContainer.appendChild(questionEl);
        });
        
        // Añadir botón de submit
        const submitBtn = document.createElement('button');
        submitBtn.id = 'submit-quiz-btn';
        submitBtn.className = 'w-full bg-primary hover:bg-primary-dark text-dark-bg font-bold py-3 px-6 rounded-full text-lg';
        submitBtn.textContent = 'Corregir Quiz';
        submitBtn.addEventListener('click', submitQuiz);
        quizContainer.appendChild(submitBtn);
    }
    
    function submitQuiz() {
        const questions = document.querySelectorAll('.quiz-question');
        let score = 0;
        
        questions.forEach((qEl, index) => {
            const cardId = qEl.dataset.cardId;
            const deck = state.decks.find(d => d.id === state.currentDeckId);
            const card = deck.cards.find(c => c.id === cardId);
            
            const selectedRadio = qEl.querySelector(`input[name="q${index}"]:checked`);
            if (selectedRadio) {
                const selectedAnswer = atob(selectedRadio.value);
                
                // Marcar visualmente
                const labels = qEl.querySelectorAll('label');
                labels.forEach(label => {
                    const radio = label.querySelector('input');
                    const answerText = label.querySelector('span').textContent;
                    if (answerText === card.answer) {
                        label.classList.add('bg-green-500', 'text-white'); // Respuesta correcta
                    } else if (radio.checked) {
                        label.classList.add('bg-red-500', 'text-white'); // Incorrecta seleccionada
                    }
                });

                if (selectedAnswer === card.answer) {
                    score++;
                }
            }
        });
        
        const pointsEarned = score * 3;
        addPoints(pointsEarned);
        
        logStudyDay(); // <-- AÑADIDO: Registra el día de estudio
        
        saveState(); // ¡CAMBIO!

        quizContainer.classList.add('hidden');
        quizResults.classList.remove('hidden');
        quizScore.textContent = `Tu puntaje: ${score} / ${questions.length}`;
        quizPoints.textContent = `¡Ganaste ${pointsEarned} puntos!`;
        
        document.getElementById('submit-quiz-btn').remove(); // Remover botón
    }
    
    finishQuizBtn.addEventListener('click', () => {
        navigate(VIEWS.DASHBOARD);
        renderDecks();
    });


    // --- Initial Load ---
    // loadState(); // ¡ELIMINADO! onAuthStateChanged maneja esto
    // render(); // ¡ELIMINADO! onAuthStateChanged maneja esto
    
    // Esta función se llama ahora desde onSnapshot
    function checkRunningPomodoro() {
        // Solo reanudar si NO estaba en pausa (es decir, endTime existe)
        if (state.pomodoro.endTime && state.pomodoro.endTime > Date.now()) {
            state.pomodoro.timeLeft = Math.round((state.pomodoro.endTime - Date.now()) / 1000);
            state.pomodoro.isRunning = true;
            startPomodoroBtn.textContent = 'Pausar';
            
            if (state.pomodoro.isBreak) {
                 pomodoroTimerEl.classList.add('text-green-400');
            }
            
            state.pomodoro.timer = setInterval(() => {
                const newTimeLeft = Math.round((state.pomodoro.endTime - Date.now()) / 1000);
                state.pomodoro.timeLeft = Math.max(0, newTimeLeft);
                updatePomodoroDisplay();
                
                if (state.pomodoro.timeLeft <= 0) {
                    clearInterval(state.pomodoro.timer);
                    state.pomodoro.isRunning = false;
                    handlePomodoroFinish();
                }
            }, 1000);
        } else {
            // Si la app se cargó y el tiempo final ya pasó, o si no estaba corriendo
            if (state.pomodoro.isRunning) {
                 // Estaba corriendo, pero el tiempo final ya pasó
                 handlePomodoroFinish();
            } else {
                // Estaba en pausa, solo actualizar la UI
                updatePomodoroDisplay();
            }
        }
    }
    // ¡LA APP ESPERA A QUE onAuthStateChanged SE DISPARE!
});

