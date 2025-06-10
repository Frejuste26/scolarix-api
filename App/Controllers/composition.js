// Importe l'objet 'db' qui contient l'instance Sequelize et tous les modèles
import { db } from '../Models/index.js';
import Validator from '../Middlewares/Validator.js';
// Importe l'instance unique du logger, comme suggéré précédemment
import logger from '../Utils/Logger.js';
import ErrorResponse from '../Utils/errorResponse.js';
import APIFeatures from '../Utils/apiFeatures.js';

class CompositionController {
  constructor() {
    this.model = db.Composition; // Accède au modèle via l'objet 'db'
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
   * @description Crée une nouvelle composition.
   * @param {import('express').Request} request - Objet requête Express.
   * @param {import('express').Response} response - Objet réponse Express.
   * @param {import('express').NextFunction} next - Fonction next du middleware Express.
   */
  async createComposition(request, response, next) {
    try {
      // Valide les données de la requête
      this.validator.validate(request.body, this.validator.compositionCreateSchema);

      // Utilise les noms de champs mis à jour : dateCompo et anneeCode
      const { codeCompo, libelle, dateCompo, typeCompo, anneeCode } = request.body;

      // Crée la nouvelle composition dans la base de données
      const composition = await this.model.create({ codeCompo, libelle, dateCompo, typeCompo, anneeCode });

      // Log l'action
      logger.info('Composition créée avec succès.', { codeCompo, userId: request.auth?.userId });

      // Envoie la réponse
      response.status(201).json({ success: true, data: composition });
    } catch (error) {
      // Gère les erreurs
      this.handleError(error, 'Erreur lors de la création de la composition.', request, next);
    }
  }

  /**
   * @description Récupère toutes les compositions.
   * @param {import('express').Request} request - Objet requête Express.
   * @param {import('express').Response} response - Objet réponse Express.
   * @param {import('express').NextFunction} next - Fonction next du middleware Express.
   */
  async getAll(request, response, next) {
    try {
      const resPerPage = parseInt(process.env.RES_PER_PAGE, 10) || 10;

      // Compte le nombre total de compositions
      const compositionCount = await this.model.count();

      // Applique les fonctionnalités d'API (recherche, filtre, tri, etc.)
      const apiFeatures = new APIFeatures(this.model, request.query, { searchableFields: ['libelle'] })
        .search()
        .filter()
        .sort()
        .limitFields()
        .paginate(resPerPage);

      // Exécute la requête et récupère les compositions
      const compositions = await apiFeatures.execute();

      // Log l'action
      logger.info('Compositions récupérées avec succès.', { userId: request.auth?.userId });

      // Envoie la réponse
      response.status(200).json({
        success: true,
        count: compositions.length, // Nombre d'éléments dans la réponse actuelle
        totalCount: compositionCount, // Nombre total d'éléments disponibles
        resPerPage,
        compositions,
      });
    } catch (error) {
      // Gère les erreurs
      this.handleError(error, 'Erreur lors de la récupération des compositions.', request, next);
    }
  }

  /**
   * @description Récupère une composition par son ID.
   * @param {import('express').Request} request - Objet requête Express.
   * @param {import('express').Response} response - Objet réponse Express.
   * @param {import('express').NextFunction} next - Fonction next du middleware Express.
   */
  async getComposition(request, response, next) {
    try {
      // Recherche la composition par sa clé primaire (ID)
      const composition = await this.model.findByPk(request.params.id);

      // Si non trouvée, renvoie une erreur 404
      if (!composition) {
        return next(new ErrorResponse('Composition non trouvée.', 'NOT_FOUND', 404));
      }

      // Log l'action
      logger.info('Composition récupérée par ID avec succès.', { codeCompo: request.params.id, userId: request.auth?.userId });

      // Envoie la réponse
      response.status(200).json({ success: true, data: composition });
    } catch (error) {
      // Gère les erreurs
      this.handleError(error, 'Erreur lors de la récupération de la composition par ID.', request, next);
    }
  }

  /**
   * @description Met à jour une composition existante.
   * @param {import('express').Request} request - Objet requête Express.
   * @param {import('express').Response} response - Objet réponse Express.
   * @param {import('express').NextFunction} next - Fonction next du middleware Express.
   */
  async updateComposition(request, response, next) {
    try {
      // Valide les données de la requête
      this.validator.validate(request.body, this.validator.compositionUpdateSchema);

      // Recherche la composition à mettre à jour
      const composition = await this.model.findByPk(request.params.id);

      // Si non trouvée, renvoie une erreur 404
      if (!composition) {
        return next(new ErrorResponse('Composition non trouvée pour la mise à jour.', 'NOT_FOUND', 404));
      }

      // Utilise les noms de champs mis à jour : dateCompo et anneeCode
      const { libelle, dateCompo, typeCompo, anneeCode } = request.body;

      // Met à jour la composition
      await composition.update({ libelle, dateCompo, typeCompo, anneeCode });

      // Log l'action
      logger.info('Composition mise à jour avec succès.', { codeCompo: request.params.id, userId: request.auth?.userId });

      // Envoie la réponse
      response.status(200).json({ success: true, data: composition });
    } catch (error) {
      // Gère les erreurs
      this.handleError(error, 'Erreur lors de la mise à jour de la composition.', request, next);
    }
  }

  /**
   * @description Supprime une composition.
   * @param {import('express').Request} request - Objet requête Express.
   * @param {import('express').Response} response - Objet réponse Express.
   * @param {import('express').NextFunction} next - Fonction next du middleware Express.
   */
  async deleteComposition(request, response, next) {
    try {
      // Recherche la composition à supprimer
      const composition = await this.model.findByPk(request.params.id);

      // Si non trouvée, renvoie une erreur 404
      if (!composition) {
        return next(new ErrorResponse('Composition non trouvée pour la suppression.', 'NOT_FOUND', 404));
      }

      // Supprime la composition
      await composition.destroy();

      // Log l'action
      logger.info('Composition supprimée avec succès.', { codeCompo: request.params.id, userId: request.auth?.userId });

      // Envoie une réponse vide pour indiquer la suppression réussie
      response.status(200).json({ success: true, data: {} });
    } catch (error) {
      // Gère les erreurs
      this.handleError(error, 'Erreur lors de la suppression de la composition.', request, next);
    }
  }
}

export default CompositionController;
