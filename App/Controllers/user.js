import bcrypt from 'bcrypt';
// Importe l'objet 'db' qui contient l'instance Sequelize et tous les modèles
import { db } from '../Models/index.js';
import AuthMiddleware from '../Middlewares/authMiddleware.js';
import Validator from '../Middlewares/Validator.js';
// Importe l'instance unique du logger, comme suggéré précédemment
import logger from '../Utils/Logger.js';
import ErrorResponse from '../Utils/errorResponse.js';
import APIFeatures from '../Utils/apiFeatures.js';

class UserController {
  constructor() {
    this.model = db.User;
    this.models = db; 
    this.validator = Validator;
    this.middleware = AuthMiddleware;
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
   * @description Récupère tous les utilisateurs avec des options de recherche, filtrage, tri et pagination.
   * @param {import('express').Request} request - Objet requête Express.
   * @param {import('express').Response} response - Objet réponse Express.
   * @param {import('express').NextFunction} next - Fonction next du middleware Express.
   */
  async getAll(request, response, next) {
    try {
      const resPerPage = parseInt(process.env.RES_PER_PAGE, 10) || 10;
      const userCount = await this.model.count(); // Compte le nombre total d'utilisateurs

      // Applique les fonctionnalités d'API (recherche, filtre, tri, etc.)
      const apiFeatures = new APIFeatures(this.model, request.query, {
        searchableFields: ['username', 'userRole'], // Ajout de userRole si pertinent pour la recherche
        excludeFields: ['mdpasse', 'deletedAt', 'createdAt', 'updatedAt'] // Exclut les champs sensibles et auto-générés
      })
        .search()
        .filter()
        .sort()
        .limitFields()
        .paginate(resPerPage);

      // Exécute la requête et récupère les utilisateurs
      const users = await apiFeatures.execute();

      // Log l'action
      logger.info('Utilisateurs récupérés avec succès.', { userId: request.auth?.userId });

      // Envoie la réponse
      response.status(200).json({
        success: true,
        count: users.length, // Nombre d'éléments dans la réponse actuelle
        totalCount: userCount, // Nombre total d'éléments disponibles
        resPerPage,
        users,
      });
    } catch (error) {
      // Gère les erreurs
      this.handleError(error, 'Erreur lors de la récupération des utilisateurs.', request, next);
    }
  }

  /**
   * @description Crée un nouvel utilisateur.
   * @param {import('express').Request} request - Objet requête Express.
   * @param {import('express').Response} response - Objet réponse Express.
   * @param {import('express').NextFunction} next - Fonction next du middleware Express.
   */
  async createUser(request, response, next) {
    try {
      // Valide les données de la requête
      this.validator.validate(request.body, this.validator.userCreateSchema);

      // Utilise les noms de champs mis à jour pour le modèle User
      const { username, password, userRole, ecole } = request.body;
      const ecoleId = ecole; // Mappe 'ecole' de la requête vers 'ecoleId' du modèle

      // Vérifier si l'école existe
      const ecoleExists = await this.models.Ecole.findByPk(ecoleId); // Utilise db.Ecole
      if (!ecoleExists) {
        return next(new ErrorResponse('École non trouvée pour l\'assignation de l\'utilisateur.', 'NOT_FOUND', 404));
      }

      // Crée le nouvel utilisateur dans la base de données
      const user = await this.model.create({ username, password, userRole, ecoleId }); // Utilise ecoleId

      // Log l'action
      logger.info('Utilisateur créé avec succès.', { userId: user.userId, userIdCreator: request.auth?.userId });

      // Envoie la réponse (exclut le mot de passe haché)
      response.status(201).json({
        success: true,
        data: {
          userId: user.userId,
          username: user.username,
          userRole: user.userRole,
          ecoleId: user.ecoleId, // Renommé 'ecole' en 'ecoleId'
          lastLogin: user.lastLogin
        },
      });
    } catch (error) {
      // Gère les erreurs
      this.handleError(error, 'Erreur lors de la création de l\'utilisateur.', request, next);
    }
  }

  /**
   * @description Récupère un utilisateur spécifique par son ID.
   * @param {import('express').Request} request - Objet requête Express.
   * @param {import('express').Response} response - Objet réponse Express.
   * @param {import('express').NextFunction} next - Fonction next du middleware Express.
   */
  async getUser(request, response, next) {
    try {
      // Recherche l'utilisateur par sa clé primaire (ID), exclut les champs sensibles
      const user = await this.model.findByPk(request.params.id, {
        attributes: { exclude: ['mdpasse', 'deletedAt', 'createdAt', 'updatedAt'] }, // Utilise 'deletedAt' et inclut les champs auto-générés pour l'exclusion
      });

      // Si non trouvé, renvoie une erreur 404
      if (!user) {
        return next(new ErrorResponse('Utilisateur non trouvé.', 'NOT_FOUND', 404));
      }

      // Log l'action
      logger.info('Utilisateur récupéré par ID avec succès.', { userId: request.params.id, userIdRequester: request.auth?.userId });

      // Envoie la réponse
      response.status(200).json({ success: true, data: user });
    } catch (error) {
      // Gère les erreurs
      this.handleError(error, 'Erreur lors de la récupération de l\'utilisateur par ID.', request, next);
    }
  }

  /**
   * @description Met à jour un utilisateur existant.
   * @param {import('express').Request} request - Objet requête Express.
   * @param {import('express').Response} response - Objet réponse Express.
   * @param {import('express').NextFunction} next - Fonction next du middleware Express.
   */
  async updateUser(request, response, next) {
    try {
      // Valide les données de la requête
      this.validator.validate(request.body, this.validator.userUpdateSchema);

      // Recherche l'utilisateur à mettre à jour
      const user = await this.model.findByPk(request.params.id);

      // Si non trouvé, renvoie une erreur 404
      if (!user) {
        return next(new ErrorResponse('Utilisateur non trouvé pour la mise à jour.', 'NOT_FOUND', 404));
      }

      const { username, password, userRole, ecole } = request.body;
      const ecoleId = ecole; // Mappe 'ecole' de la requête vers 'ecoleId' du modèle

      // Vérifier si l'école existe si fournie
      if (ecoleId) { // Vérifie ecoleId, pas ecole
        const ecoleExists = await this.models.Ecole.findByPk(ecoleId); // Utilise db.Ecole
        if (!ecoleExists) {
          return next(new ErrorResponse('École non trouvée pour la mise à jour de l\'utilisateur.', 'NOT_FOUND', 404));
        }
      }

      // Filtrer les champs non fournis pour la mise à jour
      const updateData = {};
      if (username !== undefined) updateData.username = username;
      if (password !== undefined) updateData.password = password; // Le hook `beforeUpdate` gérera le hachage
      if (userRole !== undefined) updateData.userRole = userRole;
      if (ecoleId !== undefined) updateData.ecoleId = ecoleId; // Utilise ecoleId

      // Si aucun champ n'est fourni pour la mise à jour, renvoie une réponse appropriée
      if (Object.keys(updateData).length === 0) {
        return response.status(200).json({ success: true, message: 'Aucune donnée fournie pour la mise à jour.' });
      }

      // Met à jour l'utilisateur
      await user.update(updateData);

      // Log l'action
      logger.info('Utilisateur mis à jour avec succès.', { userId: request.params.id, userIdUpdater: request.auth?.userId });

      // Envoie la réponse (exclut le mot de passe haché)
      response.status(200).json({
        success: true,
        data: {
          userId: user.userId,
          username: user.username,
          userRole: user.userRole,
          ecoleId: user.ecoleId, // Renommé 'ecole' en 'ecoleId'
          lastLogin: user.lastLogin
        },
      });
    } catch (error) {
      // Gère les erreurs
      this.handleError(error, 'Erreur lors de la mise à jour de l\'utilisateur.', request, next);
    }
  }

  /**
   * @description Supprime un utilisateur (soft delete).
   * @param {import('express').Request} request - Objet requête Express.
   * @param {import('express').Response} response - Objet réponse Express.
   * @param {import('express').NextFunction} next - Fonction next du middleware Express.
   */
  async deleteUser(request, response, next) {
    try {
      // Recherche l'utilisateur à supprimer
      const user = await this.model.findByPk(request.params.id);

      // Si non trouvé, renvoie une erreur 404
      if (!user) {
        return next(new ErrorResponse('Utilisateur non trouvé pour la suppression.', 'NOT_FOUND', 404));
      }

      // Supprime l'utilisateur (soft delete grâce à paranoid=true dans le modèle Schema)
      await user.destroy();

      // Log l'action
      logger.info('Utilisateur supprimé avec succès (soft delete).', { userId: request.params.id, userIdDeleter: request.auth?.userId });

      // Envoie une réponse vide pour indiquer la suppression réussie
      response.status(200).json({ success: true, data: {} });
    } catch (error) {
      // Gère les erreurs
      this.handleError(error, 'Erreur lors de la suppression de l\'utilisateur.', request, next);
    }
  }

  /**
   * @description Connecte un utilisateur et génère un jeton JWT.
   * @param {import('express').Request} request - Objet requête Express.
   * @param {import('express').Response} response - Objet réponse Express.
   * @param {import('express').NextFunction} next - Fonction next du middleware Express.
   */
  async login(request, response, next) {
    try {
      // Valide les données de connexion
      this.validator.validate(request.body, this.validator.loginSchema);

      const { username, password } = request.body;

      // Recherche l'utilisateur par nom d'utilisateur
      const user = await this.model.findOne({ where: { username } });

      // Si l'utilisateur n'est pas trouvé, renvoie une erreur 404
      if (!user) {
        return next(new ErrorResponse('Nom d\'utilisateur ou mot de passe incorrect.', 'INVALID_CREDENTIALS', 401));
      }

      // Vérifie le mot de passe en utilisant la méthode d'instance comparePassword
      // que nous avons ajoutée au modèle User.
      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return next(new ErrorResponse('Nom d\'utilisateur ou mot de passe incorrect.', 'INVALID_CREDENTIALS', 401));
      }

      // Met à jour la date de dernière connexion
      await user.update({ lastLogin: new Date() });

      // Génère le jeton JWT
      const token = this.middleware.generateToken(user);

      // Log l'action
      logger.info('Connexion réussie.', { userId: user.userId });

      // Envoie la réponse avec le jeton
      response.status(200).json({ success: true, token });
    } catch (error) {
      // Gère les erreurs
      this.handleError(error, 'Erreur lors de la connexion de l\'utilisateur.', request, next);
    }
  }
}

export default UserController;
