// Importe l'objet 'db' qui contient l'instance Sequelize et tous les modèles
import { db } from '../Models/index.js';
import Validator from '../Middlewares/Validator.js';
// Importe l'instance unique du logger, comme suggéré précédemment
import logger from '../Utils/Logger.js';
import ErrorResponse from '../Utils/errorResponse.js';
import APIFeatures from '../Utils/apiFeatures.js';

class EleveController {
  constructor() {
    this.model = db.Eleve; // Accède au modèle via l'objet 'db'
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
   * @description Récupère tous les élèves, avec filtrage par école pour les enseignants.
   * @param {import('express').Request} request - Objet requête Express.
   * @param {import('express').Response} response - Objet réponse Express.
   * @param {import('express').NextFunction} next - Fonction next du middleware Express.
   */
  async getAll(request, response, next) {
    try {
      const resPerPage = parseInt(process.env.RES_PER_PAGE, 10) || 10;
      let where = {};

      // Si l'utilisateur est un enseignant, filtre les élèves par son école
      if (request.auth?.userRole === 'Teacher') {
        // Récupère l'ID de l'école de l'enseignant
        const user = await db.User.findByPk(request.auth.userId);
        if (user && user.ecoleId) { // Assurez-vous que le champ est 'ecoleId'
          where = { ecoleId: user.ecoleId }; // Utilise 'ecoleId' pour le filtre
        } else {
          // Si l'enseignant n'est pas associé à une école, ne renvoie aucun élève ou une erreur
          logger.warn('Enseignant sans école associée tentant de récupérer les élèves.', { userId: request.auth?.userId });
          return response.status(200).json({
            success: true,
            count: 0,
            totalCount: 0,
            resPerPage,
            eleves: [],
          });
        }
      }

      // Compte le nombre total d'élèves avec le filtre 'where' appliqué
      const eleveCount = await this.model.count({ where });

      // Applique les fonctionnalités d'API (recherche, filtre, tri, etc.)
      const apiFeatures = new APIFeatures(this.model, request.query, { searchableFields: ['lastname', 'firstname'] })
        .search()
        .filter()
        .sort()
        .limitFields()
        .paginate(resPerPage);

      // Fusionne le filtre spécifique au rôle avec les filtres de l'APIFeatures
      apiFeatures.query.where = { ...apiFeatures.query.where, ...where };

      // Exécute la requête et récupère les élèves
      const eleves = await apiFeatures.execute();

      // Log l'action
      logger.info('Élèves récupérés avec succès.', { userId: request.auth?.userId });

      // Envoie la réponse
      response.status(200).json({
        success: true,
        count: eleves.length, // Nombre d'éléments dans la réponse actuelle
        totalCount: eleveCount, // Nombre total d'éléments disponibles après filtrage
        resPerPage,
        eleves,
      });
    } catch (error) {
      // Gère les erreurs
      this.handleError(error, 'Erreur lors de la récupération des élèves.', request, next);
    }
  }

  /**
   * @description Récupère un élève par son ID (matricule).
   * @param {import('express').Request} request - Objet requête Express.
   * @param {import('express').Response} response - Objet réponse Express.
   * @param {import('express').NextFunction} next - Fonction next du middleware Express.
   */
  async getEleve(request, response, next) {
    try {
      // Recherche l'élève par sa clé primaire (matricule)
      const eleve = await this.model.findByPk(request.params.id);

      // Si non trouvé, renvoie une erreur 404
      if (!eleve) {
        return next(new ErrorResponse('Élève non trouvé.', 'NOT_FOUND', 404));
      }

      // Log l'action
      logger.info('Élève récupéré par ID avec succès.', { matricul: request.params.id, userId: request.auth?.userId });

      // Envoie la réponse
      response.status(200).json({ success: true, data: eleve });
    } catch (error) {
      // Gère les erreurs
      this.handleError(error, 'Erreur lors de la récupération de l\'élève par ID.', request, next);
    }
  }

  /**
   * @description Crée un nouvel élève.
   * @param {import('express').Request} request - Objet requête Express.
   * @param {import('express').Response} response - Objet réponse Express.
   * @param {import('express').NextFunction} next - Fonction next du middleware Express.
   */
  async createEleve(request, response, next) {
    try {
      // Valide les données de la requête
      this.validator.validate(request.body, this.validator.eleveCreateSchema);

      // Utilise les noms de champs mis à jour : last_name, first_name, classeId, ecoleId
      const { matricul, lastname, firstname, genre, classe, ecole } = request.body;

      // Crée le nouvel élève dans la base de données avec les noms de champs du modèle
      const eleve = await this.model.create({
        matricul,
        lastname, // Ces noms seront mappés par le modèle via 'field'
        firstname, // Ces noms seront mappés par le modèle via 'field'
        genre,
        classeId: classe, // Mappe 'classe' de la requête vers 'classeId' du modèle
        ecoleId: ecole,   // Mappe 'ecole' de la requête vers 'ecoleId' du modèle
      });

      // Log l'action
      logger.info('Élève créé avec succès.', { matricul, userId: request.auth?.userId });

      // Envoie la réponse
      response.status(201).json({ success: true, data: eleve });
    } catch (error) {
      // Gère les erreurs
      this.handleError(error, 'Erreur lors de la création de l\'élève.', request, next);
    }
  }

  /**
   * @description Met à jour un élève existant.
   * @param {import('express').Request} request - Objet requête Express.
   * @param {import('express').Response} response - Objet réponse Express.
   * @param {import('express').NextFunction} next - Fonction next du middleware Express.
   */
  async updateEleve(request, response, next) {
    try {
      // Valide les données de la requête
      this.validator.validate(request.body, this.validator.eleveUpdateSchema);

      // Recherche l'élève à mettre à jour
      const eleve = await this.model.findByPk(request.params.id);

      // Si non trouvé, renvoie une erreur 404
      if (!eleve) {
        return next(new ErrorResponse('Élève non trouvé pour la mise à jour.', 'NOT_FOUND', 404));
      }

      // Utilise les noms de champs mis à jour : last_name, first_name, classeId, ecoleId
      const { matricul, lastname, firstname, genre, classe, ecole } = request.body;

      // Met à jour l'élève avec les noms de champs du modèle
      await eleve.update({
        matricul,
        lastname, // Ces noms seront mappés par le modèle via 'field'
        firstname, // Ces noms seront mappés par le modèle via 'field'
        genre,
        classeId: classe, // Mappe 'classe' de la requête vers 'classeId' du modèle
        ecoleId: ecole,   // Mappe 'ecole' de la requête vers 'ecoleId' du modèle
      });

      // Log l'action
      logger.info('Élève mis à jour avec succès.', { matricul: request.params.id, userId: request.auth?.userId });

      // Envoie la réponse
      response.status(200).json({ success: true, data: eleve });
    } catch (error) {
      // Gère les erreurs
      this.handleError(error, 'Erreur lors de la mise à jour de l\'élève.', request, next);
    }
  }

  /**
   * @description Supprime un élève.
   * @param {import('express').Request} request - Objet requête Express.
   * @param {import('express').Response} response - Objet réponse Express.
   * @param {import('express').NextFunction} next - Fonction next du middleware Express.
   */
  async deleteEleve(request, response, next) {
    try {
      // Recherche l'élève à supprimer
      const eleve = await this.model.findByPk(request.params.id);

      // Si non trouvé, renvoie une erreur 404
      if (!eleve) {
        return next(new ErrorResponse('Élève non trouvé pour la suppression.', 'NOT_FOUND', 404));
      }

      // Supprime l'élève
      await eleve.destroy();

      // Log l'action
      logger.info('Élève supprimé avec succès.', { matricul: request.params.id, userId: request.auth?.userId });

      // Envoie une réponse vide pour indiquer la suppression réussie
      response.status(200).json({ success: true, data: {} });
    } catch (error) {
      // Gère les erreurs
      this.handleError(error, 'Erreur lors de la suppression de l\'élève.', request, next);
    }
  }
}

export default EleveController;
