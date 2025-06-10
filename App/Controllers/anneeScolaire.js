// Importe l'objet 'db' qui contient l'instance Sequelize et tous les modèles
import { db } from "../Models/index.js";
import Validator from "../Middlewares/Validator.js";
// Importe l'instance unique du logger, comme suggéré précédemment
import logger from '../Utils/Logger.js';
import ErrorResponse from '../Utils/errorResponse.js';
import APIFeatures from "../Utils/apiFeatures.js";
class AnneeScolaireController {
  constructor() {
    this.model = db.AnneeScolaire; // Accède au modèle via l'objet 'db'
    this.validator = Validator;
    
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
   * @description Récupère toutes les années scolaires avec des options de recherche, filtrage, tri et pagination.
   * @param {import('express').Request} request - Objet requête Express.
   * @param {import('express').Response} response - Objet réponse Express.
   * @param {import('express').NextFunction} next - Fonction next du middleware Express.
   */
  async getAll(request, response, next) {
    try {
      const resPerPage = parseInt(process.env.RES_PER_PAGE, 10) || 10;

      // Compte le nombre total d'années scolaires pour la pagination
      const anneeCount = await this.model.count();

      // Applique les fonctionnalités d'API (recherche, filtre, tri, etc.)
      const apiFeatures = new APIFeatures(this.model, request.query, { searchableFields: ['annee'] })
        .search()
        .filter()
        .sort()
        .limitFields()
        .paginate(resPerPage);

      // Exécute la requête et récupère les années scolaires
      const annees = await apiFeatures.execute();

      // Log l'action
      logger.info('Années scolaires récupérées avec succès.', { userId: request.auth?.userId });

      // Envoie la réponse
      response.status(200).json({
        success: true,
        count: annees.length, // Nombre d'éléments dans la réponse actuelle
        totalCount: anneeCount, // Nombre total d'éléments disponibles
        resPerPage,
        annees,
      });
    } catch (error) {
      // Gère les erreurs en passant la requête au handleError
      this.handleError(error, 'Erreur lors de la récupération des années scolaires.', request, next);
    }
  }

  /**
   * @description Crée une nouvelle année scolaire.
   * @param {import('express').Request} request - Objet requête Express.
   * @param {import('express').Response} response - Objet réponse Express.
   * @param {import('express').NextFunction} next - Fonction next du middleware Express.
   */
  async createAnneeScolaire(request, response, next) {
    try {
      // Valide les données de la requête
      this.validator.validate(request.body, this.validator.anneeScolaireCreateSchema);

      const { codeAnne, annee } = request.body;

      // Crée la nouvelle année scolaire dans la base de données
      const anneeScolaire = await this.model.create({ codeAnne, annee });

      // Log l'action
      logger.info('Année scolaire créée avec succès.', { codeAnne, userId: request.auth?.userId });

      // Envoie la réponse
      response.status(201).json({ success: true, data: anneeScolaire });
    } catch (error) {
      // Gère les erreurs
      this.handleError(error, 'Erreur lors de la création de l\'année scolaire.', request, next);
    }
  }

  /**
   * @description Récupère une année scolaire par son ID.
   * @param {import('express').Request} request - Objet requête Express.
   * @param {import('express').Response} response - Objet réponse Express.
   * @param {import('express').NextFunction} next - Fonction next du middleware Express.
   */
  async getAnneeScolaire(request, response, next) {
    try {
      // Recherche l'année scolaire par sa clé primaire (ID)
      const anneeScolaire = await this.model.findByPk(request.params.id);

      // Si non trouvée, renvoie une erreur 404
      if (!anneeScolaire) {
        return next(new ErrorResponse('Année scolaire non trouvée.', 'NOT_FOUND', 404));
      }

      // Log l'action
      logger.info('Année scolaire récupérée par ID avec succès.', { codeAnne: request.params.id, userId: request.auth?.userId });

      // Envoie la réponse
      response.status(200).json({ success: true, data: anneeScolaire });
    } catch (error) {
      // Gère les erreurs
      this.handleError(error, 'Erreur lors de la récupération de l\'année scolaire par ID.', request, next);
    }
  }

  /**
   * @description Met à jour une année scolaire existante.
   * @param {import('express').Request} request - Objet requête Express.
   * @param {import('express').Response} response - Objet réponse Express.
   * @param {import('express').NextFunction} next - Fonction next du middleware Express.
   */
  async updateAnneeScolaire(request, response, next) {
    try {
      // Valide les données de la requête
      this.validator.validate(request.body, this.validator.anneeScolaireUpdateSchema);

      // Recherche l'année scolaire à mettre à jour
      const anneeScolaire = await this.model.findByPk(request.params.id);

      // Si non trouvée, renvoie une erreur 404
      if (!anneeScolaire) {
        return next(new ErrorResponse('Année scolaire non trouvée pour la mise à jour.', 'NOT_FOUND', 404));
      }

      const { codeAnne, annee } = request.body;

      // Met à jour l'année scolaire
      await anneeScolaire.update({ codeAnne, annee });

      // Log l'action
      logger.info('Année scolaire mise à jour avec succès.', { codeAnne: request.params.id, userId: request.auth?.userId });

      // Envoie la réponse
      response.status(200).json({ success: true, data: anneeScolaire });
    } catch (error) {
      // Gère les erreurs
      this.handleError(error, 'Erreur lors de la mise à jour de l\'année scolaire.', request, next);
    }
  }

  /**
   * @description Supprime une année scolaire.
   * @param {import('express').Request} request - Objet requête Express.
   * @param {import('express').Response} response - Objet réponse Express.
   * @param {import('express').NextFunction} next - Fonction next du middleware Express.
   */
  async deleteAnneeScolaire(request, response, next) {
    try {
      // Recherche l'année scolaire à supprimer
      const anneeScolaire = await this.model.findByPk(request.params.id);

      // Si non trouvée, renvoie une erreur 404
      if (!anneeScolaire) {
        return next(new ErrorResponse('Année scolaire non trouvée pour la suppression.', 'NOT_FOUND', 404));
      }

      // Supprime l'année scolaire
      await anneeScolaire.destroy();

      // Log l'action
      logger.info('Année scolaire supprimée avec succès.', { codeAnne: request.params.id, userId: request.auth?.userId });

      // Envoie une réponse vide pour indiquer la suppression réussie
      response.status(200).json({ success: true, data: {} });
    } catch (error) {
      // Gère les erreurs
      this.handleError(error, 'Erreur lors de la suppression de l\'année scolaire.', request, next);
    }
  }
}

export default AnneeScolaireController;
