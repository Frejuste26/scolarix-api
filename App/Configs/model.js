import { Model, DataTypes } from "sequelize"; // Ajout de DataTypes pour les JSDoc
import ErrorResponse from "../Utils/errorResponse.js";
import logger from '../Utils/Logger.js';

class Schema extends Model {
  /**
   * Initialise un modèle avec des options enrichies.
   * @param {Object} attributes - Les colonnes du modèle, avec leurs types et contraintes (ex. { name: { type: DataTypes.STRING, allowNull: false } }).
   * @param {Object} options - Les options de configuration.
   * @param {Sequelize} options.sequelize - L'instance Sequelize requise.
   * @param {string} [options.modelName] - Le nom du modèle, déduit de la classe si non fourni.
   * @param {boolean} [options.timestamps=true] - Active ou désactive les champs createdAt/updatedAt.
   * @param {boolean} [options.paranoid=true] - Active ou désactive le soft delete avec deletedAt.
   * @param {boolean} [options.underscored=true] - Utilise snake_case pour les noms de colonnes.
   * @param {boolean} [options.normalizeStrings=true] - Normalise les champs de type string (trim).
   * @throws {ErrorResponse} Si la configuration est invalide.
   */
  static init(attributes, options) {
    if (!options || !options.sequelize) {
      throw new ErrorResponse("L'instance Sequelize est requise dans les options", 500, {
        code: "MODEL_CONFIG_ERROR",
        details: "Missing sequelize instance in model options",
      });
    }
    if (!attributes || Object.keys(attributes).length === 0) {
      throw new ErrorResponse("Les attributs du modèle sont requis", 500, {
        code: "MODEL_CONFIG_ERROR",
        details: "Model attributes cannot be empty",
      });
    }

    super.init(attributes, {
      ...options,
      sequelize: options.sequelize,
      timestamps: options.timestamps !== undefined ? options.timestamps : true,
      paranoid: options.paranoid !== undefined ? options.paranoid : true,
      underscored: options.underscored !== undefined ? options.underscored : true,
      modelName: options.modelName || this.name,
    });

    // Hook global optionnel pour normaliser les champs de type string
    // Appliqué sur la création et la mise à jour pour une meilleure cohérence
    if (options.normalizeStrings !== false) {
      this.addHook('beforeValidate', (instance) => { // Utilisez beforeValidate pour s'assurer que le trim est fait avant la validation
        for (const attributeName in this.rawAttributes) {
          const attribute = this.rawAttributes[attributeName];
          if (attribute.type instanceof DataTypes.STRING && instance.dataValues[attributeName] !== undefined) {
            if (typeof instance.dataValues[attributeName] === 'string') {
              instance.dataValues[attributeName] = instance.dataValues[attributeName].trim();
            }
          }
        }
      });
    }
  }

  /**
   * Point d’entrée pour déclarer les associations entre modèles.
   * @param {Object} models - Un objet contenant tous les modèles (ex. { User, Post }).
   * @throws {ErrorResponse} Si les associations ne sont pas définies ou si models est invalide.
   */
  static associate(models) {
    if (!models || Object.keys(models).length === 0) {
      throw new ErrorResponse("Les modèles pour les associations sont requis", 500, {
        code: "MODEL_ASSOC_ERROR",
        details: "Invalid or empty models object for associations",
      });
    }
    // À surcharger dans les sous-classes pour définir les associations
    // Exemple : this.hasMany(models.Post, { foreignKey: 'schemaId' });

    // Ajout d'un log si la méthode associate n'est pas surchargée et appelée
    if (this.prototype.associate === Schema.prototype.associate && process.env.NODE_ENV !== 'production') {
      logger.warn(`⚠️ La méthode 'associate' n'a pas été surchargée pour le modèle '${this.name}'. Aucune association ne sera définie pour ce modèle.`);
    }
  }
}

export default Schema;