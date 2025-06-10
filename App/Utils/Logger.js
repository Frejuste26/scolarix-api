import winston from 'winston';
import chalk from 'chalk';
import { fileURLToPath } from 'url';
import path from 'path';
import DailyRotateFile from 'winston-daily-rotate-file';

// Résolution des chemins pour les modules ES (ESM)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * @class LoggerService
 * @description Une classe qui encapsule la configuration de Winston pour un logger singleton.
 */
class LoggerService {
    constructor(options = {}) {
        this.env = process.env.NODE_ENV || 'development';

        this.options = {
            logLevel: options.logLevel || process.env.LOG_LEVEL || 'debug',
            logDir: options.logDir || path.join(__dirname, '../logs'),
            maxFileSize: options.maxFileSize || '20m',
            maxFiles: options.maxFiles || '30d',
            ignoreRoutes: options.ignoreRoutes || ['/favicon.ico', '/health'],
            enableRemoteTransport: options.enableRemoteTransport || false,
        };

        this.logColors = {
            fatal: 'magenta', error: 'red', warn: 'yellow',
            success: 'greenBright', info: 'green',
            http: 'cyan', debug: 'blue'
        };

        this.logEmojis = {
            fatal: '💥', error: '❌', warn: '⚠️',
            success: '✅', info: 'ℹ️',
            http: '🌐', debug: '🐛'
        };

        // Définition des niveaux de log personnalisés pour Winston
        this.logLevels = {
            fatal: 0, error: 1, warn: 2, success: 3, info: 4, http: 5, debug: 6
        };

        // Format pour la console (avec couleurs et emojis)
        const consoleFormat = winston.format.combine(
            winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            winston.format.printf(({ level, message, timestamp, stack, ...metadata }) => {
                const color = chalk[this.logColors[level]] || chalk.white;
                const emoji = this.logEmojis[level] || '';
                let logMessage = `${chalk.gray(timestamp)} ${color.bold(level.toUpperCase())} ${emoji} ${message}`;
                if (stack) logMessage += `\n${chalk.gray(stack)}`; // Affiche la stack trace en gris
                if (Object.keys(metadata).length > 0) {
                    logMessage += ` ${chalk.whiteBright(JSON.stringify(metadata))}`; // Affiche les métadonnées
                }
                return logMessage;
            })
        );

        // Format pour les fichiers (JSON)
        const fileFormat = winston.format.combine(
            winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            winston.format.errors({ stack: true }), // Inclut la stack trace pour les erreurs
            winston.format.json()
        );

        const transports = [];

        // Les logs en mode test sont désactivés pour éviter le bruit dans les tests unitaires
        if (this.env !== 'test') {
            transports.push(
                new winston.transports.Console({
                    format: consoleFormat,
                    level: this.options.logLevel,
                    // Active les couleurs pour la console si l'environnement le permet
                    handleExceptions: true // Capture les exceptions non gérées
                }),
                new DailyRotateFile({
                    filename: path.join(this.options.logDir, 'application-%DATE%.log'),
                    datePattern: 'YYYY-MM-DD',
                    zippedArchive: true,
                    maxSize: this.options.maxFileSize,
                    maxFiles: this.options.maxFiles,
                    format: fileFormat,
                    level: 'info' // Niveau info et supérieur pour le fichier principal
                }),
                new DailyRotateFile({
                    filename: path.join(this.options.logDir, 'error-%DATE%.log'),
                    datePattern: 'YYYY-MM-DD',
                    zippedArchive: true,
                    maxSize: this.options.maxFileSize,
                    maxFiles: '90d', // Garde les logs d'erreur plus longtemps
                    format: fileFormat,
                    level: 'error' // Niveau error et supérieur pour le fichier d'erreurs
                })
            );

            // Ajout optionnel d'un transport distant (ex: pour un service de log centralisé)
            if (this.options.enableRemoteTransport && process.env.REMOTE_LOG_HOST) {
                transports.push(new winston.transports.Http({
                    host: process.env.REMOTE_LOG_HOST,
                    path: process.env.REMOTE_LOG_PATH || '/api/logs',
                    port: parseInt(process.env.REMOTE_LOG_PORT || '443', 10),
                    ssl: process.env.REMOTE_LOG_SSL === 'true',
                    level: 'warn', // N'envoie que les avertissements et erreurs au serveur distant
                    format: fileFormat,
                }));
            }
        }

        // Crée l'instance principale du logger Winston
        this.winstonLogger = winston.createLogger({
            level: this.options.logLevel,
            levels: this.logLevels, // Applique les niveaux personnalisés
            transports: transports,
            exceptionHandlers: transports, // Utilise les mêmes transports pour les exceptions
            rejectionHandlers: transports, // Utilise les mêmes transports pour les rejets de promesses
            exitOnError: false, // Ne quitte pas le processus en cas d'erreur non gérée (laisse app.js gérer)
        });

        // Crée un logger séparé pour les logs HTTP (accès)
        this.httpLogger = winston.createLogger({
            level: 'http',
            levels: this.logLevels,
            transports: [
                new DailyRotateFile({
                    filename: path.join(this.options.logDir, 'access-%DATE%.log'),
                    datePattern: 'YYYY-MM-DD',
                    zippedArchive: true,
                    maxSize: this.options.maxFileSize,
                    maxFiles: this.options.maxFiles,
                    format: fileFormat
                })
            ],
            exitOnError: false,
        });
    }

    /**
     * Retourne le logger Winston principal.
     * @returns {winston.Logger} L'instance du logger Winston.
     */
    getLoggerInstance() {
        return this.winstonLogger;
    }

    /**
     * Méthode pour le middleware Express pour logger les requêtes HTTP.
     * @returns {Function} Middleware Express.
     */
    expressLogger() {
        return (req, res, next) => {
            if (this.options.ignoreRoutes.includes(req.path)) {
                return next();
            }

            const start = Date.now();

            res.on('finish', () => {
                const duration = Date.now() - start;
                const logData = {
                    method: req.method,
                    url: req.originalUrl,
                    status: res.statusCode,
                    duration: `${duration}ms`,
                    ip: req.ip,
                    userId: req.auth?.userId || 'guest', // Ajoute l'ID utilisateur si authentifié
                    userAgent: req.get('user-agent'),
                    contentLength: res.get('content-length') || '0',
                    referrer: req.get('referer') || ''
                };

                if (res.statusCode >= 500) {
                    this.winstonLogger.error('HTTP Error', logData);
                } else if (res.statusCode >= 400) {
                    this.winstonLogger.warn('HTTP Warning', logData);
                } else {
                    this.httpLogger.http('HTTP Access', logData);
                }
            });

            // Gère les erreurs asynchrones dans les middlewares Express
            Promise.resolve(next()).catch(next);
        };
    }

    /**
     * Log une requête de base de données.
     * @param {string} query - La requête SQL ou description de l'opération.
     * @param {number} duration - La durée de l'exécution en ms.
     * @param {Object} [context={}] - Contexte supplémentaire.
     */
    logDatabaseQuery(query, duration, context = {}) {
        this.winstonLogger.debug(`[DB] ${query} | Duration: ${duration}ms`, {
            timestamp: new Date().toISOString(),
            ...context
        });
    }

    /**
     * Log une erreur avec un contexte détaillé.
     * @param {Error} error - L'objet erreur.
     * @param {Object} [context={}] - Contexte supplémentaire.
     */
    logErrorWithContext(error, context = {}) {
        this.winstonLogger.error(`${error.message}`, {
            stack: error.stack,
            ...context
        });
    }

    // Méthodes de raccourci pour les niveaux de log
    info(message, context = {}) {
        this.winstonLogger.info(message, context);
    }

    debug(message, context = {}) {
        this.winstonLogger.debug(message, context);
    }

    warn(message, context = {}) {
        this.winstonLogger.warn(message, context);
    }

    error(message, context = {}) {
        this.winstonLogger.error(message, context);
    }

    fatal(message, context = {}) {
        this.winstonLogger.log('fatal', message, context);
        // Supprimé le process.exit(1) ici. C'est à l'appelant de décider de quitter le processus.
    }

    success(message, context = {}) {
        this.winstonLogger.log('success', message, context);
    }

    http(message, context = {}) {
        this.httpLogger.http(message, context);
    }
}

// Crée une instance unique de la classe LoggerService
const loggerInstance = new LoggerService();

// Exporte directement l'instance du logger Winston pour une utilisation facile
// dans toute l'application.
export default loggerInstance.winstonLogger;
