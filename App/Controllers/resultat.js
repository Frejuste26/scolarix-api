// Importe l'objet 'db' qui contient l'instance Sequelize et tous les modèles
import { db } from '../Models/index.js';
import Validator from '../Middlewares/validator.js'; // Changed Validator.js to validator.js
// Importe l'instance unique du logger, comme suggéré précédemment
import logger from '../Utils/Logger.js';
import ErrorResponse from '../Utils/errorResponse.js';
import APIFeatures from '../Utils/apiFeatures.js';

class ResultatController {
  constructor() {
    this.model = db.Resultat; // Accède au modèle via l'objet 'db'
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
   * @description Crée un nouveau résultat ou met à jour un résultat existant pour un élève et une année scolaire donnée.
   * @param {import('express').Request} request - Objet requête Express.
   * @param {import('express').Response} response - Objet réponse Express.
   * @param {import('express').NextFunction} next - Fonction next du middleware Express.
   */
  async createResultat(request, response, next) {
    try {
      // Valide les données de la requête
      this.validator.validate(request.body, this.validator.resultatCreateSchema);

      // Utilise les noms de champs mis à jour pour le modèle Resultat
      const { eleve, annee, decision, rang, mga } = request.body;
      const matriculEleve = eleve;   // Mappe 'eleve' de la requête vers 'matriculEleve' du modèle
      const anneeCode = annee;     // Mappe 'annee' de la requête vers 'anneeCode' du modèle

      // Cherche ou crée l'enregistrement de résultat. Si existant, le met à jour.
      const [resultat, created] = await this.model.findOrCreate({
        where: { matriculEleve, anneeCode }, // Utilise les noms de champs du modèle pour la clé primaire composite
        defaults: { decision, rang, mga },
      });

      if (!created) {
        // Met à jour le résultat si l'enregistrement existait déjà
        await resultat.update({ decision, rang, mga });
      }

      // Log l'action
      logger.info('Résultat créé ou mis à jour avec succès.', { matriculEleve, anneeCode, userId: request.auth?.userId });

      // Envoie la réponse
      response.status(created ? 201 : 200).json({ success: true, data: resultat });
    } catch (error) {
      // Gère les erreurs
      this.handleError(error, 'Erreur lors de la création ou de la mise à jour du résultat.', request, next);
    }
  }

  /**
   * @description Récupère tous les résultats.
   * @param {import('express').Request} request - Objet requête Express.
   * @param {import('express').Response} response - Objet réponse Express.
   * @param {import('express').NextFunction} next - Fonction next du middleware Express.
   */
  async getAllResultats(request, response, next) {
    try {
      const resPerPage = parseInt(process.env.RES_PER_PAGE, 10) || 10;

      // Compte le nombre total de résultats
      const resultatCount = await this.model.count();

      // Applique les fonctionnalités d'API
      const apiFeatures = new APIFeatures(this.model, request.query, { searchableFields: [] })
        .filter()
        .sort()
        .limitFields()
        .paginate(resPerPage);

      // Inclut les modèles associés pour enrichir la réponse, en utilisant les alias
      apiFeatures.query.include = [
        { model: db.AnneeScolaire, as: 'anneeScolaire' }, // Utilise l'alias défini dans le modèle Resultat
        { model: db.Eleve, as: 'eleveDetail' }           // Inclut les détails de l'élève
      ];

      // Exécute la requête et récupère les résultats
      const resultats = await apiFeatures.execute();

      // Log l'action
      logger.info('Tous les résultats récupérés avec succès.', { userId: request.auth?.userId });

      // Envoie la réponse
      response.status(200).json({
        success: true,
        count: resultats.length,
        totalCount: resultatCount,
        resPerPage,
        resultats,
      });
    } catch (error) {
      // Gère les erreurs
      this.handleError(error, 'Erreur lors de la récupération de tous les résultats.', request, next);
    }
  }

  /**
   * @description Récupère les résultats d'un élève spécifique.
   * @param {import('express').Request} request - Objet requête Express.
   * @param {import('express').Response} response - Objet réponse Express.
   * @param {import('express').NextFunction} next - Fonction next du middleware Express.
   */
  async getResultatsByEleve(request, response, next) {
    try {
      const resPerPage = parseInt(process.env.RES_PER_PAGE, 10) || 10;
      const matriculEleve = request.params.eleveId; // Utilise le paramètre d'URL pour le matricule de l'élève

      // Filtre par le matricule de l'élève
      const where = { matriculEleve };

      // Compte le nombre total de résultats pour cet élève
      const resultatCount = await this.model.count({ where });

      // Applique les fonctionnalités d'API
      const apiFeatures = new APIFeatures(this.model, request.query, { searchableFields: [] })
        .filter()
        .sort()
        .limitFields()
        .paginate(resPerPage);

      // Fusionne le filtre spécifique à l'élève avec les filtres de l'APIFeatures
      apiFeatures.query.where = { ...apiFeatures.query.where, ...where };

      // Inclut les modèles associés pour enrichir la réponse, en utilisant les alias
      apiFeatures.query.include = [
        { model: db.AnneeScolaire, as: 'anneeScolaire' },
        { model: db.Eleve, as: 'eleveDetail' }
      ];

      // Exécute la requête et récupère les résultats
      const resultats = await apiFeatures.execute();

      // Log l'action
      logger.info('Résultats récupérés par élève avec succès.', { matriculEleve, userId: request.auth?.userId });

      // Envoie la réponse
      response.status(200).json({
        success: true,
        count: resultats.length,
        totalCount: resultatCount,
        resPerPage,
        resultats,
      });
    } catch (error) {
      // Gère les erreurs
      this.handleError(error, 'Erreur lors de la récupération des résultats par élève.', request, next);
    }
  }

  /**
   * @description Récupère les résultats pour une année scolaire spécifique.
   * @param {import('express').Request} request - Objet requête Express.
   * @param {import('express').Response} response - Objet réponse Express.
   * @param {import('express').NextFunction} next - Fonction next du middleware Express.
   */
  async getResultatsByAnnee(request, response, next) {
    try {
      const resPerPage = parseInt(process.env.RES_PER_PAGE, 10) || 10;
      const anneeCode = request.params.anneeId; // Utilise le paramètre d'URL pour le code de l'année

      // Filtre par le code de l'année
      const where = { anneeCode };

      // Compte le nombre total de résultats pour cette année
      const resultatCount = await this.model.count({ where });

      // Applique les fonctionnalités d'API
      const apiFeatures = new APIFeatures(this.model, request.query, { searchableFields: [] })
        .filter()
        .sort()
        .limitFields()
        .paginate(resPerPage);

      // Fusionne le filtre spécifique à l'année avec les filtres de l'APIFeatures
      apiFeatures.query.where = { ...apiFeatures.query.where, ...where };

      // Inclut les modèles associés pour enrichir la réponse, en utilisant les alias
      apiFeatures.query.include = [
        { model: db.AnneeScolaire, as: 'anneeScolaire' },
        { model: db.Eleve, as: 'eleveDetail' }
      ];

      // Exécute la requête et récupère les résultats
      const resultats = await apiFeatures.execute();

      // Log l'action
      logger.info('Résultats récupérés par année avec succès.', { anneeCode, userId: request.auth?.userId });

      // Envoie la réponse
      response.status(200).json({
        success: true,
        count: resultats.length,
        totalCount: resultatCount,
        resPerPage,
        resultats,
      });
    } catch (error) {
      // Gère les erreurs
      this.handleError(error, 'Erreur lors de la récupération des résultats par année.', request, next);
    }
  }

  /**
   * @description Met à jour un résultat existant.
   * Le résultat est identifié par sa clé primaire composite (eleveId, anneeId).
   * @param {import('express').Request} request - Objet requête Express.
   * @param {import('express').Response} response - Objet réponse Express.
   * @param {import('express').NextFunction} next - Fonction next du middleware Express.
   */
  async updateResultat(request, response, next) {
    try {
      // Valide les données de la requête
      this.validator.validate(request.body, this.validator.resultatUpdateSchema);

      // Récupère les composants de la clé primaire composite depuis les paramètres d'URL
      const { eleveId, anneeId } = request.params;
      const matriculEleve = eleveId;
      const anneeCode = anneeId;

      // Recherche le résultat par sa clé primaire composite
      const resultat = await this.model.findOne({ where: { matriculEleve, anneeCode } });

      // Si non trouvé, renvoie une erreur 404
      if (!resultat) {
        return next(new ErrorResponse('Résultat non trouvé pour la mise à jour.', 'NOT_FOUND', 404));
      }

      const { decision, rang, mga } = request.body;

      // Met à jour le résultat
      await resultat.update({ decision, rang, mga });

      // Log l'action
      logger.info('Résultat mis à jour avec succès.', { matriculEleve, anneeCode, userId: request.auth?.userId });

      // Envoie la réponse
      response.status(200).json({ success: true, data: resultat });
    } catch (error) {
      // Gère les erreurs
      this.handleError(error, 'Erreur lors de la mise à jour du résultat.', request, next);
    }
  }

  /**
   * @description Supprime un résultat.
   * Le résultat est identifié par sa clé primaire composite (eleveId, anneeId).
   * @param {import('express').Request} request - Objet requête Express.
   * @param {import('express').Response} response - Objet réponse Express.
   * @param {import('express').NextFunction} next - Fonction next du middleware Express.
   */
  async deleteResultat(request, response, next) {
    try {
      // Récupère les composants de la clé primaire composite depuis les paramètres d'URL
      const { eleveId, anneeId } = request.params;
      const matriculEleve = eleveId;
      const anneeCode = anneeId;

      // Supprime le résultat en utilisant la clé primaire composite
      const deletedRows = await this.model.destroy({ where: { matriculEleve, anneeCode } });

      // Si aucune ligne n'a été supprimée, le résultat n'a pas été trouvé
      if (deletedRows === 0) {
        return next(new ErrorResponse('Résultat non trouvé pour la suppression.', 'NOT_FOUND', 404));
      }

      // Log l'action
      logger.info('Résultat supprimé avec succès.', { matriculEleve, anneeCode, userId: request.auth?.userId });

      // Envoie une réponse vide pour indiquer la suppression réussie
      response.status(200).json({ success: true, data: {} });
    } catch (error) {
      // Gère les erreurs
      this.handleError(error, 'Erreur lors de la suppression du résultat.', request, next);
    }
  }
}

export default ResultatController;
