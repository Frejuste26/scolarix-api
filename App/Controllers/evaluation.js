// Importe l'objet 'db' qui contient l'instance Sequelize et tous les modèles
import { db } from '../Models/index.js';
import Validator from '../Middlewares/validator.js'; // Changed Validator.js to validator.js
// Importe l'instance unique du logger, comme suggéré précédemment
import logger from '../Utils/Logger.js';
import ErrorResponse from '../Utils/errorResponse.js';
import APIFeatures from '../Utils/apiFeatures.js';

class EvaluationController {
  constructor() {
    this.model = db.Evaluation; // Accède au modèle via l'objet 'db'
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
   * @description Crée une nouvelle évaluation.
   * @param {import('express').Request} request - Objet requête Express.
   * @param {import('express').Response} response - Objet réponse Express.
   * @param {import('express').NextFunction} next - Fonction next du middleware Express.
   */
  async createEvaluation(request, response, next) {
    try {
      // Valide les données de la requête
      this.validator.validate(request.body, this.validator.evaluationCreateSchema);

      // Les noms de champs (codeEva, nameEva, coeficient) correspondent aux attributs du modèle
      const { codeEva, nameEva, coeficient } = request.body;

      // Crée la nouvelle évaluation dans la base de données
      const evaluation = await this.model.create({ codeEva, nameEva, coeficient });

      // Log l'action
      logger.info('Évaluation créée avec succès.', { codeEva, userId: request.auth?.userId });

      // Envoie la réponse
      response.status(201).json({ success: true, data: evaluation });
    } catch (error) {
      // Gère les erreurs
      this.handleError(error, 'Erreur lors de la création de l\'évaluation.', request, next);
    }
  }

  /**
   * @description Récupère toutes les évaluations.
   * @param {import('express').Request} request - Objet requête Express.
   * @param {import('express').Response} response - Objet réponse Express.
   * @param {import('express').NextFunction} next - Fonction next du middleware Express.
   */
  async getAll(request, response, next) {
    try {
      const resPerPage = parseInt(process.env.RES_PER_PAGE, 10) || 10;

      // Compte le nombre total d'évaluations
      const evaluationCount = await this.model.count();

      // Applique les fonctionnalités d'API (recherche, filtre, tri, etc.)
      const apiFeatures = new APIFeatures(this.model, request.query, { searchableFields: ['nameEva'] })
        .search()
        .filter()
        .sort()
        .limitFields()
        .paginate(resPerPage);

      // Exécute la requête et récupère les évaluations
      const evaluations = await apiFeatures.execute();

      // Log l'action
      logger.info('Évaluations récupérées avec succès.', { userId: request.auth?.userId });

      // Envoie la réponse
      response.status(200).json({
        success: true,
        count: evaluations.length, // Nombre d'éléments dans la réponse actuelle
        totalCount: evaluationCount, // Nombre total d'éléments disponibles
        resPerPage,
        evaluations,
      });
    } catch (error) {
      // Gère les erreurs
      this.handleError(error, 'Erreur lors de la récupération des évaluations.', request, next);
    }
  }

  /**
   * @description Récupère une évaluation par son ID.
   * @param {import('express').Request} request - Objet requête Express.
   * @param {import('express').Response} response - Objet réponse Express.
   * @param {import('express').NextFunction} next - Fonction next du middleware Express.
   */
  async getEvaluation(request, response, next) {
    try {
      // Recherche l'évaluation par sa clé primaire (ID)
      const evaluation = await this.model.findByPk(request.params.id);

      // Si non trouvée, renvoie une erreur 404
      if (!evaluation) {
        return next(new ErrorResponse('Évaluation non trouvée.', 'NOT_FOUND', 404));
      }

      // Log l'action
      logger.info('Évaluation récupérée par ID avec succès.', { codeEva: request.params.id, userId: request.auth?.userId });

      // Envoie la réponse
      response.status(200).json({ success: true, data: evaluation });
    } catch (error) {
      // Gère les erreurs
      this.handleError(error, 'Erreur lors de la récupération de l\'évaluation par ID.', request, next);
    }
  }

  /**
   * @description Met à jour une évaluation existante.
   * @param {import('express').Request} request - Objet requête Express.
   * @param {import('express').Response} response - Objet réponse Express.
   * @param {import('express').NextFunction} next - Fonction next du middleware Express.
   */
  async updateEvaluation(request, response, next) {
    try {
      // Valide les données de la requête
      this.validator.validate(request.body, this.validator.evaluationUpdateSchema);

      // Recherche l'évaluation à mettre à jour
      const evaluation = await this.model.findByPk(request.params.id);

      // Si non trouvée, renvoie une erreur 404
      if (!evaluation) {
        return next(new ErrorResponse('Évaluation non trouvée pour la mise à jour.', 'NOT_FOUND', 404));
      }

      // Les noms de champs (nameEva, coeficient) correspondent aux attributs du modèle
      const { nameEva, coeficient } = request.body;

      // Met à jour l'évaluation
      await evaluation.update({ nameEva, coeficient });

      // Log l'action
      logger.info('Évaluation mise à jour avec succès.', { codeEva: request.params.id, userId: request.auth?.userId });

      // Envoie la réponse
      response.status(200).json({ success: true, data: evaluation });
    } catch (error) {
      // Gère les erreurs
      this.handleError(error, 'Erreur lors de la mise à jour de l\'évaluation.', request, next);
    }
  }

  /**
   * @description Supprime une évaluation.
   * @param {import('express').Request} request - Objet requête Express.
   * @param {import('express').Response} response - Objet réponse Express.
   * @param {import('express').NextFunction} next - Fonction next du middleware Express.
   */
  async deleteEvaluation(request, response, next) {
    try {
      // Recherche l'évaluation à supprimer
      const evaluation = await this.model.findByPk(request.params.id);

      // Si non trouvée, renvoie une erreur 404
      if (!evaluation) {
        return next(new ErrorResponse('Évaluation non trouvée pour la suppression.', 'NOT_FOUND', 404));
      }

      // Supprime l'évaluation
      await evaluation.destroy();

      // Log l'action
      logger.info('Évaluation supprimée avec succès.', { codeEva: request.params.id, userId: request.auth?.userId });

      // Envoie une réponse vide pour indiquer la suppression réussie
      response.status(200).json({ success: true, data: {} });
    } catch (error) {
      // Gère les erreurs
      this.handleError(error, 'Erreur lors de la suppression de l\'évaluation.', request, next);
    }
  }
}

export default EvaluationController;
