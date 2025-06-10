// Importe l'objet 'db' qui contient l'instance Sequelize et tous les modèles
import { db } from '../Models/index.js';
import Validator from '../Middlewares/validator.js'; // Changed Validator.js to validator.js
// Importe l'instance unique du logger, comme suggéré précédemment
import logger from '../Utils/Logger.js';
import ErrorResponse from '../Utils/errorResponse.js';
import APIFeatures from '../Utils/apiFeatures.js';

class MoyenneController {
  constructor() {
    this.model = db.Moyenne; // Accède au modèle via l'objet 'db'
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
   * @description Calcule et enregistre la moyenne d'un élève pour une composition donnée.
   * @param {import('express').Request} request - Objet requête Express.
   * @param {import('express').Response} response - Objet réponse Express.
   * @param {import('express').NextFunction} next - Fonction next du middleware Express.
   */
  async calculateMoyenne(request, response, next) {
    try {
      // Valide les données de la requête
      this.validator.validate(request.body, this.validator.moyenneCreateSchema);

      // Utilise les noms de champs mis à jour : matriculEleve et codeCompo
      const { eleve, compos } = request.body; // eleve et compos viennent de la requête
      const matriculEleve = eleve; // Mappe à matriculEleve du modèle
      const codeCompo = compos;   // Mappe à codeCompo du modèle

      // Récupère toutes les notes de l'élève pour la composition donnée, incluant les évaluations pour les coefficients
      const notes = await db.Note.findAll({
        where: { matriculEleve, codeCompo }, // Utilise les noms de champs du modèle Note
        include: [{
          model: db.Evaluation,
          as: 'evaluationType' // Utilise l'alias défini dans le modèle Note pour l'association Evaluation
        }],
      });

      // Si aucune note n'est trouvée, renvoie une erreur
      if (notes.length === 0) {
        return next(new ErrorResponse('Aucune note trouvée pour calculer la moyenne.', 'NO_GRADES', 404));
      }

      // Calcule la somme pondérée des notes et le total des coefficients
      const total = notes.reduce((sum, note) => sum + note.note * note.evaluationType.coeficient, 0);
      const totalCoef = notes.reduce((sum, note) => sum + note.evaluationType.coeficient, 0);

      // Calcule la moyenne
      const moyenne = totalCoef === 0 ? 0 : total / totalCoef; // Évite la division par zéro

      // Cherche ou crée l'enregistrement de moyenne. Si existant, le met à jour.
      const [record, created] = await this.model.findOrCreate({
        where: { matriculEleve, codeCompo }, // Utilise les noms de champs du modèle Moyenne
        defaults: { moyenne },
      });

      if (!created) {
        await record.update({ moyenne }); // Met à jour la moyenne si l'enregistrement existait déjà
      }

      // Log l'action
      logger.info('Moyenne calculée et/ou mise à jour avec succès.', { matriculEleve, codeCompo, moyenne, userId: request.auth?.userId });

      // Envoie la réponse
      response.status(created ? 201 : 200).json({ success: true, data: record });
    } catch (error) {
      // Gère les erreurs
      this.handleError(error, 'Erreur lors du calcul de la moyenne.', request, next);
    }
  }

  /**
   * @description Récupère toutes les moyennes.
   * @param {import('express').Request} request - Objet requête Express.
   * @param {import('express').Response} response - Objet réponse Express.
   * @param {import('express').NextFunction} next - Fonction next du middleware Express.
   */
  async getAllMoyennes(request, response, next) {
    try {
      const resPerPage = parseInt(process.env.RES_PER_PAGE, 10) || 10;
      const where = {}; // Pas de filtre spécifique au rôle ici, mais peut être ajouté si nécessaire

      // Compte le nombre total de moyennes avec le filtre 'where' appliqué
      const moyenneCount = await this.model.count({ where });

      // Applique les fonctionnalités d'API (filtrage, tri, etc.)
      const apiFeatures = new APIFeatures(this.model, request.query, { searchableFields: [] }) // Moyenne n'a pas de champs recherchables directs
        .filter()
        .sort()
        .limitFields()
        .paginate(resPerPage);

      // Fusionne le filtre 'where' avec les filtres de l'APIFeatures
      apiFeatures.query.where = { ...apiFeatures.query.where, ...where };

      // Inclut les modèles associés pour enrichir la réponse
      apiFeatures.query.include = [
        { model: db.Composition, as: 'compositionDetail' }, // Utilise l'alias défini dans le modèle Moyenne
        { model: db.Eleve, as: 'eleveDetail' } // Inclut les détails de l'élève
      ];

      // Exécute la requête et récupère les moyennes
      const moyennes = await apiFeatures.execute();

      // Log l'action
      logger.info('Toutes les moyennes récupérées avec succès.', { userId: request.auth?.userId });

      // Envoie la réponse
      response.status(200).json({
        success: true,
        count: moyennes.length, // Nombre d'éléments dans la réponse actuelle
        totalCount: moyenneCount, // Nombre total d'éléments disponibles après filtrage
        resPerPage,
        moyennes,
      });
    } catch (error) {
      // Gère les erreurs
      this.handleError(error, 'Erreur lors de la récupération de toutes les moyennes.', request, next);
    }
  }

  /**
   * @description Récupère les moyennes d'un élève spécifique.
   * @param {import('express').Request} request - Objet requête Express.
   * @param {import('express').Response} response - Objet réponse Express.
   * @param {import('express').NextFunction} next - Fonction next du middleware Express.
   */
  async getMoyennesByEleve(request, response, next) {
    try {
      const resPerPage = parseInt(process.env.RES_PER_PAGE, 10) || 10;
      const matriculEleve = request.params.eleveId; // Utilise le paramètre d'URL pour le matricule de l'élève

      // Filtre par le matricule de l'élève
      const where = { matriculEleve };

      // Compte le nombre total de moyennes pour cet élève
      const moyenneCount = await this.model.count({ where });

      // Applique les fonctionnalités d'API
      const apiFeatures = new APIFeatures(this.model, request.query, { searchableFields: [] })
        .filter()
        .sort()
        .limitFields()
        .paginate(resPerPage);

      // Fusionne le filtre spécifique à l'élève avec les filtres de l'APIFeatures
      apiFeatures.query.where = { ...apiFeatures.query.where, ...where };

      // Inclut les modèles associés pour enrichir la réponse
      apiFeatures.query.include = [
        { model: db.Composition, as: 'compositionDetail' }, // Utilise l'alias défini dans le modèle Moyenne
        { model: db.Eleve, as: 'eleveDetail' } // Inclut les détails de l'élève
      ];

      // Exécute la requête et récupère les moyennes
      const moyennes = await apiFeatures.execute();

      // Log l'action
      logger.info('Moyennes récupérées par élève avec succès.', { matriculEleve, userId: request.auth?.userId });

      // Envoie la réponse
      response.status(200).json({
        success: true,
        count: moyennes.length,
        totalCount: moyenneCount,
        resPerPage,
        moyennes,
      });
    } catch (error) {
      // Gère les erreurs
      this.handleError(error, 'Erreur lors de la récupération des moyennes par élève.', request, next);
    }
  }

  /**
   * @description Récupère les moyennes pour une composition spécifique.
   * @param {import('express').Request} request - Objet requête Express.
   * @param {import('express').Response} response - Objet réponse Express.
   * @param {import('express').NextFunction} next - Fonction next du middleware Express.
   */
  async getMoyennesByCompos(request, response, next) {
    try {
      const resPerPage = parseInt(process.env.RES_PER_PAGE, 10) || 10;
      const codeCompo = request.params.composId; // Utilise le paramètre d'URL pour le code de composition

      // Filtre par le code de composition
      const where = { codeCompo };

      // Compte le nombre total de moyennes pour cette composition
      const moyenneCount = await this.model.count({ where });

      // Applique les fonctionnalités d'API
      const apiFeatures = new APIFeatures(this.model, request.query, { searchableFields: [] })
        .filter()
        .sort()
        .limitFields()
        .paginate(resPerPage);

      // Fusionne le filtre spécifique à la composition avec les filtres de l'APIFeatures
      apiFeatures.query.where = { ...apiFeatures.query.where, ...where };

      // Inclut les modèles associés pour enrichir la réponse
      apiFeatures.query.include = [
        { model: db.Composition, as: 'compositionDetail' }, // Utilise l'alias défini dans le modèle Moyenne
        { model: db.Eleve, as: 'eleveDetail' } // Inclut les détails de l'élève
      ];

      // Exécute la requête et récupère les moyennes
      const moyennes = await apiFeatures.execute();

      // Log l'action
      logger.info('Moyennes récupérées par composition avec succès.', { codeCompo, userId: request.auth?.userId });

      // Envoie la réponse
      response.status(200).json({
        success: true,
        count: moyennes.length,
        totalCount: moyenneCount,
        resPerPage,
        moyennes,
      });
    } catch (error) {
      // Gère les erreurs
      this.handleError(error, 'Erreur lors de la récupération des moyennes par composition.', request, next);
    }
  }

  /**
   * @description Met à jour une moyenne existante.
   * @param {import('express').Request} request - Objet requête Express.
   * @param {import('express').Response} response - Objet réponse Express.
   * @param {import('express').NextFunction} next - Fonction next du middleware Express.
   */
  async updateMoyenne(request, response, next) {
    try {
      // Valide les données de la requête
      this.validator.validate(request.body, this.validator.moyenneUpdateSchema);

      // Utilise les noms de champs mis à jour pour la clé primaire composite
      const { eleve, compos } = request.params; // eleve et compos viennent des paramètres d'URL
      const matriculEleve = eleve;
      const codeCompo = compos;

      const { moyenne } = request.body;

      // Met à jour la moyenne en utilisant la clé primaire composite
      const [updatedRows] = await this.model.update(
        { moyenne },
        { where: { matriculEleve, codeCompo } } // Utilise les noms de champs du modèle
      );

      // Si aucune ligne n'a été mise à jour, la moyenne n'a pas été trouvée
      if (updatedRows === 0) {
        return next(new ErrorResponse('Moyenne non trouvée pour la mise à jour.', 'NOT_FOUND', 404));
      }

      // Log l'action
      logger.info('Moyenne mise à jour avec succès.', { matriculEleve, codeCompo, userId: request.auth?.userId });

      // Envoie une réponse vide pour indiquer la mise à jour réussie (cohérent avec les autres contrôleurs)
      response.status(200).json({ success: true, data: { matriculEleve, codeCompo, moyenne } }); // Retourne les identifiants et la nouvelle moyenne
    } catch (error) {
      // Gère les erreurs
      this.handleError(error, 'Erreur lors de la mise à jour de la moyenne.', request, next);
    }
  }

  /**
   * @description Supprime une moyenne.
   * @param {import('express').Request} request - Objet requête Express.
   * @param {import('express').Response} response - Objet réponse Express.
   * @param {import('express').NextFunction} next - Fonction next du middleware Express.
   */
  async deleteMoyenne(request, response, next) {
    try {
      // Utilise les noms de champs mis à jour pour la clé primaire composite
      const { eleve, compos } = request.params; // eleve et compos viennent des paramètres d'URL
      const matriculEleve = eleve;
      const codeCompo = compos;

      // Supprime la moyenne en utilisant la clé primaire composite
      const deletedRows = await this.model.destroy({ where: { matriculEleve, codeCompo } });

      // Si aucune ligne n'a été supprimée, la moyenne n'a pas été trouvée
      if (deletedRows === 0) {
        return next(new ErrorResponse('Moyenne non trouvée pour la suppression.', 'NOT_FOUND', 404));
      }

      // Log l'action
      logger.info('Moyenne supprimée avec succès.', { matriculEleve, codeCompo, userId: request.auth?.userId });

      // Envoie une réponse vide pour indiquer la suppression réussie
      response.status(200).json({ success: true, data: {} });
    } catch (error) {
      // Gère les erreurs
      this.handleError(error, 'Erreur lors de la suppression de la moyenne.', request, next);
    }
  }
}

export default MoyenneController;
