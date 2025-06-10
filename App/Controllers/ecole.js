// Importe l'objet 'db' qui contient l'instance Sequelize et tous les modèles
import { db } from '../Models/index.js';
import Validator from '../Middlewares/validator.js'; // Changed Validator.js to validator.js
// Importe l'instance unique du logger, comme suggéré précédemment
import logger from '../Utils/Logger.js';
import ErrorResponse from '../Utils/errorResponse.js';
import APIFeatures from '../Utils/apiFeatures.js';

class EcoleController {
  constructor() {
    this.model = db.Ecole; // Accède au modèle via l'objet 'db'
    this.validator = Validator;
    // this.logger n'est plus nécessaire car nous importons l'instance unique 'logger' directement
  }

  /**
   * Méthode générique pour gérer les erreurs de manière centralisée.
   * Elle log l'erreur et la passe au prochain middleware de gestion d'erreurs.
   * @param {Error} error - L'objet erreur capturé.
   * @param {string} message - Un message descriptif de l'erreur pour le log et la réponse.
   * @param {import('express').Request} request - L'objet requête Express pour accéder aux informations de l'utilisateur.
   * @param {import('express').NextFunction} next - La fonction next d'Express pour passer l'erreur.
   */
  handleError(error, message, request, next) {
    // Log l'erreur avec le message et des détails supplémentaires, y compris l'ID utilisateur si disponible.
    logger.error(message, {
      error: error.message,
      stack: error.stack,
      userId: request.auth?.userId, // Utilise l'opérateur de chaînage optionnel pour éviter les erreurs si request.auth est undefined
      originalError: error instanceof ErrorResponse ? error.details : undefined // Ajoute les détails de l'ErrorResponse si c'est une instance
    });

    // Si l'erreur est déjà une instance de ErrorResponse, la passe directement au middleware suivant.
    if (error instanceof ErrorResponse) {
      return next(error);
    }

    // Pour toutes les autres erreurs, crée une nouvelle ErrorResponse générique et la passe.
    next(new ErrorResponse(message, 'SERVER_ERROR', 500));
  }

  /**
   * @description Récupère toutes les écoles avec des options de recherche, filtrage, tri et pagination.
   * @param {import('express').Request} request - Objet requête Express.
   * @param {import('express').Response} response - Objet réponse Express.
   * @param {import('express').NextFunction} next - Fonction next du middleware Express.
   */
  async getAll(request, response, next) {
    try {
      const resPerPage = parseInt(process.env.RES_PER_PAGE, 10) || 10;

      // Compte le nombre total d'écoles
      const ecoleCount = await this.model.count();

      // Applique les fonctionnalités d'API (recherche, filtre, tri, etc.)
      const apiFeatures = new APIFeatures(this.model, request.query, { searchableFields: ['ecoleName', 'ville'] }) // Ajout de 'ville' aux champs recherchables
        .search()
        .filter()
        .sort()
        .limitFields()
        .paginate(resPerPage);

      // Exécute la requête et récupère les écoles
      const ecoles = await apiFeatures.execute();

      // Log l'action
      logger.info('Écoles récupérées avec succès.', { userId: request.auth?.userId });

      // Envoie la réponse
      response.status(200).json({
        success: true,
        count: ecoles.length, // Nombre d'éléments dans la réponse actuelle
        totalCount: ecoleCount, // Nombre total d'éléments disponibles
        resPerPage,
        ecoles,
      });
    } catch (error) {
      // Gère les erreurs
      this.handleError(error, 'Erreur lors de la récupération des écoles.', request, next);
    }
  }

  /**
   * @description Crée une nouvelle école.
   * @param {import('express').Request} request - Objet requête Express.
   * @param {import('express').Response} response - Objet réponse Express.
   * @param {import('express').NextFunction} next - Fonction next du middleware Express.
   */
  async createEcole(request, response, next) {
    try {
      // Valide les données de la requête
      this.validator.validate(request.body, this.validator.ecoleCreateSchema);

      // Les noms de champs (ecoleId, ecoleName, iep, ville) correspondent aux attributs du modèle
      const { ecoleId, ecoleName, iep, ville } = request.body;

      // Crée la nouvelle école dans la base de données
      const ecole = await this.model.create({ ecoleId, ecoleName, iep, ville });

      // Log l'action
      logger.info('École créée avec succès.', { ecoleId, userId: request.auth?.userId });

      // Envoie la réponse
      response.status(201).json({ success: true, data: ecole });
    } catch (error) {
      // Gère les erreurs
      this.handleError(error, 'Erreur lors de la création de l\'école.', request, next);
    }
  }

  /**
   * @description Récupère une école par son ID.
   * @param {import('express').Request} request - Objet requête Express.
   * @param {import('express').Response} response - Objet réponse Express.
   * @param {import('express').NextFunction} next - Fonction next du middleware Express.
   */
  async getEcole(request, response, next) {
    try {
      // Recherche l'école par sa clé primaire (ID)
      const ecole = await this.model.findByPk(request.params.id);

      // Si non trouvée, renvoie une erreur 404
      if (!ecole) {
        return next(new ErrorResponse('École non trouvée.', 'NOT_FOUND', 404));
      }

      // Log l'action
      logger.info('École récupérée par ID avec succès.', { ecoleId: request.params.id, userId: request.auth?.userId });

      // Envoie la réponse
      response.status(200).json({ success: true, data: ecole });
    } catch (error) {
      // Gère les erreurs
      this.handleError(error, 'Erreur lors de la récupération de l\'école par ID.', request, next);
    }
  }

  /**
   * @description Met à jour une école existante.
   * @param {import('express').Request} request - Objet requête Express.
   * @param {import('express').Response} response - Objet réponse Express.
   * @param {import('express').NextFunction} next - Fonction next du middleware Express.
   */
  async updateEcole(request, response, next) {
    try {
      // Valide les données de la requête
      this.validator.validate(request.body, this.validator.ecoleUpdateSchema);

      // Recherche l'école à mettre à jour
      const ecole = await this.model.findByPk(request.params.id);

      // Si non trouvée, renvoie une erreur 404
      if (!ecole) {
        return next(new ErrorResponse('École non trouvée pour la mise à jour.', 'NOT_FOUND', 404));
      }

      // Les noms de champs (ecoleName, iep, ville) correspondent aux attributs du modèle
      const { ecoleName, iep, ville } = request.body;

      // Met à jour l'école
      await ecole.update({ ecoleName, iep, ville });

      // Log l'action
      logger.info('École mise à jour avec succès.', { ecoleId: request.params.id, userId: request.auth?.userId });

      // Envoie la réponse
      response.status(200).json({ success: true, data: ecole });
    } catch (error) {
      // Gère les erreurs
      this.handleError(error, 'Erreur lors de la mise à jour de l\'école.', request, next);
    }
  }

  /**
   * @description Supprime une école.
   * @param {import('express').Request} request - Objet requête Express.
   * @param {import('express').Response} response - Objet réponse Express.
   * @param {import('express').NextFunction} next - Fonction next du middleware Express.
   */
  async deleteEcole(request, response, next) {
    try {
      // Recherche l'école à supprimer
      const ecole = await this.model.findByPk(request.params.id);

      // Si non trouvée, renvoie une erreur 404
      if (!ecole) {
        return next(new ErrorResponse('École non trouvée pour la suppression.', 'NOT_FOUND', 404));
      }

      // Supprime l'école
      await ecole.destroy();

      // Log l'action
      logger.info('École supprimée avec succès.', { ecoleId: request.params.id, userId: request.auth?.userId });

      // Envoie une réponse vide pour indiquer la suppression réussie (cohérent avec les autres contrôleurs)
      response.status(200).json({ success: true, data: {} });
    } catch (error) {
      // Gère les erreurs
      this.handleError(error, 'Erreur lors de la suppression de l\'école.', request, next);
    }
  }
}

export default EcoleController;
