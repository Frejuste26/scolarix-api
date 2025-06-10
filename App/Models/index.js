import { Sequelize } from 'sequelize'; // Importe Sequelize pour les vérifications de type
import Database from '../Configs/database.js'; // Importe votre classe de configuration de base de données
import logger from '../Utils/Logger.js';     // Importe votre Logger
import ErrorResponse from '../Utils/errorResponse.js'; // Importe votre classe d'erreur personnalisée

// Importe tous vos modèles
import AnneeScolaire from './anneeScolaire.js';
import Classe from './Classe.js';
import Composition from './Composition.js';
import Ecole from './Ecole.js';
import Eleve from './Eleve.js';
import Evaluation from './Evaluation.js';
import Moyenne from './Moyenne.js';
import Note from './Note.js';
import Resultat from './Resultat.js';
import User from './User.js';


// Cet objet contiendra l'instance Sequelize et toutes les classes de modèles initialisées.
// Il sera exporté pour être utilisé dans le reste de l'application.
const db = {};

/**
 * Initialise la connexion à la base de données et charge tous les modèles Sequelize.
 * Cette fonction doit être appelée une seule fois au démarrage de l'application.
 * @returns {Promise<Object>} Un objet contenant l'instance Sequelize et les modèles initialisés.
 * @throws {ErrorResponse} Si l'initialisation de la base de données ou des modèles échoue.
 */
async function initializeModels() {
  try {
    // 1. Initialise la connexion à la base de données via votre classe Database
    const sequelize = await Database.start();
    db.sequelize = sequelize; // Stocke l'instance Sequelize connectée

    // 2. Stocke toutes les classes de modèles dans l'objet 'db'.
    // C'est ici que nous stockons les CLASSES de modèles, pas le résultat de leur initialisation.
    db.AnneeScolaire = AnneeScolaire;
    db.Classe = Classe;
    db.Composition = Composition;
    db.Ecole = Ecole;
    db.Eleve = Eleve;
    db.Evaluation = Evaluation;
    db.Moyenne = Moyenne;
    db.Note = Note;
    db.Resultat = Resultat;
    db.User = User;

    // 3. Appelle la méthode `init()` sur chaque classe de modèle.
    // Cela configure le modèle avec l'instance Sequelize et ses attributs.
    Object.values(db).forEach(model => {
      // Vérifie si l'élément est bien une classe qui hérite de Sequelize.Model et a une méthode init statique
      if (model.prototype instanceof Sequelize.Model && typeof model.init === 'function') {
        model.init(sequelize);
        logger.info(`Modèle ${model.name} initialisé.`);
      }
    });

    // 4. Définit les associations entre les modèles.
    // Cette étape doit être faite APRÈS que TOUS les modèles aient été initialisés,
    // car les associations peuvent faire référence à d'autres modèles.
    Object.values(db).forEach(model => {
      // Vérifie si l'élément est bien une classe qui hérite de Sequelize.Model et a une méthode associate statique
      if (model.prototype instanceof Sequelize.Model && typeof model.associate === 'function') {
        model.associate(db); // Passe l'objet 'db' complet (contenant tous les modèles) pour les associations
        logger.info(`Associations configurées pour le modèle ${model.name}.`);
      }
    });

    logger.info('✅ Tous les modèles Sequelize ont été initialisés et associés avec succès.');
    return db; // Retourne l'objet 'db' contenant l'instance Sequelize et tous les modèles
  } catch (error) {
    logger.error('❌ Erreur lors de l\'initialisation des modèles Sequelize:', {
      message: error.message,
      stack: error.stack,
      details: error.details || 'Aucun détail supplémentaire.'
    });
    // Utilise ErrorResponse pour une gestion d'erreur cohérente
    throw new ErrorResponse('Échec de l\'initialisation des modèles de base de données.', 500, {
      code: 'MODEL_INIT_ERROR',
      details: error.message,
      originalStack: error.stack
    });
  }
}

// Exporte la fonction d'initialisation et l'objet 'db' (qui sera rempli après l'appel à initializeModels).
// Exporter la fonction permet de contrôler quand l'initialisation se produit.
export { initializeModels, db };
