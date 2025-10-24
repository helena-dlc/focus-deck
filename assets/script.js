// --- IMPORTACIONES DE FIREBASE ---
// Usamos la versión "compat" para una transición más fácil desde tu código
// Esta es la forma moderna de importar
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


// --- CONFIGURACIÓN DE FIREBASE (¡NUEVO!) ---
// ¡Estas son las "llaves"!
const firebaseConfig = {
  apiKey: "AIzaSyC6tqffatZ7NhMm5bGRh0kmjCLymj0DD74",
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
const defaultState = { // Estado inicial para un nuevo usuario
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
let state = { ...defaultState }; // El estado activo de la aplicación


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
    const authContainer = document.getElementById('auth-container');
    const loginView = document.getElementById('login-view');
    const mainContent = document.getElementById('main-content');
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const userProfilePic = document.getElementById('user-profile-pic');
    
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
            if (stateToSave.pomodoro) {
                 delete stateToSave.pomodoro.timer; 
            }
            // No guardamos la sesión de estudio
            stateToSave.studySession = defaultState.studySession;

            // Convertimos las fechas de las tarjetas (si existen) a Timestamps
            if (stateToSave.decks) {
                stateToSave.decks.forEach(deck => {
                    if (deck.cards) {
                        deck.cards.forEach(card => {
                            if (card.nextReviewDate && !(card.nextReviewDate instanceof Timestamp)) {
                                try {
                                    // Asumimos que es un string ISO "YYYY-MM-DD"
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
            // Usamos setDoc con merge:true para crear o actualizar el documento
            await setDoc(userDocRef, stateToSave, { merge: true });
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
                state.pomodoro = { ...defaultPomodoro, ...(state.pomodoro || {}) };
                if (state.pomodoro.isRunning) {
                    state.pomodoro.isRunning = false; 
                }
                
                state.studySession = defaultState.studySession; // Nunca guardamos una sesión en progreso
                
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
                                } else if (!card.nextReviewDate) {
                                    card.nextReviewDate = getTodayString();
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
            render();
            // Re-chequear pomodoro por si se recargó la página
            checkRunningPomodoro();
            
        }, (error) => {
            console.error("Error escuchando datos de Firestore: ", error);
            showNotification("Error al cargar tus datos. Intenta recargar la página.");
        });
    }
    
    /**
     * Registra una actividad de estudio en el log (para la racha).
     * Guarda el estado si es la primera actividad del día.
     */
    async function logStudyActivity() {
        const today = getTodayString();
        if (!state.studyLog.includes(today)) {
            console.log("Registrando actividad de estudio para la racha de hoy.");
            state.studyLog.push(today);
            
            // Actualización más rápida en Firestore usando updateDoc y arrayUnion
            if (currentUserId) {
                try {
                    const userDocRef = doc(db, "users", currentUserId);
                    await updateDoc(userDocRef, {
                        studyLog: arrayUnion(today)
                    });
                } catch(e) {
                    console.error("Error actualizando studyLog: ", e);
                    // Si falla (ej. doc no existe), recurrir a saveStateToFirestore
                    await saveStateToFirestore();
                }
            }
            renderStats(); // Actualizar la UI de estadísticas inmediatamente
        }
    }


    // --- Lógica de Autenticación (¡NUEVO!) ---

    /**
     * Maneja el estado de autenticación del usuario.
     */
    onAuthStateChanged(auth, (user) => {
        if (user) {
            // Usuario está logueado
            currentUserId = user.uid;
            console.log("Usuario logueado:", currentUserId);
            
            // Mostramos la app y ocultamos el login
            mainContent.classList.remove('hidden');
            authContainer.classList.add('hidden');
            loginView.classList.add('hidden');
            
            // Mostramos la info del usuario
            if (user.photoURL) {
                userProfilePic.src = user.photoURL;
                userProfilePic.classList.remove('hidden');
            }
            logoutBtn.classList.remove('hidden');

            // Empezamos a escuchar los datos de ESTE usuario
            listenToUserData(currentUserId);
            
        } else {
            // Usuario está deslogueado
            currentUserId = null;
            console.log("Usuario deslogueado.");

            // Ocultamos la app y mostramos el login
            mainContent.classList.add('hidden');
            authContainer.classList.remove('hidden');
            loginView.classList.remove('hidden');
            
            // Ocultamos info de usuario
            userProfilePic.classList.add('hidden');
            logoutBtn.classList.add('hidden');
            
            // Dejamos de escuchar datos
            if (unsubscribeFromFirestore) {
                unsubscribeFromFirestore();
                unsubscribeFromFirestore = null;
            }
            
            // Reseteamos el estado al por defecto
            state = { ...defaultState };
            render();
        }
    });

    /**
     * Inicia el pop-up de login con Google
     */
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

    /**
     * Cierra la sesión del usuario
     */
    logoutBtn.addEventListener('click', async () => {
        try {
            await signOut(auth);
            // onAuthStateChanged se encargará del resto
        } catch (error) {
            console.error("Error al cerrar sesión: ", error);
            showNotification("Error al cerrar sesión.");
        }
    });


    // --- Lógica de la App ---

    function navigate(viewId) {
        state.currentView = viewId;
        render();
        // saveStateToFirestore(); // Guardamos el estado al cambiar de vista
    }

    function render() {
        // Ocultar todas las vistas
        views.forEach(v => v.classList.add('hidden'));

        // Mostrar la vista activa
        switch (state.currentView) {
            case VIEWS.DASHBOARD:
                renderDashboard();
                dashboardView.classList.remove('hidden');
                break;
            case VIEWS.MANAGE:
                renderManageView();
                manageDeckView.classList.remove('hidden');
                break;
            case VIEWS.STUDY:
                renderStudyView();
                studyView.classList.remove('hidden');
                break;
            case VIEWS.QUIZ:
                renderQuizView();
                quizView.classList.remove('hidden');
                break;
            default:
                renderDashboard();
                dashboardView.classList.remove('hidden');
        }
        
        // Renderizar componentes persistentes
        pointsEl.textContent = state.points;
        updatePomodoroUI();
        lucide.createIcons(); // Re-renderizar iconos por si se añadieron dinámicamente
    }

    // --- Render Dashboard ---
    function renderDashboard() {
        renderTaskList();
        renderDeckList();
        renderStats();
    }

    // --- Lógica de Tareas ---
    function renderTaskList() {
        taskList.innerHTML = ''; // Limpiar lista
        if (state.tasks.length === 0) {
            taskList.innerHTML = '<p class="text-sm text-slate-400 px-3">No hay tareas pendientes. ¡Añade una!</p>';
            return;
        }

        // Ordenar tareas por prioridad (Alta > Media > Baja) y luego por fecha (más nuevas primero)
        const priorityOrder = { 'Alta': 3, 'Media': 2, 'Baja': 1 };
        const sortedTasks = [...state.tasks].sort((a, b) => {
            if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
                return priorityOrder[b.priority] - priorityOrder[a.priority];
            }
            return b.id - a.id; // Asumiendo que id es un timestamp o similar
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

    addTaskBtn.addEventListener('click', () => {
        const text = taskInput.value.trim();
        const priority = taskPriority.value;
        if (text) {
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

    taskList.addEventListener('click', (e) => {
        const completeBtn = e.target.closest('.complete-task-btn');
        const deleteBtn = e.target.closest('.delete-task-btn');

        if (completeBtn) {
            const taskId = Number(completeBtn.dataset.taskId);
            // Marcar tarea como completada (en este caso, la eliminamos y damos puntos)
            state.tasks = state.tasks.filter(t => t.id !== taskId);
            state.points += 10;
            logStudyActivity(); // ¡Registrar actividad!
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

    // --- Lógica de Temas (Decks) ---
    function renderDeckList() {
        deckList.innerHTML = ''; // Limpiar lista
        if (state.decks.length === 0) {
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

    newDeckBtn.addEventListener('click', () => {
        const deckName = prompt("Introduce el nombre del nuevo tema:");
        if (deckName && deckName.trim()) {
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
    
    // --- Lógica de Estadísticas ---
    function renderStats() {
        const today = getTodayString();
        const streak = calculateStreak(today, state.studyLog);
        streakEl.textContent = streak;

        const totalHours = (state.studyTimeMinutes / 60).toFixed(1);
        studyTimeEl.textContent = totalHours;

        let totalCards = 0;
        let totalMasteredCards = 0;
        domainByDeckList.innerHTML = '';

        if (state.decks.length === 0) {
            domainByDeckList.innerHTML = '<p class="text-sm text-slate-400 px-3">Añade temas para ver tu progreso.</p>';
        }

        state.decks.forEach(deck => {
            if (deck.cards.length > 0) {
                // Intervalo de maestría: 21 días o más
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
            currentDate.setDate(currentDate.getDate() - 1); // Retroceder un día
        }
        
        // Si no estudió hoy, pero sí ayer, la racha es la de ayer.
        if (!dates.has(todayString) && streak > 0) {
            // El bucle se detuvo en el primer día que NO estudió (hoy),
            // así que la racha de "ayer" es correcta.
            // Pero si el bucle contó hoy (streak > 0) y no estamos en hoy,
            // tenemos que restar 1.
            // Es más simple: si el log no incluye hoy, la racha se rompió.
            // PERO, si el log sí incluye hoy, la racha es `streak`.
            // Si el log NO incluye hoy:
            if (!dates.has(todayString)) {
                // ¿Estudió ayer?
                let yesterday = new Date(todayString + 'T00:00:00');
                yesterday.setDate(yesterday.getDate() - 1);
                if (dates.has(yesterday.toISOString().split('T')[0])) {
                    // Sí estudió ayer, la racha empieza desde ayer.
                    streak = 0;
                    currentDate = yesterday;
                    while (dates.has(currentDate.toISOString().split('T')[0])) {
                        streak++;
                        currentDate.setDate(currentDate.getDate() - 1);
                    }
                    return streak;
                } else {
                    // No estudió ni hoy ni ayer. Racha es 0.
                    return 0;
                }
            }
        }
        
        return streak;
    }


    // --- Lógica de Gestionar Tema (Manage) ---
    function renderManageView() {
        const deck = state.decks.find(d => d.id === state.currentDeckId);
        if (!deck) {
            navigate(VIEWS.DASHBOARD);
            return;
        }

        manageDeckTitle.textContent = deck.name;
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

    addCardForm.addEventListener('submit', (e) => {
        e.preventDefault();
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
                nextReviewDate: getTodayString() // Revisar hoy
            };
            deck.cards.push(newCard);
            renderManageView();
            saveStateToFirestore();
            addCardForm.reset();
        }
    });

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
    
    deleteDeckBtn.addEventListener('click', () => {
        if (confirm("¿Estás seguro de que quieres eliminar este tema y todas sus tarjetas? Esta acción no se puede deshacer.")) {
            state.decks = state.decks.filter(d => d.id !== state.currentDeckId);
            navigate(VIEWS.DASHBOARD);
            saveStateToFirestore();
        }
    });


    // --- Lógica de Sesión de Estudio (Study) ---

    function startStudySession() {
        const deck = state.decks.find(d => d.id === state.currentDeckId);
        if (!deck) return;

        const today = getTodayString();
        const cardsToReview = deck.cards
            .filter(c => c.nextReviewDate <= today)
            // Opcional: barajar las tarjetas
            .sort(() => Math.random() - 0.5);

        state.studySession = {
            cardsToReview: cardsToReview,
            currentCardIndex: 0,
            correctAnswers: 0,
        };
        
        logStudyActivity(); // Registrar actividad al INICIAR sesión
    }
    
    function renderStudyView() {
        const { cardsToReview, currentCardIndex } = state.studySession;
        const deck = state.decks.find(d => d.id === state.currentDeckId);
        
        if (!deck) {
            navigate(VIEWS.DASHBOARD);
            return;
        }

        studyDeckTitle.textContent = deck.name;
        
        if (currentCardIndex >= cardsToReview.length) {
            // Sesión terminada
            studyProgress.textContent = `Progreso: ${cardsToReview.length} / ${cardsToReview.length}`;
            studyCard.innerHTML = `
                <div class="text-center p-8">
                    <h3 class="text-2xl font-bold text-white mb-4">¡Sesión completada!</h3>
                    <p class="text-lg text-slate-300 mb-6">Repasaste ${cardsToReview.length} tarjetas.</p>
                    <button id="finish-study-session-btn" class="bg-teal-600 hover:bg-teal-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors">
                        Volver al Dashboard
                    </button>
                </div>
            `;
            // Añadir listener al botón de finalizar
            document.getElementById('finish-study-session-btn').addEventListener('click', () => {
                navigate(VIEWS.DASHBOARD);
                saveStateToFirestore(); // Guardar el progreso de las tarjetas
            });
            return;
        }
        
        // Mostrar tarjeta actual
        studyProgress.textContent = `Progreso: ${currentCardIndex} / ${cardsToReview.length}`;
        const currentCard = cardsToReview[currentCardIndex];
        
        // Mostrar pregunta
        studyQuestionImg.src = currentCard.questionImg || '';
        studyQuestionImg.classList.toggle('hidden', !currentCard.questionImg);
        studyQuestionTextEl.textContent = currentCard.question;
        
        studyAnswerImg.src = '';
        studyAnswerImg.classList.add('hidden');
        
        // --- ¡¡AQUÍ ESTABA EL ERROR!! ---
        // studyAnswerTextEl.textContent = currentCard.question; // <-- ERROR ANTIGUO
        studyAnswerTextEl.textContent = currentCard.answer; // <-- ¡CORREGIDO!
        // --- --- ---
        
        studyAnswerImg.onerror = () => { studyAnswerImg.classList.add('hidden'); };
        studyQuestionImg.onerror = () => { studyQuestionImg.classList.add('hidden'); };

        // Ocultar respuesta y botones de dificultad
        studyAnswerTextEl.parentElement.classList.add('hidden');
        studyDifficultyBtns.classList.add('hidden');
        
        // Mostrar botón "Mostrar Respuesta"
        showAnswerBtn.classList.remove('hidden');
        studyCard.classList.remove('hidden'); // Asegurarse de que la tarjeta esté visible
    }

    showAnswerBtn.addEventListener('click', () => {
        const { cardsToReview, currentCardIndex } = state.studySession;
        const currentCard = cardsToReview[currentCardIndex];
        
        // Mostrar respuesta
        studyAnswerImg.src = currentCard.answerImg || '';
        studyAnswerImg.classList.toggle('hidden', !currentCard.answerImg);
        studyAnswerTextEl.parentElement.classList.remove('hidden');
        
        // Ocultar botón "Mostrar Respuesta" y mostrar dificultad
        showAnswerBtn.classList.add('hidden');
        studyDifficultyBtns.classList.remove('hidden');
    });

    studyDifficultyBtns.addEventListener('click', (e) => {
        const difficulty = e.target.closest('button')?.dataset.difficulty;
        if (!difficulty) return;

        const { cardsToReview, currentCardIndex } = state.studySession;
        const card = cardsToReview[currentCardIndex];

        // --- Lógica de Repetición Espaciada (SM-2 Simplificado) ---
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
            // easeFactor no cambia
            state.points += 2;
        } else { // 'hard'
            nextInterval = 0; // Repetir pronto
            newEaseFactor = Math.max(1.3, easeFactor - 0.2); // Reducir facilidad
            state.points += 1;
        }
        
        const nextReviewDate = new Date(getTodayString() + 'T00:00:00');
        nextReviewDate.setDate(nextReviewDate.getDate() + nextInterval);
        
        // Actualizar la tarjeta original en el mazo (deck)
        const deck = state.decks.find(d => d.id === state.currentDeckId);
        const cardInDeck = deck.cards.find(c => c.id === card.id);
        if (cardInDeck) {
            cardInDeck.interval = nextInterval;
            cardInDeck.easeFactor = newEaseFactor;
            cardInDeck.nextReviewDate = nextReviewDate.toISOString().split('T')[0];
        }

        // Avanzar a la siguiente tarjeta
        state.studySession.currentCardIndex++;
        renderStudyView();
        // El guardado se hace al final de la sesión
    });
    
    function getNextInterval(lastInterval, difficulty) {
        if (difficulty === 'hard') return 1; // Revisar mañana
        if (lastInterval === 0) {
             return (difficulty === 'easy') ? 4 : 1;
        }
        if (lastInterval === 1) {
            return (difficulty === 'easy') ? 7 : 3;
        }
        // Lógica simple de duplicar
        let next = lastInterval * 2;
        if (difficulty === 'easy') next += 1;
        return Math.min(next, 60); // Máximo 2 meses
    }
    

    // --- Lógica de Quiz ---
    
    let quizState = {
        questions: [],
        currentQuestionIndex: 0,
        score: 0,
        answered: false
    };

    function startQuiz() {
        const deck = state.decks.find(d => d.id === state.currentDeckId);
        if (!deck || deck.cards.length < 4) return;

        logStudyActivity(); // ¡Registrar actividad!

        // Barajar las tarjetas y seleccionarlas (todas o un máximo)
        const shuffledCards = [...deck.cards].sort(() => Math.random() - 0.5);
        // const selectedCards = shuffledCards.slice(0, 10); // Límite de 10 preguntas (opcional)
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
        
        // Obtener 3 respuestas incorrectas aleatorias
        const incorrectCards = allCards.filter(c => c.id !== correctCard.id);
        const shuffledIncorrect = incorrectCards.sort(() => Math.random() - 0.5);
        
        for (let i = 0; i < 3 && i < shuffledIncorrect.length; i++) {
            options.push(shuffledIncorrect[i].answer);
        }

        // Barajar las opciones
        options.sort(() => Math.random() - 0.5);

        return {
            question: correctCard.question,
            options: options,
            correctAnswer: correctCard.answer
        };
    }
    
    function renderQuizView() {
        const deck = state.decks.find(d => d.id === state.currentDeckId);
        if (!deck) {
            navigate(VIEWS.DASHBOARD);
            return;
        }

        quizDeckTitle.textContent = `Quiz: ${deck.name}`;
        quizFeedback.classList.add('hidden');
        quizFeedback.textContent = '';
        nextQuizQuestionBtn.classList.add('hidden');
        
        const { questions, currentQuestionIndex } = quizState;

        if (currentQuestionIndex >= questions.length) {
            // Quiz terminado
            const scorePercent = (quizState.score / questions.length) * 100;
            quizQuestionText.textContent = '¡Quiz completado!';
            quizOptionsList.innerHTML = `
                <p class="text-xl text-center text-slate-300">
                    Tu puntuación: ${quizState.score} / ${questions.length} (${Math.round(scorePercent)}%)
                </p>
                <button id="finish-quiz-btn" class="w-full mt-6 bg-teal-600 hover:bg-teal-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors">
                    Volver al Dashboard
                </button>
            `;
            // Añadir listener
            document.getElementById('finish-quiz-btn').addEventListener('click', () => {
                navigate(VIEWS.DASHBOARD);
                saveStateToFirestore(); // Guardar puntos
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
        
        // Deshabilitar todas las opciones
        quizOptionsList.querySelectorAll('.quiz-option').forEach(btn => {
            btn.disabled = true;
            btn.classList.add('opacity-70');
            // Marcar la correcta y la incorrecta
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
            // Marcar la que seleccionó el usuario
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


    // --- Lógica del Pomodoro ---
    
    function updatePomodoroUI() {
        const minutes = Math.floor(state.pomodoro.timeLeft / 60);
        const seconds = state.pomodoro.timeLeft % 60;
        pomodoroTimerEl.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        
        startPomodoroBtn.textContent = state.pomodoro.isRunning ? 'Pausar' : 'Iniciar';
        
        if (state.pomodoro.isBreak) {
            document.body.classList.add('bg-teal-900');
            document.body.classList.remove('bg-slate-900');
        } else {
            document.body.classList.remove('bg-teal-900');
            document.body.classList.add('bg-slate-900');
        }
    }

    function startPomodoro() {
        if (state.pomodoro.isRunning) { // Pausar
            clearInterval(state.pomodoro.timer);
            state.pomodoro.isRunning = false;
            state.pomodoro.endTime = null; // Limpiar endTime al pausar
        } else { // Iniciar o Reanudar
            state.pomodoro.isRunning = true;
            
            // Si no hay un endTime (no es una reanudación) o el endTime es inválido,
            // establecer uno nuevo.
            if (!state.pomodoro.endTime || state.pomodoro.endTime <= Date.now()) {
                 state.pomodoro.endTime = Date.now() + (state.pomodoro.timeLeft * 1000);
            }
            // Si sí hay un endTime (es una reanudación de una recarga de página),
            // lo usamos tal cual y actualizamos timeLeft
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
        // No guardamos el estado aquí para no escribir en DB cada segundo
    }
    
    function handlePomodoroFinish() {
        clearInterval(state.pomodoro.timer);
        state.pomodoro.isRunning = false;
        state.pomodoro.endTime = null;
        
        playPomodoroSound(state.pomodoro.isBreak);

        if (state.pomodoro.isBreak) {
            // Termina el descanso
            state.pomodoro.isBreak = false;
            state.pomodoro.timeLeft = 25 * 60;
            showNotification("¡Descanso terminado! Es hora de enfocarse.");
        } else {
            // Termina la sesión de estudio
            state.pomodoro.isBreak = true;
            state.pomodoro.timeLeft = 5 * 60;
            state.points += 25;
            state.studyTimeMinutes += 25;
            logStudyActivity(); // ¡Registrar actividad!
            showNotification("¡Pomodoro completado! +25 puntos. ¡Toma un descanso!");
        }
        
        updatePomodoroUI();
        saveStateToFirestore(); // Guardar el estado al finalizar una etapa
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
        // Si la página se recargó y había un temporizador corriendo...
        if (state.pomodoro.endTime && state.pomodoro.endTime > Date.now()) {
            state.pomodoro.timeLeft = Math.round((state.pomodoro.endTime - Date.now()) / 1000);
            startPomodoro(); // Reanuda el temporizador
        } else if (state.pomodoro.endTime && state.pomodoro.endTime <= Date.now()) {
            // El temporizador terminó mientras la pestaña estaba cerrada
            handlePomodoroFinish();
        }
    }

    startPomodoroBtn.addEventListener('click', startPomodoro);
    resetPomodoroBtn.addEventListener('click', resetPomodoro);


    // --- Utilidades ---
    
    function getTodayString() {
        return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    }

    function showNotification(message) {
        notification.textContent = message;
        notification.classList.remove('hidden', 'opacity-0', 'translate-y-full');
        notification.classList.add('opacity-100', '-translate-y-4');
        
        setTimeout(() => {
            notification.classList.remove('opacity-100', '-translate-y-4');
            notification.classList.add('opacity-0', 'translate-y-full');
            setTimeout(() => notification.classList.add('hidden'), 500); // Ocultar después de la transición
        }, 3000);
    }
    
    // Web Audio API para sonidos (sin archivos externos)
    let audioCtx;
    function playPomodoroSound(isBreak) {
        try {
            if (!audioCtx) {
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            
            oscillator.type = 'sine';
            // Tono diferente para el descanso
            oscillator.frequency.setValueAtTime(isBreak ? 660 : 440, audioCtx.currentTime); 
            gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
            
            oscillator.start(audioCtx.currentTime);
            oscillator.stop(audioCtx.currentTime + 0.5); // Sonido de 0.5 seg
        } catch (e) {
            console.error("Error al reproducir sonido:", e);
        }
    }
});