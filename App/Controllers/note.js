// Importe l'objet 'db' qui contient l'instance Sequelize et tous les modèles
import { db } from '../Models/index.js';
import Validator from '../Middlewares/Validator.js';
// Importe l'instance unique du logger, comme suggéré précédemment
import logger from '../Utils/Logger.js';
import ErrorResponse from '../Utils/errorResponse.js';
import APIFeatures from '../Utils/apiFeatures.js';

class NoteController {
  constructor() {
    this.model = db.Note; // Accède au modèle via l'objet 'db'
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
   * @description Crée une nouvelle note pour un élève, une évaluation et une composition donnée.
   * @param {import('express').Request} request - Objet requête Express.
   * @param {import('express').Response} response - Objet réponse Express.
   * @param {import('express').NextFunction} next - Fonction next du middleware Express.
   */
  async createNote(request, response, next) {
    try {
      // Valide les données de la requête
      this.validator.validate(request.body, this.validator.noteCreateSchema);

      // Utilise les noms de champs mis à jour pour le modèle Note
      const { eleve, evaluation, compos, note } = request.body;
      const matriculEleve = eleve;     // Mappe 'eleve' de la requête vers 'matriculEleve' du modèle
      const codeEva = evaluation;     // Mappe 'evaluation' de la requête vers 'codeEva' du modèle
      const codeCompo = compos;       // Mappe 'compos' de la requête vers 'codeCompo' du modèle

      // Crée la nouvelle note dans la base de données
      const newNote = await this.model.create({ matriculEleve, codeEva, codeCompo, note });

      // Log l'action
      logger.info('Note créée avec succès.', { matriculEleve, codeEva, codeCompo, userId: request.auth?.userId });

      // Envoie la réponse
      response.status(201).json({ success: true, data: newNote });
    } catch (error) {
      // Gère les erreurs
      this.handleError(error, 'Erreur lors de la création de la note.', request, next);
    }
  }

  /**
   * @description Récupère les notes d'un élève spécifique.
   * @param {import('express').Request} request - Objet requête Express.
   * @param {import('express').Response} response - Objet réponse Express.
   * @param {import('express').NextFunction} next - Fonction next du middleware Express.
   */
  async getNotesByEleve(request, response, next) {
    try {
      const resPerPage = parseInt(process.env.RES_PER_PAGE, 10) || 10;
      const matriculEleve = request.params.eleveId; // Utilise le paramètre d'URL pour le matricule de l'élève

      // Filtre par le matricule de l'élève
      const where = { matriculEleve };

      // Compte le nombre total de notes pour cet élève
      const noteCount = await this.model.count({ where });

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
        { model: db.Evaluation, as: 'evaluationType' }, // Utilise l'alias défini dans le modèle Note
        { model: db.Composition, as: 'composition' },   // Utilise l'alias défini dans le modèle Note
        { model: db.Eleve, as: 'eleveDetail' }          // Utilise l'alias défini dans le modèle Note
      ];

      // Exécute la requête et récupère les notes
      const notes = await apiFeatures.execute();

      // Log l'action
      logger.info('Notes récupérées par élève avec succès.', { matriculEleve, userId: request.auth?.userId });

      // Envoie la réponse
      response.status(200).json({
        success: true,
        count: notes.length,
        totalCount: noteCount,
        resPerPage,
        notes,
      });
    } catch (error) {
      // Gère les erreurs
      this.handleError(error, 'Erreur lors de la récupération des notes par élève.', request, next);
    }
  }

  /**
   * @description Récupère toutes les notes.
   * @param {import('express').Request} request - Objet requête Express.
   * @param {import('express').Response} response - Objet réponse Express.
   * @param {import('express').NextFunction} next - Fonction next du middleware Express.
   */
  async getAllNotes(request, response, next) {
    try {
      const resPerPage = parseInt(process.env.RES_PER_PAGE, 10) || 10;

      // Compte le nombre total de notes
      const noteCount = await this.model.count();

      // Applique les fonctionnalités d'API
      const apiFeatures = new APIFeatures(this.model, request.query, { searchableFields: [] })
        .filter()
        .sort()
        .limitFields()
        .paginate(resPerPage);

      // Inclut les modèles associés pour enrichir la réponse, en utilisant les alias
      apiFeatures.query.include = [
        { model: db.Evaluation, as: 'evaluationType' },
        { model: db.Composition, as: 'composition' },
        { model: db.Eleve, as: 'eleveDetail' }
      ];

      // Exécute la requête et récupère les notes
      const notes = await apiFeatures.execute();

      // Log l'action
      logger.info('Toutes les notes récupérées avec succès.', { userId: request.auth?.userId });

      // Envoie la réponse
      response.status(200).json({
        success: true,
        count: notes.length,
        totalCount: noteCount,
        resPerPage,
        notes,
      });
    } catch (error) {
      // Gère les erreurs
      this.handleError(error, 'Erreur lors de la récupération de toutes les notes.', request, next);
    }
  }

  /**
   * @description Met à jour une note existante.
   * La note est identifiée par sa clé primaire composite (eleveId, evaluationId, composId).
   * @param {import('express').Request} request - Objet requête Express.
   * @param {import('express').Response} response - Objet réponse Express.
   * @param {import('express').NextFunction} next - Fonction next du middleware Express.
   */
  async updateNote(request, response, next) {
    try {
      // Valide les données de la requête
      this.validator.validate(request.body, this.validator.noteUpdateSchema);

      // Récupère les composants de la clé primaire composite depuis les paramètres d'URL
      const { eleveId, evaluationId, composId } = request.params;
      const matriculEleve = eleveId;
      const codeEva = evaluationId;
      const codeCompo = composId;

      const { note } = request.body;

      // Met à jour la note en utilisant la clé primaire composite
      const [updatedRows] = await this.model.update(
        { note },
        { where: { matriculEleve, codeEva, codeCompo } } // Utilise les noms de champs du modèle
      );

      // Si aucune ligne n'a été mise à jour, la note n'a pas été trouvée
      if (updatedRows === 0) {
        return next(new ErrorResponse('Note non trouvée pour la mise à jour.', 'NOT_FOUND', 404));
      }

      // Log l'action
      logger.info('Note mise à jour avec succès.', { matriculEleve, codeEva, codeCompo, userId: request.auth?.userId });

      // Envoie la réponse avec les identifiants de la note mise à jour
      response.status(200).json({ success: true, data: { matriculEleve, codeEva, codeCompo, note } });
    } catch (error) {
      // Gère les erreurs
      this.handleError(error, 'Erreur lors de la mise à jour de la note.', request, next);
    }
  }

  /**
   * @description Supprime une note.
   * La note est identifiée par sa clé primaire composite (eleveId, evaluationId, composId).
   * @param {import('express').Request} request - Objet requête Express.
   * @param {import('express').Response} response - Objet réponse Express.
   * @param {import('express').NextFunction} next - Fonction next du middleware Express.
   */
  async deleteNote(request, response, next) {
    try {
      // Récupère les composants de la clé primaire composite depuis les paramètres d'URL
      const { eleveId, evaluationId, composId } = request.params;
      const matriculEleve = eleveId;
      const codeEva = evaluationId;
      const codeCompo = composId;

      // Supprime la note en utilisant la clé primaire composite
      const deletedRows = await this.model.destroy({ where: { matriculEleve, codeEva, codeCompo } });

      // Si aucune ligne n'a été supprimée, la note n'a pas été trouvée
      if (deletedRows === 0) {
        return next(new ErrorResponse('Note non trouvée pour la suppression.', 'NOT_FOUND', 404));
      }

      // Log l'action
      logger.info('Note supprimée avec succès.', { matriculEleve, codeEva, codeCompo, userId: request.auth?.userId });

      // Envoie une réponse vide pour indiquer la suppression réussie
      response.status(200).json({ success: true, data: {} });
    } catch (error) {
      // Gère les erreurs
      this.handleError(error, 'Erreur lors de la suppression de la note.', request, next);
    }
  }
}

export default NoteController;
