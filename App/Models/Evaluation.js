import { DataTypes } from 'sequelize';
import Schema from '../Configs/model.js'; // Assurez-vous que le chemin est correct

/**
 * @class Evaluation
 * @extends Schema
 * @description Modèle pour gérer les types d'évaluations (examens, devoirs) et leurs coefficients.
 */
class Evaluation extends Schema {
  /**
   * Initialise le modèle Evaluation avec ses attributs et options.
   * @param {import('sequelize').Sequelize} sequelize - L'instance Sequelize connectée.
   */
  static init(sequelize) {
    super.init(
      {
        codeEva: {
          type: DataTypes.STRING(10),
          primaryKey: true,
          allowNull: false, // La clé primaire ne doit jamais être nulle
          unique: true,     // Un code d'évaluation doit être unique
          field: 'code_eva', // Nom de la colonne dans la base de données
        },
        nameEva: {
          type: DataTypes.STRING(50),
          allowNull: false,
          unique: true,     // Un nom d'évaluation devrait être unique (ex: "Examen Final", "Devoir Maison")
          field: 'name_eva',
        },
        coeficient: {
          type: DataTypes.FLOAT,
          allowNull: false,
          validate: {
            min: 0.01, // Le coefficient doit être supérieur à 0
            // Vous pourriez ajouter une validation pour un max si nécessaire, ex: max: 100
          },
        },
        // createdAt, updatedAt, et deletedAt sont gérés par la classe Schema
      },
      {
        sequelize,
        modelName: 'Evaluation',
        tableName: 'evaluations',
        // L'index sur la clé primaire 'code_eva' est implicite.
        // Un index sur 'name_eva' sera créé si 'unique: true' est utilisé.
      }
    );
  }

  /**
   * Définit les associations pour le modèle Evaluation.
   * @param {Object} models - Un objet contenant tous les modèles de l'application.
   * @param {import('./Note.js').default} models.Note - Le modèle Note.
   */
  static associate(models) {
    // Une évaluation peut être associée à plusieurs notes.
    this.hasMany(models.Note, {
      foreignKey: 'codeEva', // Clé étrangère dans la table 'notes' (renommé pour la cohérence)
      sourceKey: 'codeEva',  // Clé primaire dans la table 'evaluations'
      onDelete: 'RESTRICT',  // Empêche la suppression d'une évaluation si des notes y sont liées
      as: 'notes',           // Alias pour inclure facilement les notes lors des requêtes
    });

    // Appel de la méthode associate de la classe parente.
    super.associate(models);
  }
}

export default Evaluation;