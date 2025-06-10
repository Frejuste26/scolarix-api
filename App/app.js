import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { errors } from 'celebrate'; // Pour la gestion des erreurs de validation Joi/Celebrate
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import responseTime from 'response-time';
import cluster from 'cluster';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

// Importe l'instance unique du Logger, pas la classe
import logger from './Utils/Logger.js';
import { createErrorHandler } from './Middlewares/errorHandler.js';
// Importe la fonction d'initialisation des modèles et l'objet 'db'
import { initializeModels } from './Models/index.js';
import Database from './Configs/database.js'; // Importe la classe Database pour ses méthodes utilitaires (ping, disconnect)
import apiRoutes from './Routes/api.js';

// Résolution des chemins pour les modules ES (ESM)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Chargement des variables d'environnement
dotenv.config();

// Configuration des constantes de l'application
const PORT = process.env.APP_PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const ENABLE_CLUSTER = process.env.ENABLE_CLUSTER === 'true';

/**
 * @class App
 * @description Classe principale de l'application Express, gérant la configuration,
 * les middlewares, les routes, la gestion des erreurs et le démarrage du serveur/cluster.
 */
class App {
  constructor() {
    this.app = express();
    this.port = PORT;
    this.env = NODE_ENV;
    // this.db est utilisé pour les méthodes ping/disconnect, mais l'initialisation principale
    // de Sequelize est gérée par initializeModels().
    this.dbInstance = new Database(); // Renommé pour éviter la confusion avec l'objet 'db' des modèles

    // Initialise les configurations, middlewares, routes et gestionnaires d'erreurs
    this.Configs();
    this.Middlewares();
    this.Routes();
    this.Errors();
  }

  /**
   * Configure les paramètres globaux de l'application Express.
   */
  Configs() {
    if (this.env === 'production') {
      this.app.set('trust proxy', 1); // Nécessaire si l'application est derrière un proxy (ex: Nginx, Heroku)
      logger.info('Mode production: Trust proxy activé.');
    }

    // Configuration du moteur de template Pug
    this.app.set('view engine', 'pug');
    this.app.set('views', path.join(__dirname, 'Views'));
    logger.info('Moteur de template Pug configuré.');

    // Configuration du dossier des fichiers statiques
    this.app.use(express.static(path.join(__dirname, 'Public')));
    logger.info('Dossier statique "Public" configuré.');
  }

  /**
   * Charge et configure les middlewares Express.
   */
  Middlewares() {
    // Sécurité: Helmet pour sécuriser les en-têtes HTTP
    this.app.use(helmet());
    logger.debug('Middleware Helmet chargé.');

    // CORS: Cross-Origin Resource Sharing
    this.app.use(cors(this._getCorsConfig()));
    logger.debug('Middleware CORS configuré.');

    // Logging: Morgan pour les logs des requêtes HTTP
    // Utilise le transport HTTP du logger pour les logs de Morgan
    this.app.use(morgan('combined', {
      stream: { write: (message) => logger.http(message.trim()) } // Utilise logger.http directement
    }));
    // Middleware de log personnalisé (si votre Logger.js le fournit)
    // Assurez-vous que votre Logger.js a une méthode expressLogger() si vous l'utilisez.
    // this.app.use(logger.expressLogger()); // <-- Cette ligne était commentée, donc pas de problème ici
    logger.debug('Middlewares de logging configurés.');

    // Limiteur de requêtes: express-rate-limit pour prévenir les attaques par déni de service
    this.app.use(rateLimit(this._getRateLimitConfig()));
    logger.debug('Middleware de limitation de débit chargé.');

    // Performance: Compression pour compresser les réponses HTTP
    this.app.use(compression(this._getCompressionConfig()));
    // Performance: response-time pour ajouter un en-tête X-Response-Time
    this.app.use(responseTime());
    logger.debug('Middlewares de performance chargés.');

    // Analyse du corps des requêtes (JSON et URL-encoded)
    this.app.use(express.json(this._getBodyParserConfig()));
    this.app.use(express.urlencoded({ extended: true }));
    logger.debug('Middlewares d\'analyse du corps des requêtes chargés.');

    // Servir les fichiers statiques du répertoire 'uploads' (si vous en avez un)
    // Assurez-vous que le dossier 'uploads' est au même niveau que 'app.js'
    this.app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
    logger.debug('Service de fichiers statiques pour /uploads configuré.');

    // Endpoint de vérification de l'état de santé de l'application
    this.app.get('/health', (req, res) => this._healthCheck(req, res));
    logger.debug('Endpoint de vérification de l\'état de santé configuré.');
  }

  /**
   * Charge les routes de l'API.
   */
  Routes() {
    // Routes de l'API principale
    this.app.use('/scolarix-api/v1', apiRoutes);
    logger.info('Routes de l\'API chargées.');

    // Gestionnaire 404 pour les routes non trouvées
    this.app.use(this._handleNotFound);
    logger.debug('Gestionnaire 404 configuré.');
  }

  /**
   * Configure les gestionnaires d'erreurs globaux et les écouteurs de processus.
   */
  Errors() {
    // Middleware pour gérer les erreurs de validation de Celebrate/Joi
    this.app.use(errors());
    // Middleware de gestion d'erreurs personnalisé
    this.app.use(createErrorHandler(logger));
    logger.debug('Middlewares de gestion d\'erreurs chargés.');

    // Gestion des rejets de promesses non gérés
    process.on('unhandledRejection', (reason, promise) => {
      logger.error(`Rejet de promesse non géré: ${reason}`, { promise, stack: reason instanceof Error ? reason.stack : 'N/A' });
      // En production, il est souvent recommandé de quitter le processus après un unhandledRejection
      // pour éviter un état imprévisible.
      if (this.env === 'production') {
        process.exit(1);
      }
    });

    // Gestion des exceptions non capturées
    process.on('uncaughtException', (error) => {
      logger.fatal(`Exception non capturée: ${error.message}`, { stack: error.stack });
      // Quitte le processus pour éviter un état corrompu, sauf si le clustering est activé
      // (où le master peut relancer les workers).
      if (!ENABLE_CLUSTER) {
        process.exit(1);
      }
    });
  }

  /**
   * Lance l'application, initialise la base de données et démarre le serveur ou le cluster.
   */
  async Launch() {
    try {
      // Initialise la base de données et charge tous les modèles Sequelize
      // C'est ici que la connexion DB et la synchronisation des modèles se produisent.
      await initializeModels();
      logger.info('Base de données connectée et modèles Sequelize initialisés.');

      if (ENABLE_CLUSTER && cluster.isPrimary) {
        this.runCluster();
        // server instance is not directly available in cluster primary
      } else {
        this.server = await this.runServer(); // Store the server instance
      }
    } catch (error) {
      logger.fatal('Échec du démarrage de l\'application en raison d\'une erreur critique.', {
        error: error.message,
        stack: error.stack
      });
      process.exit(1); // Arrête l'application en cas d'échec critique au démarrage
    }
  }

  /**
   * Démarre le serveur Express.
   * @returns {Promise<import('http').Server>} L'instance du serveur HTTP.
   */
  async runServer() {
    const server = this.app.listen(this.port, () => {
      logger.info(`🚀 Serveur démarré sur le port ${this.port}`, {
        environment: this.env,
        pid: process.pid,
        clusterWorker: cluster.isWorker ? cluster.worker.id : 'N/A'
      });
      this._setupGracefulShutdown(server);
    });
    return server;
  }

  /**
   * Démarre les workers du cluster.
   */
  runCluster() {
    const cpuCount = os.cpus().length;
    logger.info(`Démarrage du cluster avec ${cpuCount} workers.`);

    for (let i = 0; i < cpuCount; i++) {
      cluster.fork().on('error', (error) => {
        logger.error(`Échec du fork du worker de cluster: ${error.message}`, { stack: error.stack });
      });
    }

    cluster.on('exit', (worker, code, signal) => {
      logger.warn(`Worker ${worker.process.pid} est mort. Code: ${code}, Signal: ${signal}.`, {
        pid: worker.process.pid,
        date: new Date().toISOString()
      });
      // Relance un nouveau worker pour remplacer celui qui est mort
      cluster.fork();
      logger.info('Nouveau worker lancé pour remplacer le worker mort.');
    });
  }

  /**
   * Configure l'arrêt gracieux du serveur.
   * @param {import('http').Server} server - L'instance du serveur HTTP.
   */
  _setupGracefulShutdown(server) {
    const shutdownSignals = ['SIGTERM', 'SIGINT', 'SIGQUIT'];
    const shutdownTimeout = 30000; // 30 secondes

    shutdownSignals.forEach(signal => {
      process.on(signal, async () => {
        logger.info(`Signal ${signal} reçu, arrêt gracieux du serveur...`);

        const timeout = setTimeout(() => {
          logger.error('Délai d\'arrêt gracieux dépassé, sortie forcée.');
          process.exit(1);
        }, shutdownTimeout);

        try {
          // Ferme le serveur HTTP, empêchant de nouvelles connexions
          await new Promise((resolve, reject) => {
            server.close((err) => (err ? reject(err) : resolve()));
          });
          logger.info('Serveur HTTP fermé.');

          // Déconnecte la base de données
          await this.dbInstance.disconnect(); // Utilise dbInstance pour la déconnexion
          logger.info('Connexion à la base de données fermée.');

          logger.info('Serveur arrêté avec succès.');
          clearTimeout(timeout);
          process.exit(0); // Quitte le processus avec succès
        } catch (error) {
          logger.error('Erreur lors de l\'arrêt gracieux du serveur.', {
            error: error.message,
            stack: error.stack
          });
          clearTimeout(timeout);
          process.exit(1); // Quitte le processus avec une erreur
        }
      });
    });
  }

  /**
   * Configure les options CORS.
   * @returns {cors.CorsOptions} Options de configuration CORS.
   */
  _getCorsConfig() {
    const origins = this.env === 'development'
      ? '*' // Autorise toutes les origines en développement
      : (process.env.ALLOWED_ORIGINS?.split(',').filter(Boolean) || []); // Liste d'origines autorisées en production
    if (this.env === 'production' && (!origins || origins.length === 0 || origins[0] === '*')) {
      logger.warn('Aucune origine autorisée (ALLOWED_ORIGINS) spécifiée en production ou configuration non sécurisée (*).');
    }
    return {
      origin: origins,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true
    };
  }

  /**
   * Configure les options de limitation de débit.
   * @returns {rateLimit.Options} Options de configuration de limitation de débit.
   */
  _getRateLimitConfig() {
    return {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: this.env === 'development' ? 1000 : 200, // Max 1000 requêtes/15min en dev, 200 en prod
      message: 'Trop de requêtes depuis cette adresse IP, veuillez réessayer plus tard.',
      // Permet de sauter la limitation pour certaines IPs (ex: localhost)
      skip: (req) => ['::1', '127.0.0.1'].includes(req.ip)
    };
  }

  /**
   * Configure les options de compression.
   * @returns {compression.CompressionOptions} Options de configuration de compression.
   */
  _getCompressionConfig() {
    return {
      level: 6, // Niveau de compression (0-9)
      threshold: 10240, // Seuil en octets (10KB) avant de compresser
      filter: (req, res) => {
        if (req.headers['x-no-compression']) return false; // Permet de désactiver la compression via un en-tête
        return compression.filter(req, res); // Utilise le filtre par défaut de compression
      }
    };
  }

  /**
   * Configure les options d'analyse du corps de la requête JSON.
   * @returns {express.json.Options} Options de configuration d'analyse JSON.
   */
  _getBodyParserConfig() {
    return {
      limit: '10mb', // Limite la taille du corps de la requête
      // Option pour stocker le corps brut de la requête, utile pour les signatures ou le débogage
      verify: (req, res, buf) => {
        req.rawBody = buf.toString();
      }
    };
  }

  /**
   * Effectue une vérification de l'état de santé de l'application et de la base de données.
   * @param {import('express').Request} req - Objet requête Express.
   * @param {import('express').Response} res - Objet réponse Express.
   */
  async _healthCheck(req, res) {
    let dbStatus = 'UP';
    try {
      // Tente de pinger la base de données pour vérifier la connexion
      await this.dbInstance.ping(); // Assurez-vous que votre classe Database a une méthode ping()
    } catch (error) {
      dbStatus = 'DOWN';
      logger.error('Échec de la vérification de l\'état de santé de la base de données.', { error: error.message });
    }

    const health = {
      status: dbStatus === 'UP' ? 'UP' : 'DEGRADED', // L'application est dégradée si la DB est DOWN
      timestamp: new Date().toISOString(),
      environment: this.env,
      uptime: process.uptime(), // Temps depuis le démarrage du processus
      memory: process.memoryUsage(), // Utilisation de la mémoire
      database: dbStatus
    };

    logger.debug('Vérification de l\'état de santé effectuée.', { health });
    res.status(200).json(health);
  }

  /**
   * Gère les requêtes pour les routes non trouvées (404).
   * @param {import('express').Request} req - Objet requête Express.
   * @param {import('express').Response} res - Objet réponse Express.
   */
  _handleNotFound(req, res) {
    const errorInfo = {
      path: req.originalUrl,
      method: req.method,
      ip: req.ip,
      timestamp: new Date().toISOString()
    };

    logger.warn('Ressource non trouvée (404 Not Found).', errorInfo);
    res.status(404).json({
      success: false,
      error: {
        code: 404,
        message: 'La ressource demandée n\'a pas été trouvée.',
        ...errorInfo
      }
    });
  }
}

export default App;
