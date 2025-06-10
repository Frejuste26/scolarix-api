import App from "./App/app.js";
import logger from './App/Utils/Logger.js'; // Importe l'instance unique du logger

/**
 * Point d'entrée principal de l'application.
 * Crée une instance de la classe App et lance le serveur.
 */
const appInstance = new App();

// Lance l'application. La méthode Launch() gère l'initialisation de la base de données,
// des modèles et le démarrage du serveur Express (ou du cluster).
appInstance.Launch().catch(error => {
  // En cas d'erreur critique lors du démarrage de l'application,
  // log l'erreur en utilisant le logger global et quitte le processus.
  logger.fatal('Échec du démarrage de l\'application.', {
    error: error.message,
    stack: error.stack,
  });
  process.exit(1); // Quitte le processus avec un code d'erreur
});
