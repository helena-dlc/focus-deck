// Focus Deck - Aplicación Principal
// Gestión completa de la app de estudio gamificada

class FocusDeckApp {
  constructor() {
    this.currentUser = null;
    this.userPoints = 0;
    this.currentView = 'dashboard';
    
    // Sistemas principales
    this.pomodoroTimer = new PomodoroTimer();
    this.taskManager = new TaskManager();
    this.flashcardManager = new FlashcardManager();
    this.quizManager = new QuizManager();
    this.statsManager = new StatsManager();
    
    // Estado de la aplicación
    this.appState = {
      decks: [],
      tasks: [],
      stats: {
        totalStudyTime: 0,
        currentStreak: 0,
        bestStreak: 0,
        completedTasks: 0,
        totalPoints: 0
      }
    };
    
    this.init();
  }

  async init() {
    try {
      console.log('🚀 Inicializando Focus Deck...');
      
      // Configurar event listeners
      this.setupEventListeners();
      
      // Configurar observador de autenticación
      auth.onAuthStateChanged((user) => {
        if (user) {
          this.handleUserLogin(user);
        } else {
          this.handleUserLogout();
        }
      });
      
      console.log('✅ Focus Deck inicializada correctamente');
    } catch (error) {
      console.error('❌ Error inicializando Focus Deck:', error);
      this.showToast('Error iniciando la aplicación', 'error');
    }
  }

  setupEventListeners() {
    // Autenticación
    document.getElementById('googleSignIn').addEventListener('click', () => this.signInWithGoogle());
    document.getElementById('logoutBtn').addEventListener('click', () => this.signOut());
    document.getElementById('userProfileBtn').addEventListener('click', () => this.toggleProfileDropdown());

    // Navegación
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const view = e.currentTarget.dataset.view;
        this.switchView(view);
      });
    });

    // Modales
    document.querySelectorAll('.modal-close').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const modal = e.target.closest('.modal');
        this.closeModal(modal);
      });
    });

    // Clics fuera del modal
    document.querySelectorAll('.modal').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          this.closeModal(modal);
        }
      });
    });

    // Formularios
    document.getElementById('createDeckForm').addEventListener('submit', (e) => this.handleCreateDeck(e));
    document.getElementById('addTaskForm').addEventListener('submit', (e) => this.handleAddTask(e));
    document.getElementById('addCardForm').addEventListener('submit', (e) => this.handleAddCard(e));

    // Botones principales
    document.getElementById('createDeckBtn').addEventListener('click', () => this.openModal('createDeckModal'));
    document.getElementById('addTaskBtn').addEventListener('click', () => this.openModal('addTaskModal'));

    // Click fuera del dropdown de perfil
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#userProfileBtn')) {
        document.getElementById('profileDropdown').classList.add('hidden');
      }
    });
  }

  // === AUTENTICACIÓN ===
  
  async signInWithGoogle() {
    try {
      console.log('🔐 Iniciando sesión con Google...');
      const result = await auth.signInWithPopup(googleProvider);
      console.log('✅ Usuario autenticado:', result.user.displayName);
    } catch (error) {
      console.error('❌ Error en autenticación:', error);
      this.showToast('Error al iniciar sesión', 'error');
    }
  }

  async signOut() {
    try {
      await auth.signOut();
      console.log('👋 Usuario desconectado');
    } catch (error) {
      console.error('❌ Error al cerrar sesión:', error);
      this.showToast('Error al cerrar sesión', 'error');
    }
  }

  async handleUserLogin(user) {
    console.log('👤 Usuario conectado:', user.displayName);
    this.currentUser = user;
    
    // Actualizar UI
    document.getElementById('userName').textContent = user.displayName;
    document.getElementById('userPhoto').src = user.photoURL;
    
    // Cargar datos del usuario
    await this.loadUserData();
    
    // Mostrar app principal
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('mainApp').classList.remove('hidden');
    
    this.showToast(`¡Bienvenido, ${user.displayName}!`, 'success');
  }

  handleUserLogout() {
    console.log('🚪 Manejando logout...');
    this.currentUser = null;
    this.userPoints = 0;
    
    // Limpiar estado
    this.appState = {
      decks: [],
      tasks: [],
      stats: {
        totalStudyTime: 0,
        currentStreak: 0,
        bestStreak: 0,
        completedTasks: 0,
        totalPoints: 0
      }
    };
    
    // Mostrar pantalla de login
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('mainApp').classList.add('hidden');
  }

  toggleProfileDropdown() {
    const dropdown = document.getElementById('profileDropdown');
    dropdown.classList.toggle('hidden');
  }

  // === GESTIÓN DE DATOS ===
  
  async loadUserData() {
    try {
      console.log('📊 Cargando datos del usuario...');
      
      const userId = this.currentUser.uid;
      
      // Cargar configuración del usuario
      const userDoc = await db.collection('users').doc(userId).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        this.userPoints = userData.points || 0;
        this.appState.stats = { ...this.appState.stats, ...userData.stats };
      } else {
        // Crear documento de usuario nuevo
        await this.createUserDocument();
      }
      
      // Cargar decks
      await this.loadDecks();
      
      // Cargar tareas
      await this.loadTasks();
      
      // Actualizar UI
      this.updatePointsDisplay();
      this.updateStatsDisplay();
      this.renderDashboard();
      
      console.log('✅ Datos cargados correctamente');
    } catch (error) {
      console.error('❌ Error cargando datos:', error);
      this.showToast('Error cargando datos', 'error');
    }
  }

  async createUserDocument() {
    const userId = this.currentUser.uid;
    const userData = {
      email: this.currentUser.email,
      displayName: this.currentUser.displayName,
      photoURL: this.currentUser.photoURL,
      points: 0,
      stats: {
        totalStudyTime: 0,
        currentStreak: 0,
        bestStreak: 0,
        completedTasks: 0,
        totalPoints: 0
      },
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      lastLoginAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    await db.collection('users').doc(userId).set(userData);
    console.log('👤 Documento de usuario creado');
  }

  async saveUserData() {
    if (!this.currentUser) return;
    
    try {
      const userId = this.currentUser.uid;
      await db.collection('users').doc(userId).update({
        points: this.userPoints,
        stats: this.appState.stats,
        lastUpdateAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    } catch (error) {
      console.error('❌ Error guardando datos:', error);
    }
  }

  // === NAVEGACIÓN ===
  
  switchView(viewName) {
    // Ocultar vista actual
    document.querySelectorAll('.view').forEach(view => {
      view.classList.remove('active');
    });
    
    // Mostrar nueva vista
    document.getElementById(`${viewName}View`).classList.add('active');
    
    // Actualizar navegación
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    document.querySelector(`[data-view="${viewName}"]`).classList.add('active');
    
    this.currentView = viewName;
    
    // Cargar contenido específico de la vista
    this.loadViewContent(viewName);
  }

  loadViewContent(viewName) {
    switch (viewName) {
      case 'dashboard':
        this.renderDashboard();
        break;
      case 'flashcards':
        this.renderFlashcardsView();
        break;
      case 'quiz':
        this.renderQuizView();
        break;
      case 'tasks':
        this.renderTasksView();
        break;
      case 'stats':
        this.renderStatsView();
        break;
    }
  }

  // === MODALES ===
  
  openModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.classList.add('active');
    
    // Focus en el primer input
    setTimeout(() => {
      const firstInput = modal.querySelector('input, textarea');
      if (firstInput) firstInput.focus();
    }, 100);
  }

  closeModal(modal) {
    if (typeof modal === 'string') {
      modal = document.getElementById(modal);
    }
    modal.classList.remove('active');
    
    // Limpiar formularios
    const forms = modal.querySelectorAll('form');
    forms.forEach(form => form.reset());
  }

  // === SISTEMA DE PUNTOS ===
  
  async addPoints(points, reason = '') {
    this.userPoints += points;
    this.appState.stats.totalPoints = this.userPoints;
    
    this.updatePointsDisplay();
    await this.saveUserData();
    
    if (reason) {
      this.showToast(`+${points} puntos - ${reason}`, 'success');
    }
  }

  updatePointsDisplay() {
    document.getElementById('userPoints').textContent = this.userPoints;
    document.getElementById('totalPoints').textContent = this.userPoints;
  }

  // === DASHBOARD ===
  
  renderDashboard() {
    this.renderTasksPreview();
    this.renderDecksPreview();
    this.updateStatsDisplay();
  }

  renderTasksPreview() {
    const container = document.getElementById('tasksPreview');
    const pendingTasks = this.appState.tasks.filter(task => !task.completed).slice(0, 3);
    
    if (pendingTasks.length === 0) {
      container.innerHTML = '<p class="text-gray-400 text-sm">No hay tareas pendientes</p>';
      return;
    }
    
    container.innerHTML = pendingTasks.map(task => `
      <div class="flex items-center gap-3">
        <div class="w-3 h-3 rounded-full ${this.getPriorityColor(task.priority)}"></div>
        <span class="text-sm flex-1">${task.description}</span>
      </div>
    `).join('');
  }

  renderDecksPreview() {
    const container = document.getElementById('decksPreview');
    const recentDecks = this.appState.decks.slice(0, 3);
    
    if (recentDecks.length === 0) {
      container.innerHTML = '<p class="text-gray-400 text-sm">No hay temas creados</p>';
      return;
    }
    
    container.innerHTML = recentDecks.map(deck => `
      <div class="flex items-center justify-between">
        <div>
          <span class="text-sm font-medium">${deck.name}</span>
          <div class="text-xs text-gray-400">${deck.cards?.length || 0} cartas</div>
        </div>
        <div class="text-xs text-green-400">${this.calculateDeckMastery(deck)}% dominado</div>
      </div>
    `).join('');
  }

  updateStatsDisplay() {
    document.getElementById('currentStreak').textContent = this.appState.stats.currentStreak;
    document.getElementById('globalProgress').textContent = this.calculateGlobalProgress();
    document.getElementById('totalStudyTime').textContent = this.formatStudyTime(this.appState.stats.totalStudyTime);
    document.getElementById('bestStreak').textContent = this.appState.stats.bestStreak;
    document.getElementById('completedTasks').textContent = this.appState.stats.completedTasks;
  }

  // === UTILIDADES ===
  
  getPriorityColor(priority) {
    const colors = {
      alta: 'bg-red-500',
      media: 'bg-yellow-500',
      baja: 'bg-green-500'
    };
    return colors[priority] || 'bg-gray-500';
  }

  calculateDeckMastery(deck) {
    if (!deck.cards || deck.cards.length === 0) return 0;
    
    const masteredCards = deck.cards.filter(card => 
      card.reviewData && card.reviewData.easeFactor >= 2.5 && card.reviewData.interval >= 21
    ).length;
    
    return Math.round((masteredCards / deck.cards.length) * 100);
  }

  calculateGlobalProgress() {
    if (this.appState.decks.length === 0) return 0;
    
    const totalMastery = this.appState.decks.reduce((sum, deck) => 
      sum + this.calculateDeckMastery(deck), 0
    );
    
    return Math.round(totalMastery / this.appState.decks.length);
  }

  formatStudyTime(minutes) {
    const hours = Math.floor(minutes / 60);
    return hours > 0 ? `${hours}h` : `${minutes}m`;
  }

  // === NOTIFICACIONES ===
  
  showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    const icon = document.getElementById('toastIcon');
    const messageEl = document.getElementById('toastMessage');
    
    // Configurar icono según tipo
    const icons = {
      success: 'fas fa-check-circle',
      error: 'fas fa-exclamation-circle',
      warning: 'fas fa-exclamation-triangle',
      info: 'fas fa-info-circle'
    };
    
    icon.className = icons[type] || icons.info;
    messageEl.textContent = message;
    
    // Aplicar clase de tipo
    toast.className = `toast ${type}`;
    toast.classList.add('show');
    
    // Auto-ocultar después de 3 segundos
    setTimeout(() => {
      toast.classList.remove('show');
    }, 3000);
  }

  // === MANEJO DE FORMULARIOS ===
  
  async handleCreateDeck(e) {
    e.preventDefault();
    
    const name = document.getElementById('deckName').value.trim();
    const description = document.getElementById('deckDescription').value.trim();
    
    if (!name) {
      this.showToast('El nombre del tema es requerido', 'error');
      return;
    }
    
    try {
      await this.flashcardManager.createDeck(name, description);
      this.closeModal('createDeckModal');
      this.showToast('Tema creado exitosamente', 'success');
      
      if (this.currentView === 'flashcards') {
        this.renderFlashcardsView();
      }
    } catch (error) {
      console.error('Error creando deck:', error);
      this.showToast('Error creando el tema', 'error');
    }
  }

  async handleAddTask(e) {
    e.preventDefault();
    
    const description = document.getElementById('taskDescription').value.trim();
    const priority = document.getElementById('taskPriority').value;
    
    if (!description) {
      this.showToast('La descripción de la tarea es requerida', 'error');
      return;
    }
    
    try {
      await this.taskManager.addTask(description, priority);
      this.closeModal('addTaskModal');
      this.showToast('Tarea agregada exitosamente', 'success');
      
      if (this.currentView === 'tasks') {
        this.renderTasksView();
      }
      this.renderTasksPreview();
    } catch (error) {
      console.error('Error agregando tarea:', error);
      this.showToast('Error agregando la tarea', 'error');
    }
  }

  async handleAddCard(e) {
    e.preventDefault();
    
    const question = document.getElementById('cardQuestion').value.trim();
    const answer = document.getElementById('cardAnswer').value.trim();
    const questionImageFile = document.getElementById('questionImage').files[0];
    const answerImageFile = document.getElementById('answerImage').files[0];
    
    if (!question || !answer) {
      this.showToast('La pregunta y respuesta son requeridas', 'error');
      return;
    }
    
    try {
      const currentDeckId = document.getElementById('addCardModal').dataset.deckId;
      await this.flashcardManager.addCard(currentDeckId, question, answer, questionImageFile, answerImageFile);
      this.closeModal('addCardModal');
      this.showToast('Carta agregada exitosamente', 'success');
      
      if (this.currentView === 'flashcards') {
        this.renderFlashcardsView();
      }
    } catch (error) {
      console.error('Error agregando carta:', error);
      this.showToast('Error agregando la carta', 'error');
    }
  }

  // === RENDERIZADO DE VISTAS ===
  
  renderFlashcardsView() {
    // Implementación del renderizado de flashcards
    this.flashcardManager.renderDecks();
  }

  renderQuizView() {
    // Implementación del renderizado de quiz
    this.quizManager.renderQuizSelector();
  }

  renderTasksView() {
    // Implementación del renderizado de tareas
    this.taskManager.renderTasks();
  }

  renderStatsView() {
    // Las estadísticas ya se actualizan automáticamente
    this.updateStatsDisplay();
  }

  // === CARGA DE DATOS ===
  
  async loadDecks() {
    try {
      const userId = this.currentUser.uid;
      const decksSnapshot = await db.collection('users').doc(userId).collection('decks').get();
      
      this.appState.decks = [];
      decksSnapshot.forEach(doc => {
        this.appState.decks.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      console.log(`📚 ${this.appState.decks.length} decks cargados`);
    } catch (error) {
      console.error('Error cargando decks:', error);
    }
  }

  async loadTasks() {
    try {
      const userId = this.currentUser.uid;
      const tasksSnapshot = await db.collection('users').doc(userId).collection('tasks').get();
      
      this.appState.tasks = [];
      tasksSnapshot.forEach(doc => {
        this.appState.tasks.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      // Ordenar tareas (pendientes primero, luego por prioridad)
      this.appState.tasks.sort((a, b) => {
        if (a.completed !== b.completed) {
          return a.completed ? 1 : -1;
        }
        
        const priorityOrder = { alta: 0, media: 1, baja: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });
      
      console.log(`📝 ${this.appState.tasks.length} tareas cargadas`);
    } catch (error) {
      console.error('Error cargando tareas:', error);
    }
  }
}

// === TEMPORIZADOR POMODORO ===

class PomodoroTimer {
  constructor() {
    this.workTime = 25 * 60; // 25 minutos en segundos
    this.breakTime = 5 * 60; // 5 minutos en segundos
    this.currentTime = this.workTime;
    this.isRunning = false;
    this.isBreak = false;
    this.interval = null;
    
    this.setupEventListeners();
    this.updateDisplay();
  }

  setupEventListeners() {
    document.getElementById('startPauseBtn').addEventListener('click', () => this.toggleTimer());
    document.getElementById('resetBtn').addEventListener('click', () => this.resetTimer());
  }

  toggleTimer() {
    if (this.isRunning) {
      this.pauseTimer();
    } else {
      this.startTimer();
    }
  }

  startTimer() {
    this.isRunning = true;
    this.updateButton();
    this.updateStatus();
    
    this.interval = setInterval(() => {
      this.currentTime--;
      this.updateDisplay();
      
      if (this.currentTime <= 0) {
        this.completeSession();
      }
    }, 1000);
  }

  pauseTimer() {
    this.isRunning = false;
    clearInterval(this.interval);
    this.updateButton();
    this.updateStatus();
  }

  resetTimer() {
    this.pauseTimer();
    this.currentTime = this.isBreak ? this.breakTime : this.workTime;
    this.updateDisplay();
    this.updateStatus();
  }

  async completeSession() {
    this.pauseTimer();
    
    if (this.isBreak) {
      // Terminar descanso, volver a trabajo
      this.isBreak = false;
      this.currentTime = this.workTime;
      document.body.classList.remove('break-mode');
      app.showToast('¡Descanso terminado! Hora de trabajar', 'info');
    } else {
      // Terminar trabajo, comenzar descanso
      this.isBreak = true;
      this.currentTime = this.breakTime;
      document.body.classList.add('break-mode');
      
      // Otorgar puntos
      await app.addPoints(25, 'Pomodoro completado');
      
      // Actualizar estadísticas
      app.appState.stats.totalStudyTime += 25;
      await app.saveUserData();
      
      app.showToast('¡Pomodoro completado! +25 puntos', 'success');
      this.playNotificationSound();
    }
    
    this.updateDisplay();
    this.updateStatus();
  }

  updateDisplay() {
    const minutes = Math.floor(this.currentTime / 60);
    const seconds = this.currentTime % 60;
    const display = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    const timerElement = document.getElementById('timerDisplay');
    timerElement.textContent = display;
    
    // Agregar clase de animación si está corriendo
    if (this.isRunning) {
      timerElement.classList.add('timer-running');
    } else {
      timerElement.classList.remove('timer-running');
    }
    
    // Cambiar color para descanso
    if (this.isBreak) {
      timerElement.classList.add('timer-break');
    } else {
      timerElement.classList.remove('timer-break');
    }
  }

  updateButton() {
    const button = document.getElementById('startPauseBtn');
    const icon = button.querySelector('i');
    
    if (this.isRunning) {
      icon.className = 'fas fa-pause';
      button.innerHTML = '<i class="fas fa-pause"></i> Pausar';
      button.classList.remove('bg-green-600', 'hover:bg-green-700');
      button.classList.add('bg-red-600', 'hover:bg-red-700');
    } else {
      icon.className = 'fas fa-play';
      button.innerHTML = '<i class="fas fa-play"></i> Iniciar';
      button.classList.remove('bg-red-600', 'hover:bg-red-700');
      button.classList.add('bg-green-600', 'hover:bg-green-700');
    }
  }

  updateStatus() {
    const status = document.getElementById('timerStatus');
    
    if (this.isRunning) {
      status.textContent = this.isBreak ? 'Descansando...' : 'Trabajando...';
    } else {
      status.textContent = this.isBreak ? 'Descanso pausado' : 'Listo para comenzar';
    }
  }

  playNotificationSound() {
    // Crear y reproducir sonido de notificación
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.1);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
  }
}

// === GESTOR DE TAREAS ===

class TaskManager {
  constructor() {
    this.tasks = [];
  }

  async addTask(description, priority) {
    const task = {
      description,
      priority,
      completed: false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
      const userId = app.currentUser.uid;
      const docRef = await db.collection('users').doc(userId).collection('tasks').add(task);
      
      task.id = docRef.id;
      app.appState.tasks.push(task);
      
      this.sortTasks();
      
      console.log('✅ Tarea agregada:', description);
    } catch (error) {
      console.error('Error agregando tarea:', error);
      throw error;
    }
  }

  async toggleTask(taskId) {
    try {
      const taskIndex = app.appState.tasks.findIndex(t => t.id === taskId);
      if (taskIndex === -1) return;
      
      const task = app.appState.tasks[taskIndex];
      const newCompleted = !task.completed;
      
      // Actualizar en Firestore
      const userId = app.currentUser.uid;
      await db.collection('users').doc(userId).collection('tasks').doc(taskId).update({
        completed: newCompleted,
        completedAt: newCompleted ? firebase.firestore.FieldValue.serverTimestamp() : null
      });
      
      // Actualizar estado local
      task.completed = newCompleted;
      
      // Otorgar puntos si se completó
      if (newCompleted) {
        await app.addPoints(5, 'Tarea completada');
        app.appState.stats.completedTasks++;
        await app.saveUserData();
      }
      
      this.sortTasks();
      this.renderTasks();
      app.renderTasksPreview();
      
      console.log('🔄 Tarea actualizada:', task.description);
    } catch (error) {
      console.error('Error actualizando tarea:', error);
      app.showToast('Error actualizando la tarea', 'error');
    }
  }

  async deleteTask(taskId) {
    try {
      // Eliminar de Firestore
      const userId = app.currentUser.uid;
      await db.collection('users').doc(userId).collection('tasks').doc(taskId).delete();
      
      // Eliminar del estado local
      app.appState.tasks = app.appState.tasks.filter(t => t.id !== taskId);
      
      this.renderTasks();
      app.renderTasksPreview();
      
      app.showToast('Tarea eliminada', 'info');
      console.log('🗑️ Tarea eliminada');
    } catch (error) {
      console.error('Error eliminando tarea:', error);
      app.showToast('Error eliminando la tarea', 'error');
    }
  }

  sortTasks() {
    app.appState.tasks.sort((a, b) => {
      // Primero las pendientes
      if (a.completed !== b.completed) {
        return a.completed ? 1 : -1;
      }
      
      // Luego por prioridad
      const priorityOrder = { alta: 0, media: 1, baja: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  renderTasks() {
    const container = document.getElementById('tasksList');
    const emptyState = document.getElementById('emptyTasks');
    
    if (app.appState.tasks.length === 0) {
      container.classList.add('hidden');
      emptyState.classList.remove('hidden');
      return;
    }
    
    container.classList.remove('hidden');
    emptyState.classList.add('hidden');
    
    container.innerHTML = app.appState.tasks.map(task => `
      <div class="task-item ${task.completed ? 'completed' : ''}" data-task-id="${task.id}">
        <button class="task-checkbox ${task.completed ? 'checked' : ''}" onclick="app.taskManager.toggleTask('${task.id}')">
          ${task.completed ? '<i class="fas fa-check text-white text-sm"></i>' : ''}
        </button>
        
        <div class="flex-1">
          <p class="font-medium ${task.completed ? 'line-through text-gray-400' : ''}">${task.description}</p>
        </div>
        
        <span class="px-2 py-1 text-xs rounded-full border priority-${task.priority}">
          ${task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
        </span>
        
        <button onclick="app.taskManager.deleteTask('${task.id}')" class="text-gray-400 hover:text-red-400 transition-colors">
          <i class="fas fa-trash text-sm"></i>
        </button>
      </div>
    `).join('');
  }
}

// === GESTOR DE FLASHCARDS ===

class FlashcardManager {
  constructor() {
    this.decks = [];
    this.currentDeck = null;
    this.currentCards = [];
    this.currentCardIndex = 0;
    this.isStudying = false;
  }

  async createDeck(name, description = '') {
    const deck = {
      name,
      description,
      cards: [],
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      lastStudiedAt: null
    };

    try {
      const userId = app.currentUser.uid;
      const docRef = await db.collection('users').doc(userId).collection('decks').add(deck);
      
      deck.id = docRef.id;
      app.appState.decks.push(deck);
      
      console.log('📚 Deck creado:', name);
    } catch (error) {
      console.error('Error creando deck:', error);
      throw error;
    }
  }

  async addCard(deckId, question, answer, questionImageFile = null, answerImageFile = null) {
    try {
      // Subir imágenes si existen
      let questionImageUrl = null;
      let answerImageUrl = null;
      
      if (questionImageFile) {
        questionImageUrl = await this.uploadImage(questionImageFile, `cards/${deckId}/questions`);
      }
      
      if (answerImageFile) {
        answerImageUrl = await this.uploadImage(answerImageFile, `cards/${deckId}/answers`);
      }
      
      const card = {
        question,
        answer,
        questionImage: questionImageUrl,
        answerImage: answerImageUrl,
        reviewData: {
          easeFactor: 2.5,
          interval: 1,
          repetitions: 0,
          nextReviewDate: new Date()
        },
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      };

      // Agregar a la colección de cartas del deck
      const userId = app.currentUser.uid;
      const cardRef = await db.collection('users').doc(userId)
        .collection('decks').doc(deckId)
        .collection('cards').add(card);
      
      card.id = cardRef.id;
      
      // Actualizar deck local
      const deck = app.appState.decks.find(d => d.id === deckId);
      if (deck) {
        if (!deck.cards) deck.cards = [];
        deck.cards.push(card);
      }
      
      console.log('🃏 Carta agregada al deck:', deckId);
    } catch (error) {
      console.error('Error agregando carta:', error);
      throw error;
    }
  }

  async uploadImage(file, path) {
    // Implementación básica de subida de imagen
    // En producción, usarías Firebase Storage
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.readAsDataURL(file);
    });
  }

  async startStudySession(deckId) {
    try {
      const deck = app.appState.decks.find(d => d.id === deckId);
      if (!deck || !deck.cards || deck.cards.length === 0) {
        app.showToast('Este tema no tiene cartas para estudiar', 'warning');
        return;
      }

      this.currentDeck = deck;
      this.currentCards = this.getCardsForReview(deck.cards);
      this.currentCardIndex = 0;
      this.isStudying = true;

      if (this.currentCards.length === 0) {
        app.showToast('No hay cartas programadas para revisión hoy', 'info');
        return;
      }

      this.showStudyModal();
      this.loadCurrentCard();
      
      console.log(`📖 Iniciando estudio de "${deck.name}" - ${this.currentCards.length} cartas`);
    } catch (error) {
      console.error('Error iniciando sesión de estudio:', error);
      app.showToast('Error iniciando la sesión de estudio', 'error');
    }
  }

  getCardsForReview(cards) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return cards.filter(card => {
      if (!card.reviewData || !card.reviewData.nextReviewDate) return true;
      
      const reviewDate = new Date(card.reviewData.nextReviewDate);
      reviewDate.setHours(0, 0, 0, 0);
      
      return reviewDate <= today;
    });
  }

  showStudyModal() {
    const modal = document.getElementById('studyModal');
    document.getElementById('studyDeckTitle').textContent = `Estudiando: ${this.currentDeck.name}`;
    
    // Configurar controles
    document.getElementById('flipCardBtn').onclick = () => this.flipCard();
    document.getElementById('difficultyHard').onclick = () => this.rateCard(1);
    document.getElementById('difficultyMedium').onclick = () => this.rateCard(3);
    document.getElementById('difficultyEasy').onclick = () => this.rateCard(5);
    
    app.openModal('studyModal');
  }

  loadCurrentCard() {
    if (this.currentCardIndex >= this.currentCards.length) {
      this.completeStudySession();
      return;
    }

    const card = this.currentCards[this.currentCardIndex];
    
    // Resetear carta
    document.getElementById('flashcardInner').style.transform = '';
    document.getElementById('flipCardBtn').classList.remove('hidden');
    document.getElementById('studyControls').classList.add('hidden');
    
    // Cargar contenido
    document.getElementById('studyQuestionText').textContent = card.question;
    document.getElementById('studyAnswerText').textContent = card.answer;
    
    // Cargar imágenes
    this.loadCardImage('studyQuestionImage', card.questionImage);
    this.loadCardImage('studyAnswerImage', card.answerImage);
    
    // Actualizar progreso
    document.getElementById('cardProgress').textContent = this.currentCardIndex + 1;
    document.getElementById('totalCards').textContent = this.currentCards.length;
  }

  loadCardImage(containerId, imageUrl) {
    const container = document.getElementById(containerId);
    if (imageUrl) {
      container.classList.remove('hidden');
      container.querySelector('img').src = imageUrl;
    } else {
      container.classList.add('hidden');
    }
  }

  flipCard() {
    const flashcard = document.querySelector('.flashcard');
    flashcard.classList.add('flipped');
    
    document.getElementById('flipCardBtn').classList.add('hidden');
    document.getElementById('studyControls').classList.remove('hidden');
  }

  async rateCard(quality) {
    const card = this.currentCards[this.currentCardIndex];
    
    // Algoritmo de repetición espaciada (SM-2)
    this.updateCardReviewData(card, quality);
    
    // Guardar en Firestore
    await this.saveCardReviewData(card);
    
    // Avanzar a la siguiente carta
    this.currentCardIndex++;
    
    // Resetear vista
    document.querySelector('.flashcard').classList.remove('flipped');
    
    // Cargar siguiente carta después de una pausa
    setTimeout(() => {
      this.loadCurrentCard();
    }, 300);
    
    // Otorgar puntos
    const points = quality >= 4 ? 15 : quality >= 3 ? 10 : 5;
    await app.addPoints(points, `Carta ${quality >= 4 ? 'fácil' : quality >= 3 ? 'normal' : 'difícil'}`);
  }

  updateCardReviewData(card, quality) {
    const reviewData = card.reviewData;
    
    if (quality >= 3) {
      if (reviewData.repetitions === 0) {
        reviewData.interval = 1;
      } else if (reviewData.repetitions === 1) {
        reviewData.interval = 6;
      } else {
        reviewData.interval = Math.round(reviewData.interval * reviewData.easeFactor);
      }
      reviewData.repetitions++;
    } else {
      reviewData.repetitions = 0;
      reviewData.interval = 1;
    }
    
    reviewData.easeFactor = Math.max(1.3, 
      reviewData.easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
    );
    
    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + reviewData.interval);
    reviewData.nextReviewDate = nextReview;
  }

  async saveCardReviewData(card) {
    try {
      const userId = app.currentUser.uid;
      await db.collection('users').doc(userId)
        .collection('decks').doc(this.currentDeck.id)
        .collection('cards').doc(card.id)
        .update({
          reviewData: card.reviewData,
          lastReviewedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (error) {
      console.error('Error guardando datos de revisión:', error);
    }
  }

  async completeStudySession() {
    this.isStudying = false;
    
    // Actualizar último estudio del deck
    const userId = app.currentUser.uid;
    await db.collection('users').doc(userId)
      .collection('decks').doc(this.currentDeck.id)
      .update({
        lastStudiedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    
    app.closeModal('studyModal');
    app.showToast(`¡Sesión de estudio completada! ${this.currentCards.length} cartas revisadas`, 'success');
    
    // Actualizar estadísticas
    app.appState.stats.totalStudyTime += this.currentCards.length * 2; // ~2 min por carta
    await app.saveUserData();
    
    console.log('✅ Sesión de estudio completada');
  }

  renderDecks() {
    const container = document.getElementById('decksList');
    
    if (app.appState.decks.length === 0) {
      container.innerHTML = `
        <div class="col-span-full text-center py-12 text-gray-400">
          <i class="fas fa-cards-blank text-6xl mb-4 opacity-50"></i>
          <p>No tienes temas de estudio</p>
          <p class="text-sm">¡Crea tu primer tema para empezar!</p>
        </div>
      `;
      return;
    }
    
    container.innerHTML = app.appState.decks.map(deck => {
      const cardCount = deck.cards ? deck.cards.length : 0;
      const mastery = app.calculateDeckMastery(deck);
      const dueCards = this.getCardsForReview(deck.cards || []).length;
      
      return `
        <div class="deck-card">
          <div class="flex justify-between items-start mb-4">
            <h3 class="text-xl font-bold">${deck.name}</h3>
            <div class="flex gap-2">
              <button onclick="app.flashcardManager.startStudySession('${deck.id}')" 
                      class="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm transition-colors">
                <i class="fas fa-play mr-1"></i>
                Estudiar
              </button>
              <button onclick="app.flashcardManager.openAddCardModal('${deck.id}')" 
                      class="px-3 py-1 bg-green-600 hover:bg-green-700 rounded-lg text-sm transition-colors">
                <i class="fas fa-plus mr-1"></i>
                Carta
              </button>
            </div>
          </div>
          
          ${deck.description ? `<p class="text-gray-400 text-sm mb-4">${deck.description}</p>` : ''}
          
          <div class="space-y-3">
            <div class="flex justify-between text-sm">
              <span class="text-gray-400">Cartas totales</span>
              <span>${cardCount}</span>
            </div>
            
            <div class="flex justify-between text-sm">
              <span class="text-gray-400">Para revisar</span>
              <span class="text-orange-400">${dueCards}</span>
            </div>
            
            <div class="flex justify-between text-sm">
              <span class="text-gray-400">Dominio</span>
              <span class="text-green-400">${mastery}%</span>
            </div>
            
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${mastery}%"></div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  openAddCardModal(deckId) {
    document.getElementById('addCardModal').dataset.deckId = deckId;
    app.openModal('addCardModal');
  }
}

// === GESTOR DE QUIZ ===

class QuizManager {
  constructor() {
    this.currentQuiz = null;
    this.questions = [];
    this.currentQuestionIndex = 0;
    this.score = 0;
    this.correctAnswers = 0;
  }

  renderQuizSelector() {
    const container = document.getElementById('quizDecksList');
    
    const availableDecks = app.appState.decks.filter(deck => 
      deck.cards && deck.cards.length >= 4
    );
    
    if (availableDecks.length === 0) {
      container.innerHTML = `
        <div class="col-span-full text-center py-8 text-gray-400">
          <i class="fas fa-brain text-4xl mb-4 opacity-50"></i>
          <p>Necesitas al menos 4 cartas en un tema para hacer quiz</p>
        </div>
      `;
      return;
    }
    
    container.innerHTML = availableDecks.map(deck => `
      <button onclick="app.quizManager.startQuiz('${deck.id}')" 
              class="p-6 bg-gray-800 rounded-xl border border-gray-700 hover:border-blue-500 transition-all duration-300 text-left">
        <h3 class="text-lg font-bold mb-2">${deck.name}</h3>
        <p class="text-gray-400 text-sm mb-3">${deck.cards.length} cartas disponibles</p>
        <div class="flex items-center text-blue-400">
          <i class="fas fa-play mr-2"></i>
          Iniciar Quiz
        </div>
      </button>
    `).join('');
  }

  async startQuiz(deckId) {
    const deck = app.appState.decks.find(d => d.id === deckId);
    if (!deck || !deck.cards || deck.cards.length < 4) {
      app.showToast('Este tema no tiene suficientes cartas para un quiz', 'warning');
      return;
    }

    this.currentQuiz = deck;
    this.generateQuestions(deck.cards);
    this.currentQuestionIndex = 0;
    this.score = 0;
    this.correctAnswers = 0;

    this.showQuizGame();
    this.loadCurrentQuestion();
    
    console.log(`🧠 Quiz iniciado para "${deck.name}"`);
  }

  generateQuestions(cards) {
    // Tomar 10 cartas aleatorias (o todas si hay menos de 10)
    const shuffledCards = [...cards].sort(() => Math.random() - 0.5);
    const selectedCards = shuffledCards.slice(0, Math.min(10, cards.length));
    
    this.questions = selectedCards.map(card => {
      // Generar opciones incorrectas
      const incorrectOptions = this.generateIncorrectOptions(card, cards);
      
      // Combinar con la respuesta correcta
      const allOptions = [card.answer, ...incorrectOptions].sort(() => Math.random() - 0.5);
      
      return {
        question: card.question,
        questionImage: card.questionImage,
        options: allOptions,
        correctAnswer: card.answer,
        answered: false,
        selectedAnswer: null
      };
    });
  }

  generateIncorrectOptions(correctCard, allCards) {
    const otherCards = allCards.filter(card => card.id !== correctCard.id);
    const shuffled = otherCards.sort(() => Math.random() - 0.5);
    
    return shuffled.slice(0, 3).map(card => card.answer);
  }

  showQuizGame() {
    document.getElementById('quizSelector').classList.add('hidden');
    document.getElementById('quizGame').classList.remove('hidden');
    document.getElementById('quizResults').classList.add('hidden');
    
    document.getElementById('totalQuestions').textContent = this.questions.length;
    document.getElementById('quizPoints').textContent = this.score;
  }

  loadCurrentQuestion() {
    if (this.currentQuestionIndex >= this.questions.length) {
      this.showQuizResults();
      return;
    }

    const question = this.questions[this.currentQuestionIndex];
    
    document.getElementById('questionNumber').textContent = this.currentQuestionIndex + 1;
    document.getElementById('questionText').textContent = question.question;
    
    // Cargar imagen si existe
    const imageContainer = document.getElementById('questionImage');
    if (question.questionImage) {
      imageContainer.classList.remove('hidden');
      imageContainer.querySelector('img').src = question.questionImage;
    } else {
      imageContainer.classList.add('hidden');
    }
    
    // Cargar opciones
    const container = document.getElementById('answersContainer');
    container.innerHTML = question.options.map((option, index) => `
      <button class="answer-option" data-answer="${option}" onclick="app.quizManager.selectAnswer('${option}')">
        ${String.fromCharCode(65 + index)}. ${option}
      </button>
    `).join('');
    
    // Ocultar botón siguiente
    document.getElementById('nextQuestionBtn').classList.add('hidden');
  }

  selectAnswer(selectedAnswer) {
    const question = this.questions[this.currentQuestionIndex];
    if (question.answered) return;
    
    question.answered = true;
    question.selectedAnswer = selectedAnswer;
    
    const isCorrect = selectedAnswer === question.correctAnswer;
    
    // Marcar respuestas
    document.querySelectorAll('.answer-option').forEach(btn => {
      btn.style.pointerEvents = 'none';
      
      const answer = btn.dataset.answer;
      if (answer === question.correctAnswer) {
        btn.classList.add('correct');
      } else if (answer === selectedAnswer && !isCorrect) {
        btn.classList.add('incorrect');
      }
    });
    
    if (isCorrect) {
      this.correctAnswers++;
      this.score += 10;
      document.getElementById('quizPoints').textContent = this.score;
      app.showToast('+10 puntos - ¡Correcto!', 'success');
    }
    
    // Mostrar botón siguiente
    const nextBtn = document.getElementById('nextQuestionBtn');
    nextBtn.classList.remove('hidden');
    nextBtn.onclick = () => this.nextQuestion();
  }

  nextQuestion() {
    this.currentQuestionIndex++;
    
    // Resetear opciones
    document.querySelectorAll('.answer-option').forEach(btn => {
      btn.style.pointerEvents = 'auto';
      btn.classList.remove('selected', 'correct', 'incorrect');
    });
    
    this.loadCurrentQuestion();
  }

  async showQuizResults() {
    const accuracy = Math.round((this.correctAnswers / this.questions.length) * 100);
    
    document.getElementById('quizGame').classList.add('hidden');
    document.getElementById('quizResults').classList.remove('hidden');
    
    document.getElementById('finalScore').textContent = this.score;
    document.getElementById('accuracy').textContent = `${accuracy}%`;
    
    // Otorgar puntos finales
    await app.addPoints(this.score, 'Quiz completado');
    
    // Configurar botón de repetir
    document.getElementById('playAgainBtn').onclick = () => {
      this.startQuiz(this.currentQuiz.id);
    };
    
    app.showToast(`¡Quiz completado! ${this.correctAnswers}/${this.questions.length} correctas`, 'success');
    console.log('🏆 Quiz completado');
  }

  resetQuiz() {
    document.getElementById('quizSelector').classList.remove('hidden');
    document.getElementById('quizGame').classList.add('hidden');
    document.getElementById('quizResults').classList.add('hidden');
    
    this.currentQuiz = null;
    this.questions = [];
    this.currentQuestionIndex = 0;
    this.score = 0;
    this.correctAnswers = 0;
  }
}

// === GESTOR DE ESTADÍSTICAS ===

class StatsManager {
  constructor() {
    this.stats = {
      totalStudyTime: 0,
      currentStreak: 0,
      bestStreak: 0,
      completedTasks: 0,
      totalPoints: 0
    };
  }

  async updateStreak() {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Verificar si estudió ayer o hoy
    const hasStudiedToday = await this.hasStudiedOnDate(today);
    const hasStudiedYesterday = await this.hasStudiedOnDate(yesterday);
    
    if (hasStudiedToday) {
      if (hasStudiedYesterday || this.stats.currentStreak === 0) {
        this.stats.currentStreak++;
      }
    } else if (!hasStudiedYesterday) {
      this.stats.currentStreak = 0;
    }
    
    // Actualizar mejor racha
    if (this.stats.currentStreak > this.stats.bestStreak) {
      this.stats.bestStreak = this.stats.currentStreak;
    }
    
    await app.saveUserData();
  }

  async hasStudiedOnDate(date) {
    try {
      const userId = app.currentUser.uid;
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      
      // Verificar actividad de estudio en ese día
      const activitiesSnapshot = await db.collection('users').doc(userId)
        .collection('studyActivities')
        .where('date', '>=', startOfDay)
        .where('date', '<=', endOfDay)
        .limit(1)
        .get();
      
      return !activitiesSnapshot.empty;
    } catch (error) {
      console.error('Error verificando actividad de estudio:', error);
      return false;
    }
  }

  async recordStudyActivity(type, duration = 0) {
    try {
      const userId = app.currentUser.uid;
      const activity = {
        type, // 'pomodoro', 'flashcards', 'quiz'
        duration,
        date: firebase.firestore.FieldValue.serverTimestamp(),
        points: this.calculateActivityPoints(type, duration)
      };
      
      await db.collection('users').doc(userId)
        .collection('studyActivities')
        .add(activity);
      
      await this.updateStreak();
      
      console.log('📈 Actividad de estudio registrada:', type);
    } catch (error) {
      console.error('Error registrando actividad:', error);
    }
  }

  calculateActivityPoints(type, duration) {
    switch (type) {
      case 'pomodoro':
        return 25;
      case 'flashcards':
        return Math.min(duration * 2, 50); // 2 puntos por minuto, máx 50
      case 'quiz':
        return 10;
      default:
        return 0;
    }
  }
}

// === INICIALIZACIÓN ===

// Variables globales
let app;

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
  app = new FocusDeckApp();
  
  // Hacer disponible globalmente para debugging
  window.app = app;
});

// Función global para cambiar vistas (llamada desde HTML)
function switchView(viewName) {
  if (app) {
    app.switchView(viewName);
  }
}

// Prevenir cierre accidental durante sesiones de estudio
window.addEventListener('beforeunload', (e) => {
  if (app && (app.pomodoroTimer.isRunning || app.flashcardManager.isStudying)) {
    e.preventDefault();
    e.returnValue = '¿Estás seguro de que quieres salir? Tienes una sesión de estudio en curso.';
  }
});

console.log('🎯 Focus Deck cargado y listo para usar');
