import { DataTypes } from 'sequelize';
import Schema from '../Configs/model.js'; // Ensure the path is correct

/**
 * @class Ecole
 * @extends Schema
 * @description Modèle pour gérer les informations des écoles.
 */
class Ecole extends Schema {
  /**
   * Initialise le modèle Ecole avec ses attributs et options.
   * @param {import('sequelize').Sequelize} sequelize - L'instance Sequelize connectée.
   */
  static init(sequelize) {
    super.init(
      {
        ecoleId: {
          type: DataTypes.STRING(10),
          primaryKey: true,
          allowNull: false, // Primary key should not be null
          validate: {
            is: /^EC[0-9]{3}$/, // Matches CHECK constraint, e.g., "EC001"
          },
          field: 'ecole_id', // Database column name
        },
        ecoleName: {
          type: DataTypes.STRING(100),
          allowNull: false,
          unique: true, // School names should generally be unique
          field: 'ecole_name',
        },
        iep: {
          type: DataTypes.STRING(200),
          allowNull: true, // Assuming this can be optional
          // Consider adding a unique constraint if IEP values are unique across all schools
        },
        ville: {
          type: DataTypes.STRING(50),
          allowNull: true, // Assuming this can be optional
        },
        // createdAt, updatedAt, and deletedAt are handled by the Schema class
      },
      {
        sequelize,
        modelName: 'Ecole',
        tableName: 'ecoles',
        // The 'ecole_id' index is redundant as it's the primary key and automatically indexed.
        // timestamps, paranoid, underscored, normalizeStrings are handled by default by the Schema class
      }
    );
  }

  /**
   * Définit les associations pour le modèle Ecole.
   * @param {Object} models - An object containing all application models.
   * @param {import('./User.js').default} models.User - The User model.
   * @param {import('./Classe.js').default} models.Classe - The Classe model.
   * @param {import('./Eleve.js').default} models.Eleve - The Eleve model.
   */
  static associate(models) {
    // An Ecole can have many Users (e.g., teachers, administrators)
    this.hasMany(models.User, {
      foreignKey: 'ecoleId', // Foreign key in the 'users' table
      sourceKey: 'ecoleId',  // Primary key in the 'ecoles' table
      onDelete: 'RESTRICT',  // Prevent deletion of an Ecole if Users are linked
      as: 'users',           // Alias for eager loading: Ecole.findOne({ include: 'users' })
    });

    // An Ecole can have many Classes
    this.hasMany(models.Classe, {
      foreignKey: 'ecoleId', // Foreign key in the 'classes' table (as refined in Classe model)
      sourceKey: 'ecoleId',
      onDelete: 'RESTRICT',  // Prevent deletion of an Ecole if Classes are linked
      as: 'classes',         // Alias for eager loading: Ecole.findOne({ include: 'classes' })
    });

    // An Ecole can have many Eleves (students)
    this.hasMany(models.Eleve, {
      foreignKey: 'ecoleId', // Foreign key in the 'eleves' table
      sourceKey: 'ecoleId',
      onDelete: 'RESTRICT',  // Prevent deletion of an Ecole if Eleves are linked
      as: 'eleves',          // Alias for eager loading: Ecole.findOne({ include: 'eleves' })
    });

    // Call the parent Schema's associate method.
    super.associate(models);
  }
}

export default Ecole;