console.log("--- SCRIPT DE FOCUS DECK v3 CARGADO ---"); // <-- v3!

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
    // Vistas
    const views = document.querySelectorAll('.view');
    const dashboardView = document.getElementById('dashboard-view');
    const studyView = document.getElementById('study-view');
    const manageDeckView = document.getElementById('manage-deck-view');
    const quizView = document.getElementById('quiz-view');

    // Autenticación
    const authContainer = document.getElementById('auth-container'); // Contenedor del header (nombre, foto, logout)
    const loginView = document.getElementById('login-view'); // Elemento/Modal que contiene el mensaje de bienvenida y botón login
    const mainContent = document.getElementById('main-content'); // Contenedor principal de la app (pomodoro, tareas, decks)
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn'); // Este ID debe estar en el header que muestra user info
    const userProfilePic = document.getElementById('user-profile-pic'); // IMG tag en el header
    const pointsContainer = document.getElementById('points-container'); // Contenedor de puntos en el header

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
    // const saveCardBtn = document.getElementById('save-card-btn'); // No se usa directamente aquí
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
            stateToSave.studySession = defaultState.studySession; // No guardar sesión de estudio en progreso

            if (stateToSave.decks) {
                stateToSave.decks.forEach(deck => {
                    if (deck.cards) {
                        deck.cards.forEach(card => {
                            // Convertir fechas string a Timestamps ANTES de guardar
                            if (card.nextReviewDate && typeof card.nextReviewDate === 'string') {
                                try {
                                    const date = new Date(card.nextReviewDate + 'T00:00:00');
                                    if (!isNaN(date.getTime())) {
                                        card.nextReviewDate = Timestamp.fromDate(date);
                                    } else {
                                        console.warn("Fecha inválida detectada, usando ahora:", card.nextReviewDate);
                                        card.nextReviewDate = Timestamp.now();
                                    }
                                } catch(e) {
                                    console.error("Error convirtiendo fecha al guardar:", card.nextReviewDate, e);
                                    card.nextReviewDate = Timestamp.now();
                                }
                            } else if (!card.nextReviewDate) {
                                card.nextReviewDate = Timestamp.now(); // Poner fecha actual si no existe
                            }
                        });
                    } else {
                        deck.cards = []; // Asegurar que sea un array
                    }
                });
            } else {
                stateToSave.decks = []; // Asegurar que sea un array
            }
             if (!Array.isArray(stateToSave.tasks)) stateToSave.tasks = []; // Asegurar array
             if (!Array.isArray(stateToSave.studyLog)) stateToSave.studyLog = []; // Asegurar array


            const userDocRef = doc(db, "users", currentUserId);
            await setDoc(userDocRef, stateToSave, { merge: true }); // Usar merge para no sobrescribir todo
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
                // Combinar estado por defecto con datos de Firestore para asegurar todas las props
                state = { ...defaultState, ...firestoreData };

                // --- MIGRACIÓN Y LIMPIEZA DE DATOS CARGADOS ---
                // Resetear estado del Pomodoro si no estaba corriendo
                const defaultPomodoro = { timer: null, timeLeft: 25 * 60, isBreak: false, isRunning: false, endTime: null };
                state.pomodoro = { ...defaultPomodoro, ...(state.pomodoro || {}) };
                if (state.pomodoro.isRunning) { // Si se recarga, el timer se detiene
                    state.pomodoro.isRunning = false;
                }

                // Nunca cargar una sesión de estudio en progreso
                state.studySession = defaultState.studySession;

                // Convertir Timestamps de Firestore a strings "YYYY-MM-DD"
                if (state.decks) {
                    state.decks.forEach(deck => {
                        if (deck.cards) {
                            deck.cards.forEach(card => {
                                // Asegurar props de imagen
                                card.questionImg = card.questionImg || null;
                                card.answerImg = card.answerImg || null;
                                // Convertir Timestamp
                                if (card.nextReviewDate && card.nextReviewDate.toDate) {
                                    try {
                                        card.nextReviewDate = card.nextReviewDate.toDate().toISOString().split('T')[0];
                                    } catch (e) {
                                        console.error("Error convirtiendo Timestamp a fecha:", card.nextReviewDate, e);
                                        card.nextReviewDate = getTodayString();
                                    }
                                } else if (typeof card.nextReviewDate !== 'string') {
                                    // Si no es Timestamp ni string, poner fecha de hoy
                                    card.nextReviewDate = getTodayString();
                                }
                            });
                        } else {
                           deck.cards = []; // Asegurar array
                        }
                    });
                } else {
                    state.decks = []; // Asegurar array
                }
                 if (!Array.isArray(state.tasks)) state.tasks = []; // Asegurar array
                 if (!Array.isArray(state.studyLog)) state.studyLog = []; // Asegurar array

            } else {
                // --- Usuario nuevo ---
                console.log("Usuario nuevo, creando documento...");
                state = { ...defaultState };
                saveStateToFirestore(); // Guardar el estado inicial en la nube
            }

            // Renderizar la app con los datos cargados o iniciales
            render();
            // Re-chequear pomodoro por si se recargó la página mientras corría
            checkRunningPomodoro();

        }, (error) => {
            console.error("Error escuchando datos de Firestore: ", error);
            showNotification("Error al cargar tus datos. Intenta recargar la página.");
        });
    }

    async function logStudyActivity() {
        const today = getTodayString();
        if (!state.studyLog) state.studyLog = []; // Asegurar array
        if (!state.studyLog.includes(today)) {
            console.log("Registrando actividad de estudio para la racha de hoy.");
            // Actualizar estado local primero
            state.studyLog.push(today);

            if (currentUserId) {
                try {
                    const userDocRef = doc(db, "users", currentUserId);
                    // Usar arrayUnion para agregar de forma segura en Firestore
                    await updateDoc(userDocRef, {
                        studyLog: arrayUnion(today)
                    });
                } catch(e) {
                    console.error("Error actualizando studyLog con arrayUnion: ", e);
                    // Fallback: guardar todo el estado si arrayUnion falla
                    await saveStateToFirestore();
                }
            }
            renderStats(); // Actualizar UI de estadísticas
        }
    }


    // --- Lógica de Autenticación (¡¡NUEVO ENFOQUE FORZADO!!) ---
    onAuthStateChanged(auth, (user) => {
        console.log("Auth state changed. User:", user ? user.uid : 'null'); // Log para ver si se ejecuta

        if (user) {
            // Usuario está logueado
            currentUserId = user.uid;
            console.log("Intentando mostrar app principal...");

            // --- Forzar ocultar login ---
            if (loginView) {
                console.log("Ocultando loginView...");
                loginView.classList.add('hidden');
                loginView.style.display = 'none'; // Forzar ocultar con estilo
            } else {
                console.warn("Elemento loginView no encontrado");
            }
            // --- Forzar mostrar app ---
            if (mainContent) {
                console.log("Mostrando mainContent...");
                mainContent.classList.remove('hidden');
                mainContent.style.display = 'block'; // Forzar mostrar con estilo (o 'flex', 'grid' según tu layout)
            } else {
                console.warn("Elemento mainContent no encontrado");
            }

            // Actualizar header (esto parece funcionar)
             if (authContainer) {
                 authContainer.innerHTML = `
                     <div class="flex items-center gap-2">
                         <span id="points" class="text-sm font-semibold text-yellow-400 bg-slate-700 px-3 py-1 rounded-full">${state.points || 0} pts</span>
                         <img id="user-profile-pic" src="${user.photoURL || 'https://placehold.co/40x40/7f7f7f/ffffff?text=?'}" alt="User" class="w-8 h-8 rounded-full border-2 border-slate-500">
                         <button id="logout-btn" class="p-1 text-slate-400 hover:text-white">
                             <i data-lucide="log-out" class="w-5 h-5"></i>
                         </button>
                     </div>
                 `;
                 lucide.createIcons();
                 const newLogoutBtn = document.getElementById('logout-btn');
                 if (newLogoutBtn) {
                     newLogoutBtn.addEventListener('click', logout);
                 }
             } else {
                 console.warn("Elemento authContainer no encontrado");
             }


            // Cargar datos
            console.log("Llamando a listenToUserData...");
            listenToUserData(currentUserId);

        } else {
            // Usuario está deslogueado
            currentUserId = null;
            console.log("Intentando mostrar pantalla de login...");

             // --- Forzar mostrar login ---
            if (loginView) {
                console.log("Mostrando loginView...");
                loginView.classList.remove('hidden');
                loginView.style.display = 'block'; // O el display original (ej: 'flex' si era un flex container)
            } else {
                 console.warn("Elemento loginView no encontrado");
            }
             // --- Forzar ocultar app ---
            if (mainContent) {
                console.log("Ocultando mainContent...");
                mainContent.classList.add('hidden');
                mainContent.style.display = 'none'; // Forzar ocultar
            } else {
                 console.warn("Elemento mainContent no encontrado");
            }

            // Limpiar header
            if (authContainer) {
                authContainer.innerHTML = '';
            }

            // Detener escucha de datos
            if (unsubscribeFromFirestore) {
                console.log("Deteniendo escucha de Firestore.");
                unsubscribeFromFirestore();
                unsubscribeFromFirestore = null;
            }

            // Resetear estado
            console.log("Reseteando estado.");
            state = { ...defaultState };
            render(); // Renderizar UI vacía (oculta)
        }
    });

    // --- Funciones login/logout (sin cambios) ---
     async function loginWithGoogle() {
            const provider = new GoogleAuthProvider();
            try {
                console.log("Iniciando popup de login...");
                await signInWithPopup(auth, provider);
                console.log("Popup cerrado, esperando onAuthStateChanged...");
            } catch (error) {
                console.error("Error al iniciar sesión: ", error);
                 let errorMessage = "Error al iniciar sesión. ";
                 if (error.code === 'auth/popup-blocked') {
                     errorMessage += "El popup fue bloqueado. Permite popups.";
                 } else if (error.code === 'auth/popup-closed-by-user') {
                     errorMessage = null; // No mostrar error si el usuario cierra
                 } else {
                     errorMessage += "Inténtalo de nuevo.";
                 }
                 if (errorMessage) {
                    showNotification(errorMessage);
                 }
            }
        }

     async function logout() {
         try {
             console.log("Cerrando sesión...");
             await signOut(auth);
             showNotification("Sesión cerrada.");
             // onAuthStateChanged se encargará de mostrar la pantalla de login
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


    // --- Lógica de la App (sin cambios significativos, solo chequeos null) ---
    // ... (El resto del código desde la función navigate() hasta el final sigue igual) ...

    function navigate(viewId) {
        state.currentView = viewId;
        render();
    }

    function render() {
        if (!views) return;
        views.forEach(v => v.classList.add('hidden'));

        // Renderizar la vista actual
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
            default: // Fallback al dashboard
                if (dashboardView) dashboardView.classList.remove('hidden');
                renderDashboard();
        }

        // Actualizar elementos comunes
        // Los puntos ahora se actualizan en updateAuthUI
        // if (pointsEl) pointsEl.textContent = state.points || 0;
        updatePomodoroUI();
        if (lucide) lucide.createIcons(); // Re-renderizar iconos
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
        const tasksToRender = Array.isArray(state.tasks) ? state.tasks : [];
        const sortedTasks = [...tasksToRender].sort((a, b) => {
            if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
                return priorityOrder[b.priority] - priorityOrder[a.priority];
            }
            return (b.id || 0) - (a.id || 0); // Ordenar por ID desc si misma prioridad
        });

        sortedTasks.forEach(task => {
            const taskEl = document.createElement('div');
            const priorityColor = {
                'Alta': 'border-red-500',
                'Media': 'border-yellow-500',
                'Baja': 'border-teal-500',
            }[task.priority] || 'border-slate-500'; // Default color

            taskEl.className = `flex items-center justify-between p-3 bg-slate-800 rounded-lg border-l-4 ${priorityColor} mb-2 group`;
            taskEl.innerHTML = `
                <div class="flex items-center flex-1 min-w-0 mr-2">
                    <button data-task-id="${task.id}" class="complete-task-btn p-1 text-slate-400 hover:text-white mr-3 flex-shrink-0">
                        <i data-lucide="circle" class="w-5 h-5"></i>
                    </button>
                    <span class="text-slate-200 truncate">${task.text}</span>
                </div>
                <button data-task-id="${task.id}" class="delete-task-btn p-1 text-slate-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
            `;
            taskList.appendChild(taskEl);
        });
        lucide.createIcons(); // Crear iconos después de añadir elementos
    }

    if (addTaskBtn) {
        addTaskBtn.addEventListener('click', () => {
             if (!taskInput || !taskPriority) return;
            const text = taskInput.value.trim();
            const priority = taskPriority.value;
            if (text) {
                if (!state.tasks || !Array.isArray(state.tasks)) state.tasks = [];
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
                if (!state.points) state.points = 0;
                state.points += 10;
                logStudyActivity();
                render(); // Re-renderizar todo por si afecta estadísticas
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
            const cards = Array.isArray(deck.cards) ? deck.cards : [];
            const cardsToReview = cards.filter(c => c.nextReviewDate <= today).length;
            const deckEl = document.createElement('div');
            deckEl.className = 'bg-slate-800 p-5 rounded-lg shadow-lg flex flex-col justify-between';
            deckEl.innerHTML = `
                <div>
                    <h3 class="text-xl font-bold text-white truncate mb-2">${deck.name}</h3>
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
        lucide.createIcons(); // Crear iconos después de añadir elementos
    }

    if (newDeckBtn) {
        newDeckBtn.addEventListener('click', () => {
            const deckName = prompt("Introduce el nombre del nuevo tema:");
            if (deckName && deckName.trim()) {
                 if (!state.decks || !Array.isArray(state.decks)) state.decks = [];
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
        const studyLog = Array.isArray(state.studyLog) ? state.studyLog : [];
        const streak = calculateStreak(today, studyLog);
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
                            <span class="text-sm text-slate-300 truncate">${deck.name}</span>
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

    // Calcular racha de días (Corregido para manejar mejor el caso de no estudiar hoy)
    function calculateStreak(todayString, studyLog) {
        let streak = 0;
        const dates = new Set(studyLog);
        if (dates.size === 0) return 0;

        // Si no estudió hoy, la racha es 0
        if (!dates.has(todayString)) return 0;

        // Si estudió hoy, contar hacia atrás
        let currentDate = new Date(todayString + 'T00:00:00');
        while (dates.has(currentDate.toISOString().split('T')[0])) {
            streak++;
            currentDate.setDate(currentDate.getDate() - 1); // Ir al día anterior
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
            cardEl.innerHTML = `
                <div class="flex-1 overflow-hidden min-w-0 mr-4">
                    ${card.questionImg ? `<img src="${card.questionImg}" class="max-w-full h-auto max-h-20 rounded mb-2 object-contain" onerror="this.style.display='none'">` : ''}
                    <p class="text-slate-300 font-semibold truncate"><strong class="text-teal-400">P:</strong> ${card.question}</p>
                    ${card.answerImg ? `<img src="${card.answerImg}" class="max-w-full h-auto max-h-20 rounded mt-2 mb-2 object-contain" onerror="this.style.display='none'">` : ''}
                    <p class="text-slate-300 truncate"><strong class="text-teal-400">R:</strong> ${card.answer}</p>
                </div>
                <button data-card-id="${card.id}" class="delete-card-btn p-1 text-slate-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
            `;
            cardList.appendChild(cardEl);
        });
        lucide.createIcons(); // Crear iconos
    }

     if (addCardForm) {
        addCardForm.addEventListener('submit', (e) => {
            e.preventDefault();
            if (!state.decks) state.decks = [];
            const deck = state.decks.find(d => d.id === state.currentDeckId);
            if (deck) {
                if (!Array.isArray(deck.cards)) deck.cards = [];
                 // Validar entradas
                 const question = cardQuestionInput.value.trim();
                 const answer = cardAnswerInput.value.trim();
                 if (!question || !answer) {
                     showNotification("La pregunta y la respuesta son obligatorias.");
                     return;
                 }

                const newCard = {
                    id: 'card_' + Date.now(),
                    question: question,
                    answer: answer,
                    questionImg: cardQuestionImgInput.value.trim() || null,
                    answerImg: cardAnswerImgInput.value.trim() || null,
                    interval: 0,
                    easeFactor: 2.5,
                    nextReviewDate: getTodayString() // Nueva tarjeta se revisa hoy
                };
                deck.cards.push(newCard);
                renderManageView();
                saveStateToFirestore();
                addCardForm.reset(); // Limpiar formulario
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
            // Usar modal custom en lugar de confirm
            // TODO: Implementar un modal custom para confirmación
            if (confirm("¿Estás seguro de que quieres eliminar este tema y todas sus tarjetas? Esta acción no se puede deshacer.")) {
                 if (!state.decks) state.decks = [];
                state.decks = state.decks.filter(d => d.id !== state.currentDeckId);
                navigate(VIEWS.DASHBOARD); // Volver al dashboard
                saveStateToFirestore();
            }
        });
    }


    // --- Lógica de Sesión de Estudio (Study - ¡CON BUG CORREGIDO!) ---

    function startStudySession() {
        if (!state.decks) state.decks = [];
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

        logStudyActivity(); // Log al iniciar estudio
    }

    function renderStudyView() {
        if (!state.studySession) state.studySession = defaultState.studySession;
        const { cardsToReview, currentCardIndex } = state.studySession;
        if (!state.decks) state.decks = [];
        const deck = state.decks.find(d => d.id === state.currentDeckId);

        if (!deck) {
            navigate(VIEWS.DASHBOARD);
            return;
        }

        if (studyDeckTitle) studyDeckTitle.textContent = deck.name;
        const reviewList = Array.isArray(cardsToReview) ? cardsToReview : [];

        if (currentCardIndex >= reviewList.length) {
            // FIN DE SESIÓN
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
                        saveStateToFirestore(); // Guardar al final
                    });
                }
            }
             if (lucide) lucide.createIcons(); // Crear iconos si aplica
            return;
        }

        // MOSTRAR TARJETA ACTUAL
        if (studyProgress) studyProgress.textContent = `Progreso: ${currentCardIndex} / ${reviewList.length}`;
        const currentCard = reviewList[currentCardIndex];

        // Mostrar pregunta (con imagen si existe)
        if (studyQuestionImg) {
            studyQuestionImg.src = currentCard.questionImg || '';
            studyQuestionImg.classList.toggle('hidden', !currentCard.questionImg);
            studyQuestionImg.onerror = () => { if(studyQuestionImg) studyQuestionImg.classList.add('hidden'); };
        }
        if (studyQuestionTextEl) studyQuestionTextEl.textContent = currentCard.question;

        // Ocultar respuesta
        if (studyAnswerImg) {
            studyAnswerImg.src = ''; // Limpiar src
            studyAnswerImg.classList.add('hidden');
            studyAnswerImg.onerror = () => { if(studyAnswerImg) studyAnswerImg.classList.add('hidden'); };
        }
        if (studyAnswerTextEl) {
             // ¡CORRECCIÓN DEL BUG DE FLASHCARD!
             // Pre-cargar la respuesta correcta aquí, pero mantenerla oculta
             studyAnswerTextEl.textContent = currentCard.answer;
            if (studyAnswerTextEl.parentElement) studyAnswerTextEl.parentElement.classList.add('hidden');
        }

        // Mostrar botón "Mostrar Respuesta" y ocultar botones de dificultad
        if (studyDifficultyBtns) studyDifficultyBtns.classList.add('hidden');
        if (showAnswerBtn) showAnswerBtn.classList.remove('hidden');
        if (studyCard) studyCard.classList.remove('hidden'); // Asegurarse que se ve la card

        if (lucide) lucide.createIcons(); // Crear iconos si aplica
    }

    if (showAnswerBtn) {
        showAnswerBtn.addEventListener('click', () => {
             if (!state.studySession) return;
            const { cardsToReview, currentCardIndex } = state.studySession;
            const reviewList = Array.isArray(cardsToReview) ? cardsToReview : [];
            if (currentCardIndex >= reviewList.length) return;

            const currentCard = reviewList[currentCardIndex];

            // Mostrar respuesta (con imagen si existe)
            if (studyAnswerImg) {
                studyAnswerImg.src = currentCard.answerImg || '';
                studyAnswerImg.classList.toggle('hidden', !currentCard.answerImg);
            }
             if (studyAnswerTextEl && studyAnswerTextEl.parentElement) {
                // Ya no necesitamos actualizar el texto aquí, solo mostrar el contenedor
                studyAnswerTextEl.parentElement.classList.remove('hidden');
            }

            // Ocultar botón "Mostrar Respuesta" y mostrar botones de dificultad
            showAnswerBtn.classList.add('hidden');
            if (studyDifficultyBtns) studyDifficultyBtns.classList.remove('hidden');
        });
    }

    // Listener para botones de dificultad (sin cambios)
     if (studyDifficultyBtns) {
        studyDifficultyBtns.addEventListener('click', (e) => {
            const difficulty = e.target.closest('button')?.dataset.difficulty;
            if (!difficulty) return;

            if (!state.studySession) return;
            const { cardsToReview, currentCardIndex } = state.studySession;
            const reviewList = Array.isArray(cardsToReview) ? cardsToReview : [];
            if (currentCardIndex >= reviewList.length) return;

            const card = reviewList[currentCardIndex];

            let { interval, easeFactor } = card;
            interval = interval || 0;
            easeFactor = easeFactor || 2.5;

            let nextInterval;
            let newEaseFactor = easeFactor;

            if (difficulty === 'easy') {
                nextInterval = getNextInterval(interval, 'easy');
                newEaseFactor = Math.min(3.0, newEaseFactor + 0.15); // Aumentar facilidad
                if (!state.points) state.points = 0; state.points += 3;
            } else if (difficulty === 'good') {
                nextInterval = getNextInterval(interval, 'good');
                 // No cambia easeFactor
                 if (!state.points) state.points = 0; state.points += 2;
            } else { // 'hard'
                nextInterval = 0; // Reiniciar intervalo
                newEaseFactor = Math.max(1.3, newEaseFactor - 0.2); // Disminuir facilidad
                 if (!state.points) state.points = 0; state.points += 1;
            }

            const nextReviewDate = new Date(getTodayString() + 'T00:00:00');
            nextReviewDate.setDate(nextReviewDate.getDate() + Math.round(nextInterval)); // Redondear intervalo

            const deck = state.decks.find(d => d.id === state.currentDeckId);
            const cardInDeck = deck?.cards?.find(c => c.id === card.id);
            if (cardInDeck) {
                cardInDeck.interval = nextInterval;
                cardInDeck.easeFactor = newEaseFactor;
                cardInDeck.nextReviewDate = nextReviewDate.toISOString().split('T')[0];
            }

            state.studySession.currentCardIndex++;
            renderStudyView(); // Mostrar siguiente tarjeta o fin de sesión
        });
    }

    // Función SM-2 simplificada
    function getNextInterval(lastInterval, difficulty) {
         // Ajuste basado en SM-2 simple
        if (difficulty === 'hard') return Math.max(1, Math.floor(lastInterval / 2)); // Repasar pronto
        if (lastInterval === 0) return (difficulty === 'easy') ? 4 : 1;
        if (lastInterval === 1) return (difficulty === 'easy') ? 7 : 3;

        // Cálculo general (aproximado, sin easeFactor directo aquí)
        let next = lastInterval * (difficulty === 'easy' ? 2.5 : 2.0);
        return Math.min(Math.round(next), 60); // Redondear y limitar a 60 días
    }


    // --- Lógica de Quiz (sin cambios significativos) ---

    let quizState = {
        questions: [],
        currentQuestionIndex: 0,
        score: 0,
        answered: false
    };

    function startQuiz() {
        if (!state.decks) state.decks = [];
        const deck = state.decks.find(d => d.id === state.currentDeckId);
        const cards = Array.isArray(deck?.cards) ? deck.cards : [];
        if (!deck || cards.length < 4) {
             showNotification("Necesitas al menos 4 tarjetas en este tema para iniciar un quiz.");
            return;
        }

        logStudyActivity(); // Log al iniciar quiz

        const shuffledCards = [...cards].sort(() => Math.random() - 0.5);
        quizState.questions = shuffledCards.map(card => generateQuizQuestion(card, cards));
        quizState.currentQuestionIndex = 0;
        quizState.score = 0;
        quizState.answered = false;

        navigate(VIEWS.QUIZ); // Navegar a la vista del quiz
        renderQuizView(); // Iniciar renderizado del quiz
    }

    function generateQuizQuestion(correctCard, allCards) {
        let options = [correctCard.answer];
        const incorrectCards = allCards.filter(c => c.id !== correctCard.id);
        const shuffledIncorrect = incorrectCards.sort(() => Math.random() - 0.5);

        for (let i = 0; options.length < 4 && i < shuffledIncorrect.length; i++) {
             // Evitar opciones duplicadas
             if (!options.includes(shuffledIncorrect[i].answer)) {
                 options.push(shuffledIncorrect[i].answer);
             }
        }
         // Si aún faltan opciones (ej: pocas tarjetas), añadir placeholders o repetir (menos ideal)
         while (options.length < 4) {
             const placeholder = `Opción Inválida ${options.length}`;
             if (!options.includes(placeholder)) { // Evitar duplicar placeholders
                options.push(placeholder);
             } else {
                 options.push(Math.random().toString(36).substring(7)); // Opción aleatoria si falla todo
             }
         }

        options.sort(() => Math.random() - 0.5); // Barajar opciones finales

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

        // Fin del quiz
        if (currentQuestionIndex >= questions.length) {
            const scorePercent = (questions.length > 0) ? Math.round((quizState.score / questions.length) * 100) : 0;
            if (quizQuestionText) quizQuestionText.textContent = '¡Quiz completado!';
            if (quizOptionsList) {
                quizOptionsList.innerHTML = `
                    <p class="text-xl text-center text-slate-300">
                        Tu puntuación: ${quizState.score} / ${questions.length} (${scorePercent}%)
                    </p>
                    <button id="finish-quiz-btn" class="w-full mt-6 bg-teal-600 hover:bg-teal-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors">
                        Volver al Dashboard
                    </button>
                `;
                const finishBtn = document.getElementById('finish-quiz-btn');
                if (finishBtn) {
                     finishBtn.addEventListener('click', () => {
                        navigate(VIEWS.DASHBOARD);
                        saveStateToFirestore(); // Guardar puntos
                    });
                }
            }
             if (lucide) lucide.createIcons(); // Crear iconos si aplica
            return;
        }

        // Mostrar pregunta actual
        if (quizProgress) quizProgress.textContent = `Pregunta: ${currentQuestionIndex + 1} / ${questions.length}`;
        const question = questions[currentQuestionIndex];
        if (quizQuestionText) quizQuestionText.textContent = question.question;

        if (quizOptionsList) {
            quizOptionsList.innerHTML = ''; // Limpiar opciones anteriores
            question.options.forEach(option => {
                const optionEl = document.createElement('button');
                optionEl.className = 'quiz-option w-full bg-slate-700 hover:bg-slate-600 text-slate-200 text-left p-4 rounded-lg transition-colors';
                optionEl.textContent = option;
                quizOptionsList.appendChild(optionEl);
            });
        }

        quizState.answered = false; // Resetear estado de respuesta
         if (lucide) lucide.createIcons(); // Crear iconos si aplica
    }

    if (quizOptionsList) {
        quizOptionsList.addEventListener('click', (e) => {
            const selectedOption = e.target.closest('.quiz-option');
            if (!selectedOption || quizState.answered) return;

            quizState.answered = true;
            const answer = selectedOption.textContent;
            const question = quizState.questions[quizState.currentQuestionIndex];

            // Marcar opciones y deshabilitar
            quizOptionsList.querySelectorAll('.quiz-option').forEach(btn => {
                btn.disabled = true;
                btn.classList.add('opacity-70');
                if (btn.textContent === question.correctAnswer) {
                    btn.classList.remove('bg-slate-700', 'hover:bg-slate-600');
                    btn.classList.add('bg-green-700'); // Verde para correcta
                }
            });

            // Evaluar respuesta
            if (answer === question.correctAnswer) {
                 if (quizFeedback) {
                    quizFeedback.textContent = '¡Correcto! +10 puntos';
                    quizFeedback.className = 'p-3 rounded-lg bg-green-900 text-green-200 mt-4';
                }
                quizState.score++;
                if (!state.points) state.points = 0; state.points += 10;
            } else {
                 if (quizFeedback) {
                    quizFeedback.textContent = `Incorrecto. La respuesta era: ${question.correctAnswer}`;
                    quizFeedback.className = 'p-3 rounded-lg bg-red-900 text-red-200 mt-4';
                }
                selectedOption.classList.remove('bg-slate-700', 'opacity-70');
                selectedOption.classList.add('bg-red-700'); // Rojo para incorrecta seleccionada
            }

            if (quizFeedback) quizFeedback.classList.remove('hidden');
            if (nextQuizQuestionBtn) nextQuizQuestionBtn.classList.remove('hidden');
            // No guardar aquí, se guarda al final del quiz
        });
    }

    if (nextQuizQuestionBtn) {
        nextQuizQuestionBtn.addEventListener('click', () => {
            quizState.currentQuestionIndex++;
            renderQuizView();
        });
    }


    // --- Lógica del Pomodoro (sin cambios) ---

    function updatePomodoroUI() {
        if (!pomodoroTimerEl) return;
        const timeLeft = state.pomodoro?.timeLeft ?? (25 * 60);
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        pomodoroTimerEl.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

        if (startPomodoroBtn) startPomodoroBtn.textContent = state.pomodoro?.isRunning ? 'Pausar' : 'Iniciar';

        if (state.pomodoro?.isBreak) {
            document.body.classList.add('bg-teal-900');
            document.body.classList.remove('bg-slate-900');
        } else {
            document.body.classList.remove('bg-teal-900');
            document.body.classList.add('bg-slate-900');
        }
    }

    function startPomodoro() {
        if (!state.pomodoro) state.pomodoro = defaultState.pomodoro;

        if (state.pomodoro.isRunning) { // Pausar
            clearInterval(state.pomodoro.timer);
            state.pomodoro.isRunning = false;
        } else { // Iniciar o Reanudar
            state.pomodoro.isRunning = true;
            if (!state.pomodoro.endTime || state.pomodoro.endTime <= Date.now()) {
                 state.pomodoro.endTime = Date.now() + (state.pomodoro.timeLeft * 1000);
            } else {
                state.pomodoro.timeLeft = Math.round((state.pomodoro.endTime - Date.now()) / 1000);
            }

            state.pomodoro.timer = setInterval(() => {
                const now = Date.now();
                const timeLeftMs = (state.pomodoro.endTime || 0) - now;

                if (timeLeftMs <= 0) {
                    handlePomodoroFinish();
                } else {
                    state.pomodoro.timeLeft = Math.round(timeLeftMs / 1000);
                }
                updatePomodoroUI();
            }, 1000);
        }
        updatePomodoroUI();
        saveStateToFirestore(); // Guardar estado (isRunning, endTime)
    }

    function handlePomodoroFinish() {
        clearInterval(state.pomodoro.timer);
         if (!state.pomodoro) state.pomodoro = defaultState.pomodoro; // Asegurar estado
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
            if (!state.points) state.points = 0; state.points += 25;
            if (!state.studyTimeMinutes) state.studyTimeMinutes = 0; state.studyTimeMinutes += 25;
            logStudyActivity();
            showNotification("¡Pomodoro completado! +25 puntos. ¡Toma un descanso!");
        }

        updatePomodoroUI();
        saveStateToFirestore();
    }

    function resetPomodoro() {
        clearInterval(state.pomodoro.timer);
         if (!state.pomodoro) state.pomodoro = defaultState.pomodoro; // Asegurar estado
        state.pomodoro.isRunning = false;
        state.pomodoro.isBreak = false;
        state.pomodoro.timeLeft = 25 * 60;
        state.pomodoro.endTime = null;
        updatePomodoroUI();
        saveStateToFirestore();
    }

    function checkRunningPomodoro() {
         if (!state.pomodoro) return;
        if (state.pomodoro.endTime && state.pomodoro.endTime > Date.now()) {
            state.pomodoro.timeLeft = Math.round((state.pomodoro.endTime - Date.now()) / 1000);
            startPomodoro(); // Reanuda
        } else if (state.pomodoro.endTime && state.pomodoro.endTime <= Date.now()) {
            handlePomodoroFinish(); // Finaliza si ya pasó el tiempo
        }
    }

    if (startPomodoroBtn) startPomodoroBtn.addEventListener('click', startPomodoro);
    if (resetPomodoroBtn) resetPomodoroBtn.addEventListener('click', resetPomodoro);


    // --- Utilidades ---

    function getTodayString() {
        return new Date().toISOString().split('T')[0];
    }

    function showNotification(message) {
        if (!notification) return;
        notification.textContent = message;
        notification.classList.remove('hidden', 'opacity-0', 'translate-y-full');
        notification.classList.add('opacity-100', '-translate-y-4');

        setTimeout(() => {
            notification.classList.remove('opacity-100', '-translate-y-4');
            notification.classList.add('opacity-0', 'translate-y-full');
            setTimeout(() => { if (notification) notification.classList.add('hidden'); }, 500);
        }, 3000);
    }

    let audioCtx;
    function playPomodoroSound(isBreak) {
        try {
            if (!audioCtx) {
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
             if (!audioCtx) return;
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

    // Render inicial
    render();

}); // Fin DOMContentLoaded
