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
    const addCardForm = document.getElementById('add-card-form');
    const cardQuestionInput = document.getElementById('card-question');
    const cardAnswerInput = document.getElementById('card-answer');
    const cardQuestionImgInput = document.getElementById('card-question-img');
    const cardAnswerImgInput = document.getElementById('card-answer-img');
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
    });

    // Función para actualizar el header
    function updateAuthUI(user) {
        if (!authContainer) return;
        if (user) {
            // Crear HTML del header
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
            // Añadir listener al botón logout recién creado
            const dynamicLogoutBtn = document.getElementById('logout-btn-dynamic');
            if (dynamicLogoutBtn) {
                dynamicLogoutBtn.addEventListener('click', logout);
            }
        } else {
            // Limpiar header si no hay usuario
            authContainer.innerHTML = '';
        }
    }

     // Función para iniciar sesión
     async function loginWithGoogle() {
        const provider = new GoogleAuthProvider();
        try {
            console.log("Iniciando popup de login...");
            await signInWithPopup(auth, provider);
            // onAuthStateChanged se encargará del resto
        } catch (error) {
            console.error("Error al iniciar sesión: ", error);
             let errorMessage = "Error al iniciar sesión. ";
             if (error.code === 'auth/popup-blocked') {
                 errorMessage += "Popup bloqueado. Habilítalos.";
             } else if (error.code === 'auth/popup-closed-by-user') {
                 errorMessage = null; // No molestar si cierra
             } else {
                 errorMessage += "Inténtalo de nuevo.";
             }
             if (errorMessage) showNotification(errorMessage);
        }
    }

     // Función para cerrar sesión (logout)
     async function logout() {
         try {
             await signOut(auth);
             showNotification("Sesión cerrada.");
             // onAuthStateChanged se encargará de mostrar login
         } catch (error) {
             console.error("Error al cerrar sesión: ", error);
             showNotification("Error al cerrar sesión.");
         }
     }

    // Asignar listener al botón de login INICIAL
    if (loginBtn) {
        loginBtn.addEventListener('click', loginWithGoogle);
    }
    // El listener del botón logout se asigna dinámicamente en updateAuthUI


    // --- Lógica de la App ---
    // (El resto del código desde navigate() hasta el final,
    // asegurándose de que las funciones usan el 'state' global
    // y llaman a saveStateToFirestore() después de modificar datos)

    function navigate(viewId) {
        state.currentView = viewId;
        render(); // Renderizar la nueva vista
    }

    // Render principal - Llama a los renders específicos
    function render() {
        if (!views || !state) return; // Asegurar que state exista
        console.log("Renderizando vista:", state.currentView, "con estado:", state);

        views.forEach(v => v.classList.add('hidden'));

        // Renderizar la vista actual
        switch (state.currentView) {
            case VIEWS.DASHBOARD:
                if (dashboardView) {
                    dashboardView.classList.remove('hidden');
                    renderDashboard(); // Llama a los renders específicos del dashboard
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
            default: // Fallback al dashboard
                if (dashboardView) {
                    dashboardView.classList.remove('hidden');
                    renderDashboard();
                }
        }

        // Actualizar elementos comunes que dependen del estado
         // Los puntos se actualizan en updateAuthUI ahora
        // const pointsDisplay = document.getElementById('points');
        // if (pointsDisplay) pointsDisplay.textContent = `${state.points || 0} pts`;

        updatePomodoroUI();
        if (typeof lucide !== 'undefined') lucide.createIcons(); // Re-renderizar iconos
    }

    // --- Render Dashboard ---
    function renderDashboard() {
        console.log("Renderizando Dashboard...");
        renderTaskList();
        renderDeckList();
        renderStats();
    }

    // --- Lógica de Tareas ---
    function renderTaskList() {
        if (!taskList) return;
        console.log("Renderizando tareas:", state.tasks);
        taskList.innerHTML = ''; // Limpiar lista
        const tasksToRender = Array.isArray(state.tasks) ? state.tasks : [];

        if (tasksToRender.length === 0) {
            taskList.innerHTML = '<p class="text-sm text-slate-400 px-3">No hay tareas pendientes. ¡Añade una!</p>';
            return;
        }

        const priorityOrder = { 'Alta': 3, 'Media': 2, 'Baja': 1 };
        const sortedTasks = [...tasksToRender].sort((a, b) => {
             // Primero por prioridad descendente
            const priorityDiff = (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
            if (priorityDiff !== 0) return priorityDiff;
            // Luego por ID (fecha) descendente si la prioridad es la misma
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

     // Listener para añadir tarea (revisado)
    if (addTaskBtn) {
        addTaskBtn.addEventListener('click', () => {
             if (!taskInput || !taskPriority) {
                 console.error("Elementos de input/priority no encontrados");
                 return;
             }
            const text = taskInput.value.trim();
            const priority = taskPriority.value;
            if (text) {
                if (!Array.isArray(state.tasks)) state.tasks = []; // Asegurar que sea array
                const newTask = {
                    id: Date.now(), // Usar timestamp como ID simple
                    text,
                    priority,
                    completed: false // Nueva tarea no está completada
                };
                state.tasks.push(newTask);
                taskInput.value = ''; // Limpiar input
                renderTaskList(); // Actualizar UI
                saveStateToFirestore(); // Guardar en Firebase
                 console.log("Tarea añadida:", newTask);
            } else {
                showNotification("El texto de la tarea no puede estar vacío.");
            }
        });
    }

    // Listener para completar/borrar tarea (revisado)
    if (taskList) {
        taskList.addEventListener('click', (e) => {
            const completeBtn = e.target.closest('.complete-task-btn');
            const deleteBtn = e.target.closest('.delete-task-btn');

            if (completeBtn) {
                const taskId = Number(completeBtn.dataset.taskId);
                console.log("Completando tarea ID:", taskId);
                 if (!Array.isArray(state.tasks)) state.tasks = [];
                const taskIndex = state.tasks.findIndex(t => t.id === taskId);
                 if (taskIndex > -1) {
                     state.tasks.splice(taskIndex, 1); // Eliminar tarea completada
                     if (isNaN(state.points)) state.points = 0; state.points += 10;
                     logStudyActivity(); // Contar como actividad
                     render(); // Re-renderizar todo
                     saveStateToFirestore();
                     showNotification("¡Tarea completada! +10 puntos");
                 } else {
                     console.warn("No se encontró la tarea a completar:", taskId);
                 }
            }

            if (deleteBtn) {
                const taskId = Number(deleteBtn.dataset.taskId);
                 console.log("Eliminando tarea ID:", taskId);
                 if (!Array.isArray(state.tasks)) state.tasks = [];
                 const taskIndex = state.tasks.findIndex(t => t.id === taskId);
                 if (taskIndex > -1) {
                    state.tasks.splice(taskIndex, 1);
                    renderTaskList(); // Solo re-renderizar la lista
                    saveStateToFirestore();
                 } else {
                     console.warn("No se encontró la tarea a eliminar:", taskId);
                 }
            }
        });
    }

    // --- Lógica de Temas (Decks) ---
    function renderDeckList() {
        if (!deckList || !noDecksMessage) return;
        console.log("Renderizando decks:", state.decks);
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

     // Listener para crear nuevo tema (revisado)
    if (newDeckBtn) {
        newDeckBtn.addEventListener('click', () => {
            const deckName = prompt("Introduce el nombre del nuevo tema:");
            if (deckName && deckName.trim()) {
                 if (!Array.isArray(state.decks)) state.decks = []; // Asegurar array
                const newDeck = {
                    id: 'deck_' + Date.now(), // Usar timestamp como ID
                    name: deckName.trim(),
                    cards: [] // Nuevo tema empieza sin tarjetas
                };
                state.decks.push(newDeck);
                state.currentDeckId = newDeck.id; // Seleccionar el nuevo deck
                navigate(VIEWS.MANAGE); // Ir a gestionarlo
                saveStateToFirestore(); // Guardar
                 console.log("Nuevo tema creado:", newDeck);
            } else if (deckName !== null) { // Si no canceló, pero estaba vacío
                 showNotification("El nombre del tema no puede estar vacío.");
            }
        });
    }

    // Listener para botones de deck (sin cambios)
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
                // navigate(VIEWS.QUIZ); // startQuiz ya navega si es válido
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
         console.log("Renderizando estadísticas...");

        const today = getTodayString();
        const studyLog = Array.isArray(state.studyLog) ? state.studyLog : [];
        const streak = calculateStreak(today, studyLog);
        streakEl.textContent = streak;

        const totalHours = ((state.studyTimeMinutes || 0) / 60).toFixed(1);
        studyTimeEl.textContent = totalHours;

        let totalCards = 0;
        let totalMasteredCards = 0;
        domainByDeckList.innerHTML = ''; // Limpiar lista

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

    // Calcular racha (sin cambios)
    function calculateStreak(todayString, studyLog) {
        let streak = 0;
        const dates = new Set(studyLog);
        if (dates.size === 0) return 0;
        if (!dates.has(todayString)) return 0; // Si no estudió hoy, racha 0

        let currentDate = new Date(todayString + 'T00:00:00Z');
        while (dates.has(currentDate.toISOString().split('T')[0])) {
            streak++;
            currentDate.setDate(currentDate.getDate() - 1);
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

        const cards = Array.isArray(deck.cards) ? deck.cards : [];
        if (cards.length === 0) {
            cardList.innerHTML = '<p class="text-sm text-slate-400 px-3">No hay tarjetas. ¡Añade la primera!</p>';
            return;
        }

        cards.forEach(card => {
            const cardEl = document.createElement('div');
            cardEl.className = 'bg-slate-800 p-4 rounded-lg mb-2 flex justify-between items-start group';
            // Añadido title para tooltips en truncate
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

      // Listener añadir tarjeta (revisado)
     if (addCardForm) {
        addCardForm.addEventListener('submit', (e) => {
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

                const newCard = {
                    id: 'card_' + Date.now(),
                    question: question,
                    answer: answer,
                    questionImg: cardQuestionImgInput?.value.trim() || null,
                    answerImg: cardAnswerImgInput?.value.trim() || null,
                    interval: 0,
                    easeFactor: 2.5,
                    nextReviewDate: getTodayString() // String YYYY-MM-DD
                };
                deck.cards.push(newCard);
                renderManageView();
                saveStateToFirestore();
                addCardForm.reset();
                 console.log("Nueva tarjeta añadida:", newCard);
            } else {
                 console.error("No se encontró el deck actual para añadir tarjeta.");
            }
        });
    }

    // Listener borrar tarjeta (sin cambios)
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

    // Listener borrar deck (revisado, usar nuestro modal en vez de confirm)
    if (deleteDeckBtn) {
        deleteDeckBtn.addEventListener('click', () => {
            // Reemplazar confirm con un modal custom si es posible
             showConfirmationModal("¿Eliminar este tema y todas sus tarjetas? Esta acción no se puede deshacer.", () => {
                 if (!Array.isArray(state.decks)) state.decks = [];
                state.decks = state.decks.filter(d => d.id !== state.currentDeckId);
                navigate(VIEWS.DASHBOARD);
                saveStateToFirestore();
                 console.log("Deck eliminado:", state.currentDeckId);
             });
        });
    }


    // --- Lógica de Sesión de Estudio (Study - CON BUG CORREGIDO) ---

    function startStudySession() {
        if (!Array.isArray(state.decks)) state.decks = [];
        const deck = state.decks.find(d => d.id === state.currentDeckId);
        if (!deck) return;

        const today = getTodayString();
        const cards = Array.isArray(deck.cards) ? deck.cards : [];
        const cardsToReview = cards
            .filter(c => c.nextReviewDate <= today) // Comparar strings YYYY-MM-DD
            .sort(() => Math.random() - 0.5); // Barajar

        state.studySession = {
            cardsToReview: cardsToReview,
            currentCardIndex: 0,
            correctAnswers: 0,
        };
         console.log("Iniciando sesión de estudio con tarjetas:", cardsToReview);
        logStudyActivity(); // Loguear actividad al empezar
    }

    // Renderizar vista de estudio (con corrección flashcard)
    function renderStudyView() {
        if (!state.studySession) state.studySession = defaultState.studySession;
        const { cardsToReview, currentCardIndex } = state.studySession;
        if (!Array.isArray(state.decks)) state.decks = [];
        const deck = state.decks.find(d => d.id === state.currentDeckId);

        if (!deck) {
            navigate(VIEWS.DASHBOARD); // Si no hay deck, volver
            return;
        }

        if (studyDeckTitle) studyDeckTitle.textContent = deck.name;
        const reviewList = Array.isArray(cardsToReview) ? cardsToReview : [];

        // Fin de sesión
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
        if (state.pomodoro.isRunning) { clearInterval(state.pomodoro.timer); state.pomodoro.isRunning = false; }
        else {
            state.pomodoro.isRunning = true;
            state.pomodoro.endTime = state.pomodoro.endTime && state.pomodoro.endTime > Date.now() ? state.pomodoro.endTime : Date.now() + (state.pomodoro.timeLeft * 1000);
            if (state.pomodoro.endTime > Date.now()) {
                state.pomodoro.timeLeft = Math.round((state.pomodoro.endTime - Date.now()) / 1000);
            }
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
    function showNotification(message) { /* ... sin cambios ... */ }
    let audioCtx; function playPomodoroSound(isBreak) { /* ... sin cambios ... */ }
     // Función para mostrar modal de confirmación (simple)
    function showConfirmationModal(message, onConfirm) {
        // TODO: Implementar un modal HTML en lugar de window.confirm
        if (window.confirm(message)) {
            onConfirm();
        }
    }


    // Render inicial al cargar la página (se llamará después de onAuthStateChanged)
    // render(); // No llamar aquí, onAuthStateChanged lo hará

}); // Fin DOMContentLoaded