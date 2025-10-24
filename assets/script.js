// Importar funciones de Firebase SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.19.1/firebase-app.js";
import { 
    getAuth, 
    GoogleAuthProvider, 
    signInWithPopup, 
    signOut, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/9.19.1/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    getDoc, 
    setDoc, 
    updateDoc, 
    collection, 
    addDoc, 
    onSnapshot, 
    query, 
    where, 
    Timestamp,
    increment,
    writeBatch,
    getDocs,
    deleteDoc
} from "https://www.gstatic.com/firebasejs/9.19.1/firebase-firestore.js";

// --- Configuración de Firebase (proporcionada por el usuario) ---
const firebaseConfig = {
    apiKey: "AIzaSyC6tqffatZ7NhMm5bGRh0kmjCLymj0DD74",
    authDomain: "focus-deck.firebaseapp.com",
    projectId: "focus-deck",
    storageBucket: "focus-deck.appspot.com",
    messagingSenderId: "81821453657",
    // appId: "1:81821453657:web:TU_APP_ID" // Opcional, pero recomendado si lo tienes
};

// --- Inicialización de Firebase ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// --- Variables de Estado Globales ---
let userId = null;
let currentDeckId = null;
let globalStats = { points: 0, streak: 0, totalStudyTime: 0 };
let activeTimerInterval = null;
let sessionStartTime = 0;

let studySession = {
    cards: [],
    currentIndex: 0,
    pointsEarned: 0
};

let quizSession = {
    cards: [],
    currentIndex: 0,
    correctCount: 0,
    pointsEarned: 0
};

let unsubscribeStats = () => {};
let unsubscribeDecks = () => {};
let unsubscribeCards = () => {};

// --- Selectores de Elementos del DOM ---
const views = {
    loading: document.getElementById('loading-view'),
    login: document.getElementById('login-view'),
    app: document.getElementById('app-view'),
    dashboard: document.getElementById('dashboard-view'),
    deck: document.getElementById('deck-view'),
    study: document.getElementById('study-view'),
    quiz: document.getElementById('quiz-view')
};

// Elementos del Header
const userPhoto = document.getElementById('user-photo');
const userName = document.getElementById('user-name');
const statsPoints = document.getElementById('stats-points');

// Elementos del Dashboard
const statsStreak = document.getElementById('stats-streak');
const statsTime = document.getElementById('stats-time');
const statsPointsDash = document.getElementById('stats-points-dash');
const deckList = document.getElementById('deck-list');
const noDecksMsg = document.getElementById('no-decks-msg');

// Elementos de la Vista de Mazo
const deckTitle = document.getElementById('deck-title');
const studyCount = document.getElementById('study-count');
const quizCount = document.getElementById('quiz-count');
const cardList = document.getElementById('card-list');
const noCardsMsg = document.getElementById('no-cards-msg');

// --- Función de Navegación (Router Simple) ---
function showView(viewId) {
    Object.values(views).forEach(view => view.style.display = 'none');
    if (views[viewId]) {
        views[viewId].style.display = 'flex';
        if(viewId === 'app') views[viewId].style.display = 'block'; // app-view es block
        if(viewId === 'dashboard' || viewId === 'deck' || viewId === 'study' || viewId === 'quiz') {
            views.app.style.display = 'block'; // Asegurarse que el contenedor de app esté visible
            views[viewId].style.display = 'block'; // Vistas dentro de app
        }
    }
}

// --- Lógica de Autenticación ---

document.getElementById('login-btn').addEventListener('click', async () => {
    try {
        await signInWithPopup(auth, provider);
        // onAuthStateChanged se encargará del resto
    } catch (error) {
        console.error("Error durante el inicio de sesión:", error);
        alert("Error al iniciar sesión: " + error.message);
    }
});

document.getElementById('logout-btn').addEventListener('click', async () => {
    try {
        // Detener listeners antes de desloguear
        unsubscribeAll();
        await signOut(auth);
        // onAuthStateChanged se encargará de mostrar el login
    } catch (error) {
        console.error("Error al cerrar sesión:", error);
    }
});

onAuthStateChanged(auth, (user) => {
    if (user) {
        userId = user.uid;
        // console.log("Usuario autenticado:", userId);
        showView('loading'); // Mostrar carga mientras se obtienen datos
        initUserData(user).then(() => {
            renderUserProfile(user);
            attachDataListeners();
            showView('dashboard');
        });
    } else {
        userId = null;
        unsubscribeAll();
        showView('login');
    }
});

function renderUserProfile(user) {
    userPhoto.src = user.photoURL || `https://placehold.co/40x40/4a5568/a0aec0?text=${user.displayName[0]}`;
    userName.textContent = user.displayName;
}

async function initUserData(user) {
    const userRef = doc(db, 'users', user.uid);
    try {
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
            // Crear perfil de usuario si no existe
            await setDoc(userRef, {
                email: user.email,
                name: user.displayName,
                photoURL: user.photoURL,
                points: 0,
                streak: 1,
                totalStudyTime: 0, // en segundos
                lastLogin: Timestamp.now()
            });
        } else {
            // Usuario existe, comprobar racha
            const data = userSnap.data();
            const lastLogin = data.lastLogin.toDate();
            const today = new Date();
            
            const isSameDay = today.toDateString() === lastLogin.toDateString();
            
            if (!isSameDay) {
                const yesterday = new Date(today);
                yesterday.setDate(today.getDate() - 1);
                const isYesterday = yesterday.toDateString() === lastLogin.toDateString();
                
                let newStreak = 1;
                if (isYesterday) {
                    newStreak = data.streak + 1;
                }
                
                await updateDoc(userRef, {
                    streak: newStreak,
                    lastLogin: Timestamp.now()
                });
            }
        }
    } catch (error) {
        console.error("Error inicializando datos de usuario:", error);
    }
}

// --- Lógica de Base de Datos (Listeners) ---

function attachDataListeners() {
    if (!userId) return;
    
    // Detener listeners antiguos
    unsubscribeAll();

    // 1. Listener para estadísticas del usuario
    const userRef = doc(db, 'users', userId);
    unsubscribeStats = onSnapshot(userRef, (doc) => {
        if (doc.exists()) {
            const data = doc.data();
            globalStats = {
                points: data.points,
                streak: data.streak,
                totalStudyTime: data.totalStudyTime
            };
            updateStatsUI(globalStats);
        }
    }, (error) => console.error("Error en listener de estadísticas:", error));

    // 2. Listener para los mazos
    const decksCol = collection(db, 'users', userId, 'decks');
    unsubscribeDecks = onSnapshot(decksCol, (snapshot) => {
        if (snapshot.empty) {
            deckList.innerHTML = '';
            noDecksMsg.style.display = 'block';
            return;
        }
        
        noDecksMsg.style.display = 'none';
        deckList.innerHTML = ''; // Limpiar lista
        snapshot.forEach(doc => {
            const deck = doc.data();
            const deckEl = document.createElement('div');
            deckEl.className = "bg-gray-800 p-5 rounded-lg shadow-lg hover:shadow-emerald-500/20 hover:border-emerald-500 border-2 border-transparent transition-all cursor-pointer";
            deckEl.dataset.id = doc.id;
            deckEl.innerHTML = `
                <h3 class="text-xl font-bold text-white mb-2">${escapeHTML(deck.name)}</h3>
                <p class="text-sm text-gray-400">Tarjetas: ${deck.cardCount || 0}</p>
            `;
            deckEl.addEventListener('click', () => openDeckView(doc.id, deck.name));
            deckList.appendChild(deckEl);
        });
    }, (error) => console.error("Error en listener de mazos:", error));
}

function unsubscribeAll() {
    unsubscribeStats();
    unsubscribeDecks();
    unsubscribeCards();
}

function updateStatsUI(stats) {
    statsPoints.textContent = stats.points;
    statsPointsDash.textContent = `${stats.points} Puntos`;
    statsStreak.textContent = `${stats.streak} Días`;
    
    const hours = Math.floor(stats.totalStudyTime / 3600);
    const minutes = Math.floor((stats.totalStudyTime % 3600) / 60);
    statsTime.textContent = `${hours}h ${minutes}m`;
}

// --- Lógica de Mazos (Decks) ---

document.getElementById('add-deck-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('deck-name-input');
    const deckName = input.value.trim();
    
    if (deckName && userId) {
        try {
            await addDoc(collection(db, 'users', userId, 'decks'), {
                name: deckName,
                createdAt: Timestamp.now(),
                cardCount: 0
            });
            // Dar puntos por crear mazo
            await updateUserStats({ points: increment(10) });
            input.value = '';
        } catch (error) {
            console.error("Error creando mazo:", error);
        }
    }
});

async function openDeckView(deckId, name) {
    currentDeckId = deckId;
    deckTitle.textContent = name;
    
    // Resetear lista de tarjetas
    cardList.innerHTML = '';
    noCardsMsg.style.display = 'block';
    studyCount.textContent = '0';
    quizCount.textContent = '0';
    
    // Detener listener de tarjetas anterior
    unsubscribeCards();
    
    // Listener para las tarjetas de este mazo
    const cardsCol = collection(db, 'users', userId, 'decks', currentDeckId, 'flashcards');
    unsubscribeCards = onSnapshot(cardsCol, (snapshot) => {
        cardList.innerHTML = '';
        if (snapshot.empty) {
            noCardsMsg.style.display = 'block';
            quizCount.textContent = '0';
            studyCount.textContent = '0';
            return;
        }
        
        noCardsMsg.style.display = 'none';
        let cardsToReview = 0;
        const now = new Date();
        
        snapshot.forEach(doc => {
            const card = doc.data();
            
            // Contar tarjetas para estudiar
            if (card.nextReviewDate.toDate() <= now) {
                cardsToReview++;
            }
            
            // Renderizar tarjeta en la lista
            const cardEl = document.createElement('div');
            cardEl.className = "flex justify-between items-center p-4 border-b border-gray-700 last:border-b-0";
            cardEl.innerHTML = `
                <p class="text-gray-300 w-1/2 truncate">${escapeHTML(card.front)}</p>
                <p class="text-gray-400 w-1/2 truncate">${escapeHTML(card.back)}</p>
                <button data-id="${doc.id}" class="delete-card-btn text-red-500 hover:text-red-400 p-1">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                </button>
            `;
            cardList.appendChild(cardEl);
        });
        
        studyCount.textContent = cardsToReview;
        quizCount.textContent = snapshot.size;

    }, (error) => console.error("Error en listener de tarjetas:", error));
    
    showView('deck');
}

// Eliminar tarjeta (delegación de eventos)
cardList.addEventListener('click', async (e) => {
    const deleteBtn = e.target.closest('.delete-card-btn');
    if (deleteBtn) {
        const cardId = deleteBtn.dataset.id;
        if (confirm('¿Estás seguro de que quieres eliminar esta tarjeta?')) {
            try {
                await deleteDoc(doc(db, 'users', userId, 'decks', currentDeckId, 'flashcards', cardId));
                // Actualizar contador de tarjetas en el mazo
                const deckRef = doc(db, 'users', userId, 'decks', currentDeckId);
                await updateDoc(deckRef, { cardCount: increment(-1) });
            } catch (error) {
                console.error("Error eliminando tarjeta:", error);
            }
        }
    }
});

// Eliminar Mazo
document.getElementById('delete-deck-btn').addEventListener('click', async () => {
    if (!currentDeckId) return;
    if (confirm('¿Estás seguro de que quieres eliminar este mazo? Se borrarán TODAS sus tarjetas. Esta acción no se puede deshacer.')) {
        try {
            showView('loading');
            // 1. Borrar todas las tarjetas (subcolección)
            const cardsCol = collection(db, 'users', userId, 'decks', currentDeckId, 'flashcards');
            const cardsSnapshot = await getDocs(cardsCol);
            const batch = writeBatch(db);
            cardsSnapshot.forEach(doc => {
                batch.delete(doc.ref);
            });
            await batch.commit();
            
            // 2. Borrar el documento del mazo
            await deleteDoc(doc(db, 'users', userId, 'decks', currentDeckId));
            
            showView('dashboard');
        } catch (error) {
            console.error("Error eliminando mazo:", error);
            alert("Error al eliminar el mazo.");
            showView('deck'); // Volver a la vista del mazo si falla
        }
    }
});

document.getElementById('back-to-dash-btn').addEventListener('click', () => {
    currentDeckId = null;
    unsubscribeCards(); // Detener listener de tarjetas al salir
    showView('dashboard');
});

// --- Lógica de Tarjetas (Flashcards) ---

document.getElementById('add-card-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const frontInput = document.getElementById('card-front-input');
    const backInput = document.getElementById('card-back-input');
    const front = frontInput.value.trim();
    const back = backInput.value.trim();

    if (front && back && userId && currentDeckId) {
        try {
            // Añadir tarjeta
            await addDoc(collection(db, 'users', userId, 'decks', currentDeckId, 'flashcards'), {
                front: front,
                back: back,
                deckId: currentDeckId,
                createdAt: Timestamp.now(),
                // Estado inicial para repetición espaciada
                easinessFactor: 2.5, // Factor de facilidad inicial
                interval: 0, // Días hasta la próxima revisión
                repetitions: 0, // Número de veces revisada
                nextReviewDate: Timestamp.now() // Revisar inmediatamente
            });
            
            // Actualizar contador de tarjetas en el mazo
            const deckRef = doc(db, 'users', userId, 'decks', currentDeckId);
            await updateDoc(deckRef, { cardCount: increment(1) });
            
            // Dar puntos por añadir tarjeta
            await updateUserStats({ points: increment(1) });
            
            frontInput.value = '';
            backInput.value = '';
        } catch (error) {
            console.error("Error añadiendo tarjeta:", error);
        }
    }
});

// --- Lógica de Sesión de Estudio (Repetición Espaciada) ---

document.getElementById('start-study-btn').addEventListener('click', async () => {
    if (!userId || !currentDeckId) return;
    
    showView('loading');
    
    // 1. Obtener tarjetas para repasar
    const cardsCol = collection(db, 'users', userId, 'decks', currentDeckId, 'flashcards');
    const q = query(cardsCol, where("nextReviewDate", "<=", Timestamp.now()));
    
    try {
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            alert("¡Genial! No tienes tarjetas para repasar en este mazo por ahora.");
            showView('deck');
            return;
        }
        
        studySession.cards = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        studySession.currentIndex = 0;
        studySession.pointsEarned = 0;
        
        // Mezclar tarjetas (Algoritmo Fisher-Yates)
        for (let i = studySession.cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [studySession.cards[i], studySession.cards[j]] = [studySession.cards[j], studySession.cards[i]];
        }
        
        // 2. Iniciar UI de estudio
        document.getElementById('study-card-total').textContent = studySession.cards.length;
        document.getElementById('study-complete').style.display = 'none';
        document.getElementById('study-flashcard').style.display = 'block';

        startTimer('study-timer');
        showNextStudyCard();
        showView('study');
        
    } catch (error) {
        console.error("Error al iniciar sesión de estudio:", error);
        // ¡IMPORTANTE! Este error suele ocurrir si el índice compuesto no existe en Firestore.
        // Firebase te dará un enlace en la consola para crearlo.
        if (error.code === 'failed-precondition') {
            alert("Error: La base de datos requiere un índice para esta consulta. Por favor, revisa la consola de depuración (F12) para ver el enlace y crear el índice en Firebase.");
        }
        showView('deck');
    }
});

function showNextStudyCard() {
    if (studySession.currentIndex >= studySession.cards.length) {
        // Sesión terminada
        endStudySession();
        return;
    }
    
    const card = studySession.cards[studySession.currentIndex];
    document.getElementById('study-card-front').textContent = card.front;
    document.getElementById('study-card-back').textContent = card.back;
    document.getElementById('study-card-count').textContent = studySession.currentIndex + 1;
    
    // Resetear tarjeta
    document.getElementById('study-flashcard').classList.remove('is-flipped');
    document.getElementById('study-controls-show').style.display = 'block';
    document.getElementById('study-controls-review').style.display = 'none';
}

document.getElementById('show-answer-btn').addEventListener('click', () => {
    document.getElementById('study-flashcard').classList.add('is-flipped');
    document.getElementById('study-controls-show').style.display = 'none';
    document.getElementById('study-controls-review').style.display = 'grid';
});

// Event listener para botones de revisión
document.getElementById('study-controls-review').addEventListener('click', (e) => {
    const btn = e.target.closest('.review-btn');
    if (btn) {
        const quality = parseInt(btn.dataset.quality, 10); // Calidad: 1 (Otra vez), 2 (Difícil), 3 (Bien), 4 (Fácil)
        processSpacedRepetition(quality);
    }
});

async function processSpacedRepetition(quality) {
    const card = studySession.cards[studySession.currentIndex];
    
    // Algoritmo SM-2 simplificado
    let { easinessFactor, interval, repetitions } = card;

    if (quality < 3) { // Si es "Otra vez" o "Difícil"
        repetitions = 0; // Resetear repeticiones
        interval = 1; // Próxima revisión en 1 día
    } else {
        repetitions += 1;
        if (repetitions === 1) {
            interval = 1;
        } else if (repetitions === 2) {
            interval = 6;
        } else {
            interval = Math.round(interval * easinessFactor);
        }
    }

    // Actualizar factor de facilidad
    easinessFactor = easinessFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    if (easinessFactor < 1.3) easinessFactor = 1.3; // Mínimo EF
    
    // Calcular próxima fecha de revisión (en días)
    // Para la demo, usamos intervalos cortos (minutos) para "Otra vez" y "Difícil"
    const nextReviewDate = new Date();
    if (quality === 1) {
        nextReviewDate.setMinutes(nextReviewDate.getMinutes() + 1);
    } else if (quality === 2) {
        nextReviewDate.setMinutes(nextReviewDate.getMinutes() + 10);
    } else {
        nextReviewDate.setDate(nextReviewDate.getDate() + interval);
    }
    
    // Actualizar tarjeta en Firestore
    try {
        const cardRef = doc(db, 'users', userId, 'decks', currentDeckId, 'flashcards', card.id);
        await updateDoc(cardRef, {
            easinessFactor: easinessFactor,
            interval: interval,
            repetitions: repetitions,
            nextReviewDate: Timestamp.fromDate(nextReviewDate)
        });
        
        // Dar puntos por revisar
        studySession.pointsEarned += 5;
        
        // Siguiente tarjeta
        studySession.currentIndex += 1;
        showNextStudyCard();
        
    } catch (error) {
        console.error("Error actualizando tarjeta:", error);
    }
}

function endStudySession() {
    stopTimer();
    document.getElementById('study-flashcard').style.display = 'none';
    document.getElementById('study-controls-show').style.display = 'none';
    document.getElementById('study-controls-review').style.display = 'none';
    
    document.getElementById('study-points-earned').textContent = studySession.pointsEarned;
    document.getElementById('study-complete').style.display = 'block';
    
    // Guardar estadísticas
    const duration = Math.round((Date.now() - sessionStartTime) / 1000); // en segundos
    updateUserStats({
        points: increment(studySession.pointsEarned),
        totalStudyTime: increment(duration)
    });
}

document.getElementById('study-finish-btn').addEventListener('click', () => {
    openDeckView(currentDeckId, deckTitle.textContent); // Recargar vista del mazo
});
document.getElementById('study-back-btn').addEventListener('click', () => {
    if(confirm("¿Seguro que quieres terminar la sesión? El progreso no guardado se perderá.")) {
        stopTimer();
        openDeckView(currentDeckId, deckTitle.textContent);
    }
});

// --- Lógica de Sesión de Quiz ---

document.getElementById('start-quiz-btn').addEventListener('click', async () => {
    if (!userId || !currentDeckId) return;
    
    showView('loading');
    
    // 1. Obtener TODAS las tarjetas del mazo
    const cardsCol = collection(db, 'users', userId, 'decks', currentDeckId, 'flashcards');
    
    try {
        const snapshot = await getDocs(cardsCol);
        if (snapshot.empty) {
            alert("No puedes empezar un quiz sin tarjetas en el mazo.");
            showView('deck');
            return;
        }
        
        let allCards = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Mezclar tarjetas (Algoritmo Fisher-Yates)
        for (let i = allCards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [allCards[i], allCards[j]] = [allCards[j], allCards[i]];
        }
        
        quizSession.cards = allCards.slice(0, 10); // Máximo 10 tarjetas por quiz
        quizSession.currentIndex = 0;
        quizSession.correctCount = 0;
        quizSession.pointsEarned = 0;
        
        // 2. Iniciar UI de quiz
        document.getElementById('quiz-card-total').textContent = quizSession.cards.length;
        document.getElementById('quiz-results').style.display = 'none';
        document.getElementById('quiz-active-content').style.display = 'block';
        document.getElementById('quiz-feedback').style.display = 'none';

        startTimer('quiz-timer');
        showNextQuizCard();
        showView('quiz');
        
    } catch (error) {
        console.error("Error al iniciar quiz:", error);
        showView('deck');
    }
});

function showNextQuizCard() {
    if (quizSession.currentIndex >= quizSession.cards.length) {
        endQuizSession();
        return;
    }
    
    const card = quizSession.cards[quizSession.currentIndex];
    document.getElementById('quiz-card-front').textContent = card.front;
    document.getElementById('quiz-card-count').textContent = quizSession.currentIndex + 1;
    
    document.getElementById('quiz-active-content').style.display = 'block';
    document.getElementById('quiz-feedback').style.display = 'none';
    document.getElementById('quiz-answer-input').value = '';
    document.getElementById('quiz-answer-input').focus();
}

document.getElementById('quiz-answer-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const userAnswer = document.getElementById('quiz-answer-input').value.trim();
    const card = quizSession.cards[quizSession.currentIndex];
    const correctAnswer = card.back.trim();
    
    // Comparación simple (se puede mejorar con normalización)
    const isCorrect = userAnswer.toLowerCase() === correctAnswer.toLowerCase();
    
    document.getElementById('feedback-user-answer').textContent = userAnswer;
    document.getElementById('feedback-correct-answer').textContent = correctAnswer;
    
    if (isCorrect) {
        document.getElementById('feedback-title').textContent = "¡Correcto!";
        document.getElementById('feedback-title').className = "text-2xl font-bold mb-4 text-emerald-400";
        quizSession.correctCount++;
        quizSession.pointsEarned += 10;
    } else {
        document.getElementById('feedback-title').textContent = "Incorrecto";
        document.getElementById('feedback-title').className = "text-2xl font-bold mb-4 text-red-400";
    }
    
    document.getElementById('quiz-active-content').style.display = 'none';
    document.getElementById('quiz-feedback').style.display = 'block';
});

document.getElementById('quiz-next-btn').addEventListener('click', () => {
    quizSession.currentIndex++;
    showNextQuizCard();
});

function endQuizSession() {
    stopTimer();
    document.getElementById('quiz-active-content').style.display = 'none';
    document.getElementById('quiz-feedback').style.display = 'none';
    
    const total = quizSession.cards.length;
    const correct = quizSession.correctCount;
    const percentage = total > 0 ? Math.round((correct / total) * 100) : 0;
    
    document.getElementById('quiz-score-percent').textContent = percentage;
    document.getElementById('quiz-score-correct').textContent = correct;
    document.getElementById('quiz-score-total').textContent = total;
    document.getElementById('quiz-points-earned').textContent = quizSession.pointsEarned;
    
    document.getElementById('quiz-results').style.display = 'block';
    
    // Guardar estadísticas
    const duration = Math.round((Date.now() - sessionStartTime) / 1000); // en segundos
    updateUserStats({
        points: increment(quizSession.pointsEarned),
        totalStudyTime: increment(duration)
    });
}

document.getElementById('quiz-finish-btn').addEventListener('click', () => {
    openDeckView(currentDeckId, deckTitle.textContent); // Recargar vista del mazo
});
document.getElementById('quiz-back-btn').addEventListener('click', () => {
    if(confirm("¿Seguro que quieres salir del quiz? Tu puntuación no se guardará.")) {
        stopTimer();
        openDeckView(currentDeckId, deckTitle.textContent);
    }
});

// --- Funciones de Utilidad ---

// Actualizar estadísticas del usuario
async function updateUserStats(statsUpdate) {
    if (!userId) return;
    const userRef = doc(db, 'users', userId);
    try {
        await updateDoc(userRef, statsUpdate);
    } catch (error) {
        console.error("Error actualizando estadísticas:", error);
    }
}

// Timer de sesión
function startTimer(elementId) {
    stopTimer(); // Detener cualquier timer anterior
    sessionStartTime = Date.now();
    const timerEl = document.getElementById(elementId);
    
    activeTimerInterval = setInterval(() => {
        const elapsedSeconds = Math.floor((Date.now() - sessionStartTime) / 1000);
        const minutes = Math.floor(elapsedSeconds / 60);
        const seconds = elapsedSeconds % 60;
        timerEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }, 1000);
}

function stopTimer() {
    if (activeTimerInterval) {
        clearInterval(activeTimerInterval);
        activeTimerInterval = null;
    }
}

// Función simple para escapar HTML
function escapeHTML(str) {
    return str.replace(/[&<>"']/g, function(m) {
        return {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        }[m];
    });
}

// --- Inicio de la App ---
showView('loading'); // Empezar con la vista de carga
// onAuthStateChanged se activará automáticamente
