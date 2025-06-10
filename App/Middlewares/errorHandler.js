/**
 * Middleware de gestion centralisée des erreurs
 * @param {*} logger - instance du logger (ex: winston, pino)
 * @returns {(err, req, res, next) => void}
 */
export function createErrorHandler(logger) {
    return function errorHandler(err, req, res, next) {
      let statusCode = err.statusCode || 500;
      let message = err.message || 'Erreur serveur interne';
  
      // Log détaillé de l'erreur
      logger.error(`Erreur détectée : ${message}`, {
        stack: err.stack,
        url: req.originalUrl,
        method: req.method,
        body: req.body,
        params: req.params,
        query: req.query,
      });
  
      // === Gestion des erreurs Sequelize ===
      if (err.name === 'SequelizeValidationError') {
        statusCode = 422;
        const errors = err.errors.map(e => e.message);
        message = `Erreur de validation : ${errors.join(', ')}`;
      }
  
      else if (err.name === 'SequelizeUniqueConstraintError') {
        statusCode = 409;
        const fields = err.errors.map(e => e.path).join(', ');
        message = `Conflit : Valeur déjà utilisée pour le(s) champ(s) : ${fields}`;
      }
  
      else if (err.name === 'SequelizeDatabaseError') {
        statusCode = 400;
        message = `Erreur de base de données : ${err.message}`;
      }
  
      else if (err.name === 'SequelizeForeignKeyConstraintError') {
        statusCode = 409;
        message = 'Erreur de contrainte : Relation non respectée';
      }
  
      else if (err.name === 'UnauthorizedError') {
        statusCode = 401;
        message = 'Non autorisé : Accès refusé';
      }
  
      // Erreur interne serveur
      if (statusCode >= 500) {
        message = 'Une erreur interne est survenue. Veuillez réessayer plus tard.';
      }
  
      res.status(statusCode).json({
        success: false,
        message,
        error: {
          code: statusCode,
          ...(process.env.NODE_ENV === 'development' && { details: err.stack }),
        },
      });
    };
  }
  