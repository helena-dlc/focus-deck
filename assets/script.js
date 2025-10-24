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
let currentUser = null;

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

// --- FUNCIONES DE AUTENTICACIÓN ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        // Usuario logueado
        console.log("Usuario autenticado:", user.email);
        currentUserId = user.uid;
        currentUser = user;
        
        // Mostrar contenido principal y ocultar login
        showMainApp();
        
        // Cargar datos del usuario desde Firestore
        loadUserDataFromFirestore();
        
        // Actualizar header con info del usuario
        updateAuthUI();
        
    } else {
        // Usuario no logueado
        console.log("Usuario no autenticado");
        currentUserId = null;
        currentUser = null;
        
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

function updateAuthUI() {
    const authContainer = document.getElementById('auth-container');
    if (currentUser && authContainer) {
        authContainer.innerHTML = `
            <div class="flex items-center gap-3">
                <div class="text-right">
                    <div class="text-sm font-medium text-slate-200">${currentUser.displayName}</div>
                    <div id="points-display" class="text-xs text-primary font-bold">${state.points} puntos</div>
                </div>
                <img src="${currentUser.photoURL}" alt="Perfil" class="w-10 h-10 rounded-full border-2 border-primary">
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
            updateUI();
            
        } else {
            console.log("No hay datos previos, usando estado por defecto");
            // Guardar estado inicial
            saveStateToFirestore();
        }
    }, (error) => {
        console.error("Error cargando datos de Firestore:", error);
    });
}

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

function updateUI() {
    // Actualizar puntos en el header
    const pointsDisplay = document.getElementById('points-display');
    if (pointsDisplay) {
        pointsDisplay.textContent = `${state.points} puntos`;
    }
    
    // Actualizar pomodoro
    updatePomodoroUI();
    
    // Actualizar lista de decks
    renderDecks();
    
    // Actualizar tareas
    renderTasks();
}

// --- APLICACIÓN PRINCIPAL ---
document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    
    // Event listener para login
    const loginBtn = document.getElementById('login-btn');
    if (loginBtn) {
        loginBtn.addEventListener('click', loginWithGoogle);
    }
    
    // Event listeners para pomodoro (usando IDs correctos del HTML)
    const startPomodoroBtn = document.getElementById('start-pomodoro');
    const resetPomodoroBtn = document.getElementById('reset-pomodoro');
    
    if (startPomodoroBtn) {
        startPomodoroBtn.addEventListener('click', togglePomodoro);
    }
    if (resetPomodoroBtn) {
        resetPomodoroBtn.addEventListener('click', resetPomodoro);
    }
    
    // Event listeners para tareas (usando IDs correctos del HTML)
    const addTaskBtn = document.getElementById('add-task-btn');
    const taskInput = document.getElementById('new-task-input');
    
    if (addTaskBtn) {
        addTaskBtn.addEventListener('click', addTask);
    }
    if (taskInput) {
        taskInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') addTask();
        });
    }
    
    // Event listeners para decks (usando ID correcto del HTML)
    const addDeckBtn = document.getElementById('add-deck-btn');
    if (addDeckBtn) {
        addDeckBtn.addEventListener('click', () => {
            document.getElementById('new-deck-modal').classList.remove('hidden');
            document.getElementById('new-deck-modal').classList.add('flex');
        });
    }
    
    // Event listeners para modal de nuevo deck
    const cancelDeckModal = document.getElementById('cancel-deck-modal');
    const saveDeckModal = document.getElementById('save-deck-modal');
    
    if (cancelDeckModal) {
        cancelDeckModal.addEventListener('click', () => {
            document.getElementById('new-deck-modal').classList.add('hidden');
            document.getElementById('new-deck-modal').classList.remove('flex');
        });
    }
    
    if (saveDeckModal) {
        saveDeckModal.addEventListener('click', createNewDeck);
    }
    
    // Inicializar UI
    updatePomodoroUI();
});

// --- FUNCIONES DE POMODORO ---
function updatePomodoroUI() {
    const pomodoroTimer = document.getElementById('pomodoro-timer');
    const startBtn = document.getElementById('start-pomodoro');
    
    if (pomodoroTimer) {
        const minutes = Math.floor(state.pomodoro.timeLeft / 60);
        const seconds = state.pomodoro.timeLeft % 60;
        pomodoroTimer.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    
    if (startBtn) {
        startBtn.textContent = state.pomodoro.isRunning ? 'Pausar' : 'Iniciar';
    }
}

function togglePomodoro() {
    if (state.pomodoro.isRunning) {
        clearInterval(state.pomodoro.timer);
        state.pomodoro.isRunning = false;
        state.pomodoro.endTime = null;
    } else {
        state.pomodoro.isRunning = true;
        state.pomodoro.endTime = Date.now() + (state.pomodoro.timeLeft * 1000);
        
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

function handlePomodoroFinish() {
    clearInterval(state.pomodoro.timer);
    state.pomodoro.isRunning = false;
    state.pomodoro.endTime = null;
    
    if (state.pomodoro.isBreak) {
        state.pomodoro.isBreak = false;
        state.pomodoro.timeLeft = 25 * 60;
        showNotification("¡Descanso terminado! Es hora de enfocarse.");
    } else {
        state.pomodoro.isBreak = true;
        state.pomodoro.timeLeft = 5 * 60;
        state.points += 25;
        state.studyTimeMinutes += 25;
        showNotification("¡Pomodoro completado! +25 puntos. ¡Toma un descanso!");
    }
    
    updatePomodoroUI();
    updateUI();
    saveStateToFirestore();
}

function checkRunningPomodoro() {
    if (state.pomodoro.endTime && state.pomodoro.endTime > Date.now()) {
        state.pomodoro.timeLeft = Math.round((state.pomodoro.endTime - Date.now()) / 1000);
        togglePomodoro();
    } else if (state.pomodoro.endTime && state.pomodoro.endTime <= Date.now()) {
        handlePomodoroFinish();
    }
}

// --- FUNCIONES DE TAREAS ---
function addTask() {
    const taskInput = document.getElementById('new-task-input');
    const taskPriority = document.getElementById('task-priority');
    
    if (!taskInput || !taskPriority) return;
    
    const text = taskInput.value.trim();
    const priority = parseInt(taskPriority.value);
    
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

function renderTasks() {
    const taskList = document.getElementById('task-list');
    if (!taskList) return;
    
    taskList.innerHTML = '';
    
    const sortedTasks = [...state.tasks].sort((a, b) => {
        if (a.completed === b.completed) {
            return b.priority - a.priority;
        }
        return a.completed ? 1 : -1;
    });
    
    sortedTasks.forEach(task => {
        const taskEl = document.createElement('div');
        taskEl.className = `flex items-center gap-3 p-3 rounded-lg border ${
            task.completed 
                ? 'bg-slate-800 border-slate-700 opacity-60' 
                : 'bg-dark-card border-dark-border'
        }`;
        
        const priorityColors = {
            1: 'bg-red-500',   // Alta
            2: 'bg-yellow-500', // Media
            3: 'bg-green-500'   // Baja
        };
        
        taskEl.innerHTML = `
            <button class="w-5 h-5 rounded border-2 border-slate-400 flex items-center justify-center transition-colors ${
                task.completed ? 'bg-primary border-primary' : 'hover:border-primary'
            }" onclick="toggleTask('${task.id}')">
                ${task.completed ? '<i data-lucide="check" class="w-3 h-3 text-white"></i>' : ''}
            </button>
            <div class="w-3 h-3 rounded-full ${priorityColors[task.priority]}"></div>
            <span class="flex-1 text-secondary ${task.completed ? 'line-through' : ''}">${task.text}</span>
            <button class="text-slate-400 hover:text-red-400" onclick="deleteTask('${task.id}')">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
        `;
        
        taskList.appendChild(taskEl);
    });
    
    lucide.createIcons();
}

function toggleTask(taskId) {
    const task = state.tasks.find(t => t.id === taskId);
    if (task) {
        task.completed = !task.completed;
        if (task.completed) {
            state.points += 5;
            showNotification('Tarea completada! +5 puntos');
            updateUI();
        }
        renderTasks();
        saveStateToFirestore();
    }
}

function deleteTask(taskId) {
    state.tasks = state.tasks.filter(t => t.id !== taskId);
    renderTasks();
    saveStateToFirestore();
    showNotification('Tarea eliminada');
}

// Hacer funciones globales para los onclick
window.toggleTask = toggleTask;
window.deleteTask = deleteTask;

// --- FUNCIONES DE DECKS ---
function createNewDeck() {
    const deckNameInput = document.getElementById('new-deck-name');
    if (!deckNameInput) return;
    
    const deckName = deckNameInput.value.trim();
    if (!deckName) {
        showNotification('El nombre del tema es obligatorio');
        return;
    }
    
    const newDeck = {
        id: Date.now().toString(),
        name: deckName,
        cards: [],
        createdAt: new Date().toISOString()
    };
    
    state.decks.push(newDeck);
    deckNameInput.value = '';
    
    // Cerrar modal
    document.getElementById('new-deck-modal').classList.add('hidden');
    document.getElementById('new-deck-modal').classList.remove('flex');
    
    renderDecks();
    saveStateToFirestore();
    showNotification('Nuevo tema creado');
}

function renderDecks() {
    const deckList = document.getElementById('deck-list');
    if (!deckList) return;
    
    deckList.innerHTML = '';
    
    if (state.decks.length === 0) {
        deckList.innerHTML = `
            <div class="col-span-full text-center py-12 text-slate-400">
                <i data-lucide="book-open" class="w-16 h-16 mx-auto mb-4 opacity-50"></i>
                <p class="text-lg">No tienes temas de estudio aún</p>
                <p class="text-sm">¡Crea tu primer tema para empezar a estudiar!</p>
            </div>
        `;
        lucide.createIcons();
        return;
    }
    
    state.decks.forEach(deck => {
        const deckEl = document.createElement('div');
        deckEl.className = 'bg-dark-card p-6 rounded-2xl border border-dark-border shadow-lg';
        
        const totalCards = deck.cards ? deck.cards.length : 0;
        
        deckEl.innerHTML = `
            <h3 class="text-lg font-semibold text-secondary mb-3">${deck.name}</h3>
            <div class="space-y-2 text-sm text-slate-400 mb-4">
                <div class="flex justify-between">
                    <span>Total de cartas:</span>
                    <span>${totalCards}</span>
                </div>
            </div>
            <div class="flex gap-2">
                <button 
                    class="flex-1 bg-primary hover:bg-primary-dark text-dark-bg px-4 py-2 rounded-lg text-sm transition-colors"
                    onclick="startStudy('${deck.id}')"
                    ${totalCards === 0 ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}
                >
                    ${totalCards === 0 ? 'Sin cartas' : 'Estudiar'}
                </button>
                <button class="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm transition-colors" onclick="startQuiz('${deck.id}')">
                    Quiz
                </button>
                <button class="bg-dark-border hover:bg-slate-600 text-secondary px-4 py-2 rounded-lg text-sm transition-colors" onclick="manageDeck('${deck.id}')">
                    Gestionar
                </button>
            </div>
        `;
        
        deckList.appendChild(deckEl);
    });
}

// Funciones placeholder para deck management
function startStudy(deckId) {
    showNotification('Función de estudio en desarrollo');
}

function startQuiz(deckId) {
    showNotification('Función de quiz en desarrollo');
}

function manageDeck(deckId) {
    showNotification('Función de gestión en desarrollo');
}

// Hacer funciones globales
window.startStudy = startStudy;
window.startQuiz = startQuiz;
window.manageDeck = manageDeck;

// --- FUNCIONES DE UTILIDAD ---
function showNotification(message) {
    const notificationModal = document.getElementById('notification-modal');
    const notificationText = document.getElementById('notification-text');
    const notificationOkBtn = document.getElementById('notification-ok-btn');
    
    if (notificationModal && notificationText) {
        notificationText.textContent = message;
        notificationModal.classList.remove('hidden');
        notificationModal.classList.add('flex');
        
        if (notificationOkBtn) {
            notificationOkBtn.onclick = () => {
                notificationModal.classList.add('hidden');
                notificationModal.classList.remove('flex');
            };
        }
    }
}