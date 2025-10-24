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
        // Evita errores si studyLog no existe aún
        if (!state.studyLog) state.studyLog = []; 
        if (!state.studyLog.includes(today)) {
            console.log("Registrando actividad de estudio para la racha de hoy.");
            state.studyLog.push(today);
            
            if (currentUserId) {
                try {
                    const userDocRef = doc(db, "users", currentUserId);
                    // Usa arrayUnion para agregar la fecha al array en Firestore
                    await updateDoc(userDocRef, {
                        studyLog: arrayUnion(today) 
                    });
                } catch(e) {
                    console.error("Error actualizando studyLog: ", e);
                    // Si falla updateDoc, intenta guardar todo el estado como fallback
                    await saveStateToFirestore(); 
                }
            }
            renderStats(); // Actualiza las estadísticas después de registrar la actividad
        }
    }


    // --- Lógica de Autenticación (Versión Original después de Firebase) ---

    /**
     * Maneja el estado de autenticación del usuario.
     */
    onAuthStateChanged(auth, (user) => {
        if (user) {
            // Usuario está logueado
            currentUserId = user.uid;
            console.log("Usuario logueado:", currentUserId);
            
            // Ocultamos el contenedor de autenticación (que tiene el botón de login)
            if (authContainer) authContainer.classList.add('hidden');
            // Mostramos el contenido principal de la app
            if (mainContent) mainContent.classList.remove('hidden');
            
            // Mostramos la info del usuario en el header
            if (userProfilePic && user.photoURL) {
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

            // Mostramos el contenedor de autenticación
            if (authContainer) authContainer.classList.remove('hidden');
            // Ocultamos el contenido principal
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
        // Asegurarse que state.tasks es un array antes de ordenar
        const tasksToRender = Array.isArray(state.tasks) ? state.tasks : [];
        const sortedTasks = [...tasksToRender].sort((a, b) => {
            if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
                return priorityOrder[b.priority] - priorityOrder[a.priority];
            }
            return b.id - a.id; // Ordenar por ID si la prioridad es la misma
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
            if (!taskInput || !taskPriority) return; // Chequeo adicional
            const text = taskInput.value.trim();
            const priority = taskPriority.value;
            if (text) {
                if (!state.tasks || !Array.isArray(state.tasks)) state.tasks = []; // Asegura que es un array
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
                if (!state.points) state.points = 0; // Asegura que points existe
                state.points += 10;
                logStudyActivity(); // Registra actividad
                render(); // Re-renderizar todo
                saveStateToFirestore();
                showNotification("¡Tarea completada! +10 puntos");
            }

            if (deleteBtn) {
                const taskId = Number(deleteBtn.dataset.taskId);
                state.tasks = state.tasks.filter(t => t.id !== taskId);
                renderTaskList(); // Solo re-renderizar la lista de tareas
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
            // Asegurarse que deck.cards es un array
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
    }

    if (newDeckBtn) {
        newDeckBtn.addEventListener('click', () => {
            const deckName = prompt("Introduce el nombre del nuevo tema:");
            if (deckName && deckName.trim()) {
                if (!state.decks || !Array.isArray(state.decks)) state.decks = []; // Asegura que es un array
                const newDeck = {
                    id: 'deck_' + Date.now(),
                    name: deckName.trim(),
                    cards: []
                };
                state.decks.push(newDeck);
                state.currentDeckId = newDeck.id;
                navigate(VIEWS.MANAGE); // Navegar a la vista de gestión
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
                startStudySession(); // Prepara la sesión de estudio
                navigate(VIEWS.STUDY);
            }
            if (quizBtn) {
                state.currentDeckId = quizBtn.dataset.deckId;
                startQuiz(); // Prepara el quiz
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
        // Asegurarse que studyLog es un array
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
                // Asegurarse que deck.cards es un array
                const cards = Array.isArray(deck.cards) ? deck.cards : [];
                if (cards.length > 0) {
                    const masteredCards = cards.filter(c => getNextInterval(c.interval || 0, 'easy') >= 21).length;
                    const domain = (masteredCards / cards.length) * 100;

                    totalCards += cards.length;
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

        // Contar hacia atrás desde hoy
        while (dates.has(currentDate.toISOString().split('T')[0])) {
            streak++;
            currentDate.setDate(currentDate.getDate() - 1);
        }
        
        // Si no estudió hoy, la racha es 0, a menos que haya estudiado ayer.
        // Si no estudió hoy pero sí ayer, la racha ya se calculó correctamente.
        if (!dates.has(todayString)) {
           // Si el bucle while no encontró nada (streak = 0) y no estudió hoy, la racha es 0.
           // Si el bucle encontró días (streak > 0) pero no hoy, esa racha es del pasado.
           // La lógica original era un poco confusa, la simplificamos:
           // Si no está la fecha de hoy en el Set, la racha actual es 0.
           return 0; 
        }
        
        return streak; // Devuelve la racha contada desde hoy hacia atrás.
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
        
        // Asegurarse que deck.cards es un array
        const cards = Array.isArray(deck.cards) ? deck.cards : [];
        if (cards.length === 0) {
            cardList.innerHTML = '<p class="text-sm text-slate-400 px-3">No hay tarjetas. ¡Añade la primera!</p>';
            return;
        }

        cards.forEach(card => {
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
                // Asegurar que deck.cards es un array
                if (!Array.isArray(deck.cards)) deck.cards = [];
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
            // Usa window.confirm para compatibilidad
            if (window.confirm("¿Estás seguro de que quieres eliminar este tema y todas sus tarjetas? Esta acción no se puede deshacer.")) {
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
        // Asegurarse que deck.cards es un array
        const cards = Array.isArray(deck.cards) ? deck.cards : [];
        const cardsToReview = cards
            .filter(c => c.nextReviewDate <= today)
            .sort(() => Math.random() - 0.5); // Barajar tarjetas

        state.studySession = {
            cardsToReview: cardsToReview,
            currentCardIndex: 0,
            correctAnswers: 0, // Reiniciar contador de correctas
        };
        
        logStudyActivity(); // Registrar actividad al iniciar sesión
    }
    
    function renderStudyView() {
        // Asegurar que state.studySession existe
        if (!state.studySession) state.studySession = defaultState.studySession; 
        const { cardsToReview, currentCardIndex } = state.studySession;
        if (!state.decks) state.decks = [];
        const deck = state.decks.find(d => d.id === state.currentDeckId);
        
        if (!deck) {
            navigate(VIEWS.DASHBOARD);
            return;
        }

        if (studyDeckTitle) studyDeckTitle.textContent = deck.name;
        
        // Asegurarse que cardsToReview es un array
        const reviewList = Array.isArray(cardsToReview) ? cardsToReview : [];
        
        if (currentCardIndex >= reviewList.length) {
            // Sesión completada
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
                        saveStateToFirestore(); // Guardar estado al finalizar
                    });
                }
            }
            return;
        }
        
        // Mostrar tarjeta actual
        if (studyProgress) studyProgress.textContent = `Progreso: ${currentCardIndex} / ${reviewList.length}`;
        const currentCard = reviewList[currentCardIndex];
        
        // Mostrar pregunta
        if (studyQuestionImg) {
            studyQuestionImg.src = currentCard.questionImg || '';
            studyQuestionImg.classList.toggle('hidden', !currentCard.questionImg);
            studyQuestionImg.onerror = () => { studyQuestionImg.classList.add('hidden'); };
        }
        if (studyQuestionTextEl) studyQuestionTextEl.textContent = currentCard.question;
        
        // Ocultar respuesta inicialmente
        if (studyAnswerImg) {
            studyAnswerImg.src = ''; // Limpiar src
            studyAnswerImg.classList.add('hidden');
            studyAnswerImg.onerror = () => { studyAnswerImg.classList.add('hidden'); };
        }
        if (studyAnswerTextEl) {
             // ¡¡AQUÍ ESTABA EL BUG ORIGINAL DE FLASHCARDS!!
             // Debe mostrar la RESPUESTA, no la pregunta
            studyAnswerTextEl.textContent = currentCard.answer; 
            if (studyAnswerTextEl.parentElement) studyAnswerTextEl.parentElement.classList.add('hidden');
        }
        
        // Mostrar botón "Mostrar Respuesta", ocultar dificultad
        if (studyDifficultyBtns) studyDifficultyBtns.classList.add('hidden');
        if (showAnswerBtn) showAnswerBtn.classList.remove('hidden');
        if (studyCard) studyCard.classList.remove('hidden'); // Asegurarse que la card es visible
    }

    if (showAnswerBtn) {
        showAnswerBtn.addEventListener('click', () => {
            const { cardsToReview, currentCardIndex } = state.studySession;
             // Asegurar que cardsToReview es un array
            const reviewList = Array.isArray(cardsToReview) ? cardsToReview : [];
            if (currentCardIndex >= reviewList.length) return; // Salir si no hay tarjeta
            
            const currentCard = reviewList[currentCardIndex];
            
            // Mostrar respuesta (imagen y texto)
            if (studyAnswerImg) {
                studyAnswerImg.src = currentCard.answerImg || '';
                studyAnswerImg.classList.toggle('hidden', !currentCard.answerImg);
            }
            if (studyAnswerTextEl && studyAnswerTextEl.parentElement) {
                studyAnswerTextEl.parentElement.classList.remove('hidden');
            }
            
            // Ocultar botón "Mostrar Respuesta", mostrar dificultad
            showAnswerBtn.classList.add('hidden');
            if (studyDifficultyBtns) studyDifficultyBtns.classList.remove('hidden');
        });
    }

    if (studyDifficultyBtns) {
        studyDifficultyBtns.addEventListener('click', (e) => {
            const difficulty = e.target.closest('button')?.dataset.difficulty;
            if (!difficulty) return;

            const { cardsToReview, currentCardIndex } = state.studySession;
            // Asegurar que cardsToReview es un array
            const reviewList = Array.isArray(cardsToReview) ? cardsToReview : [];
             if (currentCardIndex >= reviewList.length) return; // Salir si no hay tarjeta
             
            const card = reviewList[currentCardIndex];

            // Cálculo SM-2 (simplificado)
            let { interval, easeFactor } = card;
            interval = interval || 0; // Intervalo en días
            easeFactor = easeFactor || 2.5; // Factor de facilidad

            let nextInterval;
            let newEaseFactor = easeFactor;

            if (difficulty === 'easy') { // Fácil
                nextInterval = getNextInterval(interval, 'easy');
                newEaseFactor += 0.1;
                state.points += 3;
            } else if (difficulty === 'good') { // Bien
                nextInterval = getNextInterval(interval, 'good');
                 state.points += 2;
            } else { // Difícil (Again)
                nextInterval = 0; // Reiniciar intervalo
                newEaseFactor = Math.max(1.3, easeFactor - 0.2); // Reducir factor de facilidad
                 state.points += 1;
            }
            
            // Calcular próxima fecha de revisión
            const nextReviewDate = new Date(getTodayString() + 'T00:00:00'); // Empezar desde hoy
            nextReviewDate.setDate(nextReviewDate.getDate() + nextInterval); // Añadir el intervalo
            
            // Actualizar la tarjeta en el estado global (state.decks)
            const deck = state.decks.find(d => d.id === state.currentDeckId);
            const cardInDeck = deck.cards.find(c => c.id === card.id);
            if (cardInDeck) {
                cardInDeck.interval = nextInterval;
                cardInDeck.easeFactor = newEaseFactor;
                cardInDeck.nextReviewDate = nextReviewDate.toISOString().split('T')[0]; // Guardar como YYYY-MM-DD
            }

            // Avanzar a la siguiente tarjeta
            state.studySession.currentCardIndex++;
            renderStudyView(); // Re-renderizar la vista de estudio
            // No guardar aquí, se guarda al final de la sesión o al salir
        });
    }
    
    // Función SM-2 simplificada para calcular el próximo intervalo
    function getNextInterval(lastInterval, difficulty) {
        if (difficulty === 'hard') return 1; // Si difícil, repasar mañana
        
        if (lastInterval === 0) { // Primera vez que se ve la tarjeta
             return (difficulty === 'easy') ? 4 : 1; // Fácil: 4 días, Bien: 1 día
        }
        if (lastInterval === 1) { // Si el último intervalo fue 1 día
            return (difficulty === 'easy') ? 7 : 3; // Fácil: 7 días, Bien: 3 días
        }
        // Para intervalos mayores
        let next = lastInterval * 2; // Duplicar intervalo como base
        if (difficulty === 'easy') next += 1; // Añadir un día extra si fue fácil
        
        return Math.min(next, 60); // Limitar el intervalo máximo a 60 días
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
         // Asegurar que deck.cards es un array y tiene suficientes tarjetas
        const cards = Array.isArray(deck.cards) ? deck.cards : [];
        if (!deck || cards.length < 4) {
            showNotification("Necesitas al menos 4 tarjetas para iniciar un quiz.");
            return;
        }

        logStudyActivity(); // Registrar actividad

        const shuffledCards = [...cards].sort(() => Math.random() - 0.5);
        // Usar todas las tarjetas para el quiz
        const selectedCards = shuffledCards; 

        quizState.questions = selectedCards.map(card => {
            return generateQuizQuestion(card, cards); // Pasar todas las cards para generar opciones
        });
        
        quizState.currentQuestionIndex = 0;
        quizState.score = 0;
        quizState.answered = false;

        renderQuizView(); // Renderizar la vista del quiz
    }

    // Genera una pregunta de quiz con opciones múltiples
    function generateQuizQuestion(correctCard, allCards) {
        let options = [correctCard.answer]; // La respuesta correcta siempre es una opción
        
        // Filtrar las tarjetas incorrectas
        const incorrectCards = allCards.filter(c => c.id !== correctCard.id);
        const shuffledIncorrect = incorrectCards.sort(() => Math.random() - 0.5); // Barajar incorrectas
        
        // Añadir hasta 3 opciones incorrectas
        for (let i = 0; i < 3 && i < shuffledIncorrect.length; i++) {
            options.push(shuffledIncorrect[i].answer);
        }

        // Barajar todas las opciones (correcta + incorrectas)
        options.sort(() => Math.random() - 0.5);

        return {
            question: correctCard.question, // La pregunta de la tarjeta
            options: options, // Las opciones barajadas
            correctAnswer: correctCard.answer // La respuesta correcta
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

        // Fin del Quiz
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
                        saveStateToFirestore(); // Guardar puntos ganados
                    });
                }
            }
            return;
        }

        // Mostrar pregunta actual
        if (quizProgress) quizProgress.textContent = `Pregunta: ${currentQuestionIndex + 1} / ${questions.length}`;
        const question = questions[currentQuestionIndex];
        if (quizQuestionText) quizQuestionText.textContent = question.question;
        
        // Renderizar opciones
        if (quizOptionsList) quizOptionsList.innerHTML = '';
        question.options.forEach(option => {
            const optionEl = document.createElement('button');
            optionEl.className = 'quiz-option w-full bg-slate-700 hover:bg-slate-600 text-slate-200 text-left p-4 rounded-lg transition-colors';
            optionEl.textContent = option;
            if (quizOptionsList) quizOptionsList.appendChild(optionEl);
        });

        quizState.answered = false; // Permitir responder de nuevo
    }

    // Event listener para las opciones del quiz
    if (quizOptionsList) {
        quizOptionsList.addEventListener('click', (e) => {
            const selectedOption = e.target.closest('.quiz-option');
            if (!selectedOption || quizState.answered) return; // Si no es opción o ya respondió

            quizState.answered = true; // Marcar como respondida
            const answer = selectedOption.textContent;
            const question = quizState.questions[quizState.currentQuestionIndex];
            
            // Deshabilitar todas las opciones y marcar la correcta
            quizOptionsList.querySelectorAll('.quiz-option').forEach(btn => {
                btn.disabled = true;
                btn.classList.add('opacity-70'); // Atenuar
                if (btn.textContent === question.correctAnswer) {
                    btn.classList.remove('bg-slate-700', 'hover:bg-slate-600');
                    btn.classList.add('bg-green-700'); // Marcar correcta en verde
                }
            });
            
            // Evaluar respuesta
            if (answer === question.correctAnswer) {
                if (quizFeedback) {
                    quizFeedback.textContent = '¡Correcto! +10 puntos';
                    quizFeedback.className = 'p-3 rounded-lg bg-green-900 text-green-200 mt-4';
                }
                quizState.score++;
                state.points += 10; // Sumar puntos
            } else {
                if (quizFeedback) {
                    quizFeedback.textContent = `Incorrecto. La respuesta era: ${question.correctAnswer}`;
                    quizFeedback.className = 'p-3 rounded-lg bg-red-900 text-red-200 mt-4';
                }
                // Marcar la incorrecta seleccionada en rojo
                selectedOption.classList.remove('bg-slate-700', 'opacity-70');
                selectedOption.classList.add('bg-red-700'); 
            }

            // Mostrar feedback y botón siguiente
            if (quizFeedback) quizFeedback.classList.remove('hidden');
            if (nextQuizQuestionBtn) nextQuizQuestionBtn.classList.remove('hidden');
        });
    }

    // Event listener para el botón "Siguiente Pregunta"
    if (nextQuizQuestionBtn) {
        nextQuizQuestionBtn.addEventListener('click', () => {
            quizState.currentQuestionIndex++;
            renderQuizView(); // Renderizar la siguiente pregunta
        });
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
