import { Sequelize } from "sequelize";
import dotenv from "dotenv";
import logger from '../Utils/Logger.js';
import ErrorResponse from "../Utils/errorResponse.js";

dotenv.config();

class Database {
  static sequelize = null;

  /**
   * Initialise la connexion à la base de données avec Sequelize.
   * @returns {Promise<Sequelize>} L'instance Sequelize connectée.
   * @throws {ErrorResponse} Si la connexion échoue ou si la configuration est incomplète.
   */
  static async start() {
    const requiredEnv = ['DB_NAME', 'DB_USER', 'DB_PASS', 'DB_HOST'];
    const missingEnv = requiredEnv.filter(env => !process.env[env]);
    if (missingEnv.length > 0) {
      logger.error('❌ Variables d\'environnement manquantes', { missing: missingEnv });
      throw new ErrorResponse('Configuration de la base de données incomplète', 500, {
        code: 'DB_CONFIG_ERROR',
        missing: missingEnv,
      });
    }

    if (!this.sequelize) {
      this.sequelize = new Sequelize(
        process.env.DB_NAME,
        process.env.DB_USER,
        process.env.DB_PASS,
        {
          host: process.env.DB_HOST,
          dialect: process.env.DB_DIALECT || "postgres",
          logging: process.env.DB_LOGGING === 'true' ? (msg) => logger.debug(msg) : false,
          pool: {
            max: parseInt(process.env.DB_POOL_MAX) || 10,
            min: parseInt(process.env.DB_POOL_MIN) || 0,
            acquire: parseInt(process.env.DB_POOL_ACQUIRE) || 30000,
            idle: parseInt(process.env.DB_POOL_IDLE) || 10000,
          },
        }
      );
    }

    try {
      await this.sequelize.authenticate();
      logger.info(`✅ Connexion réussie à la base de données [${process.env.DB_NAME}] sur [${process.env.DB_HOST}] avec l'utilisateur [${process.env.DB_USER}]`);
      
      if (process.env.DB_SYNC === 'true') {
        await this.sequelize.sync({ force: process.env.DB_SYNC_FORCE === 'true' });
        logger.info('🛠️ Modèles synchronisés avec la base de données.');
      }
      
      return this.sequelize;
    } catch (error) {
      logger.error("❌ Erreur lors de la connexion à la base de données", {
        message: error.message,
        stack: error.stack,
      });
      throw new ErrorResponse("Impossible de se connecter à la base de données", 500, {
        code: "DB_CONN_ERROR",
        details: {
          dbName: process.env.DB_NAME,
          host: process.env.DB_HOST,
        },
      });
    }
  }

  /**
   * Récupère l'instance Sequelize active.
   * @returns {Sequelize} L'instance Sequelize active.
   * @throws {Error} Si la base de données n'est pas initialisée.
   */
  static getInstance() {
    if (!this.sequelize) {
      throw new Error("La base de données n'est pas initialisée. Appelle `Database.start()` d'abord.");
    }
    return this.sequelize;
  }

  /**
   * Ferme la connexion à la base de données.
   * @throws {ErrorResponse} Si la fermeture échoue.
   */
  static async close() {
    if (this.sequelize) {
      try {
        await this.sequelize.close();
        logger.info("🔌 Connexion à la base de données fermée.");
        this.sequelize = null; // Réinitialisation
      } catch (error) {
        logger.error("❌ Erreur lors de la fermeture de la base de données", {
          message: error.message,
          stack: error.stack,
        });
      }
    }
  }
}

export default Database;