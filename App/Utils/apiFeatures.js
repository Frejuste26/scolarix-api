import { Op } from 'sequelize';
import logger from './Logger.js'; // Importe l'instance unique du logger

/**
 * @class APIFeatures
 * @description Classe utilitaire pour construire des requêtes Sequelize complexes
 * basées sur les paramètres de requête HTTP (search, filter, sort, limit fields, paginate).
 */
class APIFeatures {
  /**
   * @param {import('sequelize').ModelStatic<any>} model - Le modèle Sequelize sur lequel la requête sera exécutée.
   * @param {Object} queryString - L'objet `request.query` d'Express.
   * @param {Object} [options={}] - Options supplémentaires pour la configuration des fonctionnalités.
   * @param {string[]} [options.searchableFields=['username']] - Tableau des noms de champs du modèle sur lesquels la recherche doit être effectuée.
   * @param {boolean} [options.debug=false] - Active le mode débogage pour afficher des logs.
   * @param {string[]} [options.defaultExcludedAttributes=['password', 'deletedAt', 'createdAt', 'updatedAt']] - Attributs à exclure par défaut si 'fields' n'est pas spécifié.
   */
  constructor(model, queryString, options = {}) {
    this.model = model;
    this.queryString = queryString;
    this.query = { where: {} }; // Initialise l'objet de requête Sequelize
    this.options = {
      searchableFields: options.searchableFields || [], // Pas de valeur par défaut spécifique, les contrôleurs la fournissent
      debug: options.debug || false,
      defaultExcludedAttributes: options.defaultExcludedAttributes || ['password', 'deletedAt', 'createdAt', 'updatedAt'], // Attributs à exclure par défaut
    };
  }

  /**
   * Log un message de débogage si le mode débogage est activé.
   * @param {string} message - Le message de débogage.
   * @param {Object} [data={}] - Données supplémentaires à logger.
   */
  logDebug(message, data = {}) {
    if (this.options.debug) {
      logger.debug(`[APIFeatures DEBUG]: ${message}`, data);
    }
  }

  /**
   * Applique la fonctionnalité de recherche (texte libre) à la requête.
   * Utilise `Op.iLike` pour une recherche insensible à la casse.
   * @returns {APIFeatures} L'instance actuelle pour le chaînage.
   */
  search() {
    const keyword = this.queryString.keyword;
    if (keyword && this.options.searchableFields.length > 0) {
      const searchConditions = this.options.searchableFields.map((field) => ({
        [field]: { [Op.iLike]: `%${keyword}%` },
      }));
      this.query.where = { ...this.query.where, [Op.or]: searchConditions }; // Fusionne avec les conditions where existantes
      this.logDebug(`Search applied for keyword '${keyword}' on fields: ${this.options.searchableFields.join(', ')}`);
    }
    return this;
  }

  /**
   * Applique la fonctionnalité de filtrage basée sur les paramètres de requête.
   * Gère les opérateurs `gte`, `gt`, `lte`, `lt`, `in`, `ne`.
   * @returns {APIFeatures} L'instance actuelle pour le chaînage.
   */
  filter() {
    const queryObj = { ...this.queryString };

    // Liste des champs à exclure du filtrage direct (car ils sont gérés par d'autres méthodes)
    const excludedFields = ['page', 'sort', 'limit', 'fields', 'keyword'];
    excludedFields.forEach((el) => delete queryObj[el]);

    const whereConditions = {};
    for (const [key, value] of Object.entries(queryObj)) {
      if (typeof value === 'string') {
        if (value.includes('gte')) {
          whereConditions[key] = { [Op.gte]: parseFloat(value.replace('gte', '')) };
        } else if (value.includes('gt')) {
          whereConditions[key] = { [Op.gt]: parseFloat(value.replace('gt', '')) };
        } else if (value.includes('lte')) {
          whereConditions[key] = { [Op.lte]: parseFloat(value.replace('lte', '')) };
        } else if (value.includes('lt')) {
          whereConditions[key] = { [Op.lt]: parseFloat(value.replace('lt', '')) };
        } else if (value.includes('in')) {
          whereConditions[key] = { [Op.in]: value.replace('in', '').split(',') };
        } else if (value.includes('ne')) {
          // Pour 'ne', si la valeur contient des virgules, la traiter comme une liste de valeurs à exclure
          const neValues = value.replace('ne', '').split(',');
          whereConditions[key] = { [Op.notIn]: neValues }; // Utilise Op.notIn pour exclure plusieurs valeurs
        } else {
          // Correspondance exacte par défaut
          whereConditions[key] = value;
        }
      } else {
        // Pour les valeurs non-string (ex: nombres, booléens)
        whereConditions[key] = value;
      }
    }

    this.query.where = { ...this.query.where, ...whereConditions }; // Fusionne avec les conditions where existantes
    this.logDebug(`Filter applied: ${JSON.stringify(whereConditions)}`);
    return this;
  }

  /**
   * Applique la fonctionnalité de tri à la requête.
   * @returns {APIFeatures} L'instance actuelle pour le chaînage.
   */
  sort() {
    if (this.queryString.sort) {
      const sortBy = this.queryString.sort.split(',').map((field) => {
        const direction = field[0] === '-' ? 'DESC' : 'ASC';
        const fieldName = field[0] === '-' ? field.slice(1) : field;
        return [fieldName, direction];
      });
      this.query.order = sortBy;
      this.logDebug(`Sort applied: ${JSON.stringify(sortBy)}`);
    } else {
      // Tri par défaut par 'createdAt' (correspondant à 'created_at' en DB)
      this.query.order = [['createdAt', 'DESC']];
      this.logDebug('Default sort applied: createdAt DESC');
    }
    return this;
  }

  /**
   * Applique la fonctionnalité de limitation de champs (sélection d'attributs) à la requête.
   * @returns {APIFeatures} L'instance actuelle pour le chaînage.
   */
  limitFields() {
    if (this.queryString.fields) {
      const fields = this.queryString.fields.split(',').map((f) => f.trim());
      this.query.attributes = fields;
      this.logDebug(`Fields limited to: ${fields.join(', ')}`);
    } else {
      // Exclut les champs sensibles et les champs de timestamp par défaut
      this.query.attributes = { exclude: this.options.defaultExcludedAttributes };
      this.logDebug(`Excluded fields by default: ${this.options.defaultExcludedAttributes.join(', ')}`);
    }
    return this;
  }

  /**
   * Applique la fonctionnalité de pagination à la requête.
   * @param {number} resPerPage - Le nombre de résultats par page par défaut.
   * @returns {APIFeatures} L'instance actuelle pour le chaînage.
   */
  paginate(resPerPage) {
    const page = Math.max(parseInt(this.queryString.page, 10) || 1, 1); // La page doit être au moins 1
    // La limite ne doit pas dépasser une valeur maximale raisonnable (ex: 1000)
    const limit = Math.min(parseInt(this.queryString.limit, 10) || resPerPage, 1000);
    const offset = (page - 1) * limit;

    this.query.offset = offset;
    this.query.limit = limit;
    this.logDebug(`Pagination applied: page=${page}, limit=${limit}, offset=${offset}`);
    return this;
  }

  /**
   * Exécute la requête Sequelize construite.
   * @returns {Promise<Array<any>>} Une promesse qui résout en un tableau d'enregistrements.
   */
  async execute() {
    return this.model.findAll(this.query);
  }
}

export default APIFeatures;
