// Importe l'objet 'db' qui contient l'instance Sequelize et tous les modèles
import { db } from '../Models/index.js';
import Validator from '../Middlewares/validator.js'; // Changed Validator.js to validator.js
// Importe l'instance unique du logger, comme suggéré précédemment
import logger from '../Utils/Logger.js';
import ErrorResponse from '../Utils/errorResponse.js';
import APIFeatures from '../Utils/apiFeatures.js';

class ClasseController {
  constructor() {
    this.model = db.Classe; // Accède au modèle via l'objet 'db'
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
   * @description Crée une nouvelle classe.
   * @param {import('express').Request} request - Objet requête Express.
   * @param {import('express').Response} response - Objet réponse Express.
   * @param {import('express').NextFunction} next - Fonction next du middleware Express.
   */
  async createClasse(request, response, next) {
    try {
      // Valide les données de la requête
      this.validator.validate(request.body, this.validator.classeCreateSchema);

      // Utilise les noms de champs mis à jour : anneeCode et ecoleId
      const { classeId, libelle, niveau, anneeCode, ecoleId } = request.body;

      // Crée la nouvelle classe dans la base de données
      const classe = await this.model.create({ classeId, libelle, niveau, anneeCode, ecoleId });

      // Log l'action
      logger.info('Classe créée avec succès.', { classeId, userId: request.auth?.userId });

      // Envoie la réponse
      response.status(201).json({ success: true, data: classe });
    } catch (error) {
      // Gère les erreurs
      this.handleError(error, 'Erreur lors de la création de la classe.', request, next);
    }
  }

  /**
   * @description Récupère toutes les classes, avec filtrage par école pour les enseignants.
   * @param {import('express').Request} request - Objet requête Express.
   * @param {import('express').Response} response - Objet réponse Express.
   * @param {import('express').NextFunction} next - Fonction next du middleware Express.
   */
  async getAll(request, response, next) {
    try {
      const resPerPage = parseInt(process.env.RES_PER_PAGE, 10) || 10;
      let where = {};

      // Si l'utilisateur est un enseignant, filtre les classes par son école
      if (request.auth?.userRole === 'Teacher') {
        // Récupère l'ID de l'école de l'enseignant
        const user = await db.User.findByPk(request.auth.userId);
        if (user && user.ecoleId) { // Assurez-vous que le champ est 'ecoleId'
          where = { ecoleId: user.ecoleId }; // Utilise 'ecoleId' pour le filtre
        } else {
          // Si l'enseignant n'est pas associé à une école, ne renvoie aucune classe ou une erreur
          logger.warn('Enseignant sans école associée tentant de récupérer les classes.', { userId: request.auth?.userId });
          return response.status(200).json({
            success: true,
            count: 0,
            totalCount: 0,
            resPerPage,
            classes: [],
          });
        }
      }

      // Compte le nombre total de classes avec le filtre 'where' appliqué
      const classeCount = await this.model.count({ where });

      // Applique les fonctionnalités d'API (recherche, filtre, tri, etc.)
      const apiFeatures = new APIFeatures(this.model, request.query, { searchableFields: ['libelle'] })
        .search()
        .filter()
        .sort()
        .limitFields()
        .paginate(resPerPage);

      // Fusionne le filtre spécifique au rôle avec les filtres de l'APIFeatures
      apiFeatures.query.where = { ...apiFeatures.query.where, ...where };

      // Exécute la requête et récupère les classes
      const classes = await apiFeatures.execute();

      // Log l'action
      logger.info('Classes récupérées avec succès.', { userId: request.auth?.userId });

      // Envoie la réponse
      response.status(200).json({
        success: true,
        count: classes.length, // Nombre d'éléments dans la réponse actuelle
        totalCount: classeCount, // Nombre total d'éléments disponibles après filtrage
        resPerPage,
        classes,
      });
    } catch (error) {
      // Gère les erreurs
      this.handleError(error, 'Erreur lors de la récupération des classes.', request, next);
    }
  }

  /**
   * @description Récupère une classe par son ID.
   * @param {import('express').Request} request - Objet requête Express.
   * @param {import('express').Response} response - Objet réponse Express.
   * @param {import('express').NextFunction} next - Fonction next du middleware Express.
   */
  async getClasse(request, response, next) {
    try {
      // Recherche la classe par sa clé primaire (ID)
      const classe = await this.model.findByPk(request.params.id);

      // Si non trouvée, renvoie une erreur 404
      if (!classe) {
        return next(new ErrorResponse('Classe non trouvée.', 'NOT_FOUND', 404));
      }

      // Log l'action
      logger.info('Classe récupérée par ID avec succès.', { classeId: request.params.id, userId: request.auth?.userId });

      // Envoie la réponse
      response.status(200).json({ success: true, data: classe });
    } catch (error) {
      // Gère les erreurs
      this.handleError(error, 'Erreur lors de la récupération de la classe par ID.', request, next);
    }
  }

  /**
   * @description Met à jour une classe existante.
   * @param {import('express').Request} request - Objet requête Express.
   * @param {import('express').Response} response - Objet réponse Express.
   * @param {import('express').NextFunction} next - Fonction next du middleware Express.
   */
  async updateClasse(request, response, next) {
    try {
      // Valide les données de la requête
      this.validator.validate(request.body, this.validator.classeUpdateSchema);

      // Recherche la classe à mettre à jour
      const classe = await this.model.findByPk(request.params.id);

      // Si non trouvée, renvoie une erreur 404
      if (!classe) {
        return next(new ErrorResponse('Classe non trouvée pour la mise à jour.', 'NOT_FOUND', 404));
      }

      // Utilise les noms de champs mis à jour : anneeCode et ecoleId
      const { libelle, niveau, anneeCode, ecoleId } = request.body;

      // Met à jour la classe
      await classe.update({ libelle, niveau, anneeCode, ecoleId });

      // Log l'action
      logger.info('Classe mise à jour avec succès.', { classeId: request.params.id, userId: request.auth?.userId });

      // Envoie la réponse
      response.status(200).json({ success: true, data: classe });
    } catch (error) {
      // Gère les erreurs
      this.handleError(error, 'Erreur lors de la mise à jour de la classe.', request, next);
    }
  }

  /**
   * @description Supprime une classe.
   * @param {import('express').Request} request - Objet requête Express.
   * @param {import('express').Response} Objet réponse Express.
   * @param {import('express').NextFunction} next - Fonction next du middleware Express.
   */
  async deleteClasse(request, response, next) {
    try {
      // Recherche la classe à supprimer
      const classe = await this.model.findByPk(request.params.id);

      // Si non trouvée, renvoie une erreur 404
      if (!classe) {
        return next(new ErrorResponse('Classe non trouvée pour la suppression.', 'NOT_FOUND', 404));
      }

      // Supprime la classe
      await classe.destroy();

      // Log l'action
      logger.info('Classe supprimée avec succès.', { classeId: request.params.id, userId: request.auth?.userId });

      // Envoie une réponse vide pour indiquer la suppression réussie
      response.status(200).json({ success: true, data: {} });
    } catch (error) {
      // Gère les erreurs
      this.handleError(error, 'Erreur lors de la suppression de la classe.', request, next);
    }
  }
}

export default ClasseController;
