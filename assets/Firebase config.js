// Focus Deck - Configuración de Firebase


const firebaseConfig = {
  apiKey: "AIzaSyC6tqffatZ7NhMm5bGRh0kmjCLymj0DD74",
  authDomain: "focus-deck.firebaseapp.com",
  projectId: "focus-deck",
  storageBucket: "focus-deck.firebasestorage.app",
  messagingSenderId: "81821453657",
  appId: "1:81821453657:web:deb38c2d4b00113bec9048"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);

// Inicializar servicios
const auth = firebase.auth();
const db = firebase.firestore();

// Configurar proveedor de Google
const googleProvider = new firebase.auth.GoogleAuthProvider();
googleProvider.addScope('profile');
googleProvider.addScope('email');

// Configurar Firestore (opcional: configuraciones adicionales)
db.enablePersistence()
  .catch((err) => {
    if (err.code == 'failed-precondition') {
      console.warn('Persistencia offline no disponible: múltiples pestañas abiertas');
    } else if (err.code == 'unimplemented') {
      console.warn('Persistencia offline no soportada por este navegador');
    }
  });

// Exportar para uso global
window.auth = auth;
window.db = db;
window.googleProvider = googleProvider;

console.log('🔥 Firebase inicializado correctamente');