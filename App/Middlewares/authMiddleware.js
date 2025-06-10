import jwt from 'jsonwebtoken';
// Importe l'objet 'db' qui contient l'instance Sequelize et tous les modèles
import { db } from '../Models/index.js';
// Importe l'instance unique du logger, comme suggéré précédemment
import logger from '../Utils/Logger.js';
import ErrorResponse from '../Utils/errorResponse.js';

class AuthMiddleware {
  /**
   * Middleware de vérification du token JWT.
   * Il extrait le token de l'en-tête Authorization, le vérifie,
   * et attache les informations de l'utilisateur à `req.auth`.
   * @param {import('express').Request} req - Objet requête Express.
   * @param {import('express').Response} res - Objet réponse Express.
   * @param {import('express').NextFunction} next - Fonction next du middleware Express.
   */
  static async authenticate(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Format attendu: Bearer <token>

    if (!token) {
      logger.warn('Tentative d\'accès non autorisée - Token manquant.', {
        ip: req.ip,
        path: req.originalUrl,
      });
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTH_REQUIRED',
          message: 'Authentification requise. Aucun token fourni.',
        },
      });
    }

    try {
      // Vérifier la clé secrète JWT dans les variables d'environnement
      if (!process.env.JWT_SECRET) {
        logger.error('Erreur de configuration: Clé secrète JWT manquante.', {});
        throw new ErrorResponse('Configuration JWT invalide.', 500, {
          code: 'JWT_CONFIG_ERROR',
          message: 'Clé secrète JWT manquante dans la configuration du serveur.',
        });
      }

      // Vérifie et décode le token JWT
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Vérification que l'utilisateur existe toujours dans la base de données
      // Utilise l'objet 'db' globalement initialisé
      const user = await db.User.findByPk(decoded.userId, {
        attributes: ['userId', 'username', 'userRole', 'ecoleId', 'lastLogin'], // Inclure ecoleId pour les contrôleurs
      });

      if (!user) {
        logger.warn('Token valide mais utilisateur associé introuvable dans la base de données.', {
          decodedUserId: decoded.userId, // Log l'ID décodé pour le débogage
          ip: req.ip,
          path: req.originalUrl,
        });
        return res.status(401).json({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'Compte utilisateur introuvable ou désactivé.',
          },
        });
      }

      // Attache les informations utilisateur à l'objet `req.auth` pour les middlewares et contrôleurs suivants
      req.auth = {
        userId: user.userId,
        username: user.username,
        userRole: user.userRole,
        ecoleId: user.ecoleId, // Ajout de ecoleId à req.auth pour un accès facile dans les contrôleurs
      };

      logger.info('Authentification réussie.', {
        userId: user.userId,
        userRole: user.userRole,
        ip: req.ip,
        path: req.originalUrl,
      });
      next(); // Passe au middleware/contrôleur suivant
    } catch (error) {
      // Log l'erreur d'authentification pour le débogage
      logger.error('Échec de l\'authentification du token.', {
        error: error.message,
        tokenSnippet: token ? token.substring(0, 20) + '...' : 'N/A', // Log un extrait du token
        ip: req.ip,
        path: req.originalUrl,
      });

      let errorMessage = 'Token invalide.';
      let errorCode = 'INVALID_TOKEN';
      let statusCode = 401;

      if (error.name === 'TokenExpiredError') {
        errorMessage = 'Le token d\'authentification a expiré. Veuillez vous reconnecter.';
        errorCode = 'TOKEN_EXPIRED';
      } else if (error.name === 'JsonWebTokenError') {
        errorMessage = 'Le token d\'authentification est malformé ou invalide.';
        errorCode = 'TOKEN_MALFORMED';
      } else if (error instanceof ErrorResponse) {
        // Si c'est une ErrorResponse lancée par nous-mêmes (ex: JWT_CONFIG_ERROR)
        errorMessage = error.message;
        errorCode = error.code;
        statusCode = error.statusCode;
      }

      res.status(statusCode).json({
        success: false,
        error: {
          code: errorCode,
          message: errorMessage,
        },
      });
    }
  }

  /**
   * Middleware de vérification du rôle de l'utilisateur et de la propriété de la ressource.
   * @param {string[]} requiredRoles - Tableau des rôles requis pour accéder à la ressource.
   * @param {Object} [options={}] - Options supplémentaires pour la vérification de la propriété.
   * @param {boolean} [options.ownershipRequired=false] - Indique si la propriété de la ressource est requise.
   * @param {string} [options.ownerField='userId'] - Le nom du champ dans la ressource qui contient l'ID du propriétaire.
   * @param {string} [options.idParam='id'] - Le nom du paramètre d'URL qui contient l'ID de la ressource (ex: 'id', 'eleveId').
   * @param {Function} [options.isOwner] - Fonction asynchrone personnalisée pour vérifier la propriété (prend `req.auth` et `resourceId` en arguments).
   * @param {import('sequelize').ModelStatic<any>} [options.model] - Le modèle Sequelize (classe) de la ressource à vérifier pour la propriété.
   * @returns {import('express').RequestHandler} Middleware Express.
   */
  static authorize = (requiredRoles = [], options = {}) => {
    return async (req, res, next) => {
      try {
        const resourceId = req.params[options.idParam || 'id']; // Utilise options.idParam ou 'id' par défaut

        // Vérification basique des rôles
        // Si aucun rôle requis n'est spécifié, tout rôle est autorisé par défaut pour cette partie.
        if (requiredRoles.length > 0 && (!req.auth || !requiredRoles.includes(req.auth.userRole))) {
          logger.warn('Tentative d\'accès non autorisée - Rôle insuffisant.', {
            userId: req.auth?.userId, // Utilise l'opérateur de chaînage optionnel
            requiredRoles,
            actualRole: req.auth?.userRole,
            path: req.originalUrl,
          });
          return res.status(403).json({
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: 'Permissions insuffisantes pour cette action.',
            },
          });
        }

        // Vérification supplémentaire si la propriété de la ressource est requise
        if (options.ownershipRequired) {
          const ownerField = options.ownerField || 'userId';
          const isOwnerCustomCheck = options.isOwner; // Renommé pour éviter la confusion avec la variable de statut
          let isOwnerAuthorized = false;

          // Si un modèle est fourni, on peut tenter de trouver la ressource
          if (options.model) {
            if (isOwnerCustomCheck && typeof isOwnerCustomCheck === 'function') {
              // Utilise la fonction de vérification de propriété personnalisée
              isOwnerAuthorized = await isOwnerCustomCheck(req.auth, resourceId);
            } else {
              // Vérification de propriété par défaut via le modèle Sequelize
              const resource = await options.model.findByPk(resourceId);
              if (resource && resource[ownerField] === req.auth.userId) {
                isOwnerAuthorized = true;
              }
            }
          } else {
            // Si ownershipRequired est true mais aucun modèle ou fonction isOwner n'est fourni
            logger.error('Modèle ou fonction de vérification de propriété personnalisée manquant pour l\'autorisation.', {
              userId: req.auth?.userId,
              path: req.originalUrl,
              options: options,
            });
            throw new ErrorResponse('Configuration d\'autorisation invalide: Modèle ou fonction de propriété requis.', 500, {
              code: 'AUTH_CONFIG_ERROR',
              message: 'Modèle Sequelize ou fonction isOwner manquante dans les options pour la vérification de propriété.',
            });
          }

          if (!isOwnerAuthorized) {
            logger.warn('Tentative d\'accès non autorisée - Propriété de la ressource requise.', {
              userId: req.auth?.userId,
              resourceId: resourceId,
              path: req.originalUrl,
            });
            return res.status(403).json({
              success: false,
              error: {
                code: 'OWNERSHIP_REQUIRED',
                message: 'Vous n\'êtes pas autorisé à effectuer cette action sur cette ressource.',
              },
            });
          }
        }

        next(); // Autorisation réussie, passe au middleware/contrôleur suivant
      } catch (error) {
        // Log l'erreur d'autorisation
        logger.error('Erreur lors de la vérification des permissions.', {
          error: error.message,
          stack: error.stack,
          userId: req.auth?.userId,
          path: req.originalUrl,
        });

        // Gère les erreurs spécifiques ou génériques
        if (error instanceof ErrorResponse) {
          return res.status(error.statusCode).json({
            success: false,
            error: {
              code: error.code,
              message: error.message,
            },
          });
        }
        res.status(500).json({
          success: false,
          error: {
            code: 'AUTHORIZATION_ERROR',
            message: 'Une erreur interne est survenue lors de la vérification des permissions.',
          },
        });
      }
    };
  };

  /**
   * Génère un token JWT pour un utilisateur donné.
   * @param {Object} user - L'objet utilisateur pour lequel générer le token (doit contenir userId et userRole).
   * @returns {string} Le token JWT généré.
   * @throws {ErrorResponse} Si la clé secrète JWT est manquante dans les variables d'environnement.
   */
  static generateToken(user) {
    if (!process.env.JWT_SECRET) {
      logger.error('Clé secrète JWT manquante dans les variables d\'environnement.', {});
      throw new ErrorResponse('Configuration JWT invalide.', 500, {
        code: 'JWT_CONFIG_ERROR',
        message: 'Clé secrète JWT (JWT_SECRET) manquante. Veuillez configurer vos variables d\'environnement.',
      });
    }

    // Signe le token avec les informations de l'utilisateur et la clé secrète
    return jwt.sign(
      {
        userId: user.userId,
        userRole: user.userRole,
        iss: process.env.JWT_ISSUER || 'scolarix-api', // Émetteur du token
        aud: process.env.JWT_AUDIENCE || 'scolarix-client', // Audience du token
      },
      process.env.JWT_SECRET,
      {
        expiresIn: process.env.JWT_EXPIRES_IN || '1d', // Durée de validité du token (ex: '1d', '8h')
        algorithm: 'HS256', // Algorithme de signature
      }
    );
  }
}

export default AuthMiddleware;
