import { DataTypes } from 'sequelize';
import Schema from '../Configs/model.js'; // Assurez-vous que le chemin est correct

/**
 * @class Classe
 * @extends Schema
 * @description Modèle pour gérer les classes au sein des écoles et des années scolaires.
 */
class Classe extends Schema {
  /**
   * Initialise le modèle Classe avec ses attributs et options.
   * @param {import('sequelize').Sequelize} sequelize - L'instance Sequelize connectée.
   */
  static init(sequelize) {
    super.init(
      {
        classeId: {
          type: DataTypes.STRING(10),
          primaryKey: true,
          allowNull: false, // Explicitly set as primary key, should not be null
          field: 'classe_id', // Database column name
        },
        libelle: {
          type: DataTypes.STRING(50),
          allowNull: false,
          unique: true, // Assuming class labels (e.g., "6ème A", "Terminal C") are unique across the system or at least within an academic year/school
        },
        niveau: {
          type: DataTypes.STRING(20), // E.g., "6ème", "Terminal"
          allowNull: false,
        },
        anneeCode: { // Renommé pour être cohérent avec AnneeScolaire (codeAnne)
          type: DataTypes.STRING(10),
          allowNull: false,
          // Sequelize gérera la clé étrangère via l'association `belongsTo`
          // Les `references` sont optionnelles ici si l'association est bien définie dans `associate`
          field: 'annee_code', // Nom de la colonne dans la base de données
        },
        ecoleId: { // Renommé pour être cohérent avec le modèle Ecole (ecoleId)
          type: DataTypes.STRING(10),
          allowNull: false,
          // Les `references` sont optionnelles ici si l'association est bien définie dans `associate`
          field: 'ecole_id', // Nom de la colonne dans la base de données
        },
        // createdAt, updatedAt, et deletedAt sont gérés par la classe Schema
      },
      {
        sequelize,
        modelName: 'Classe',
        tableName: 'classes',
        // indexes sont gérés plus bas pour les clés étrangères explicites
        // timestamps, paranoid, underscored, normalizeStrings sont gérés par défaut par la classe Schema
      }
    );
  }

  /**
   * Définit les associations pour le modèle Classe.
   * @param {Object} models - Un objet contenant tous les modèles de l'application.
   * @param {import('./anneeScolaire.js').default} models.AnneeScolaire - Le modèle AnneeScolaire.
   * @param {import('./Ecole.js').default} models.Ecole - Le modèle Ecole.
   * @param {import('./Eleve.js').default} models.Eleve - Le modèle Eleve.
   */
  static associate(models) {
    // Une classe appartient à une année scolaire spécifique.
    this.belongsTo(models.AnneeScolaire, {
      foreignKey: 'anneeCode', // Clé étrangère dans la table 'classes'
      targetKey: 'codeAnne',   // Clé primaire dans la table 'anneescolaire'
      onDelete: 'RESTRICT',
      as: 'anneeScolaire', // Alias pour inclure facilement l'année scolaire lors des requêtes
    });

    // Une classe appartient à une école spécifique.
    this.belongsTo(models.Ecole, {
      foreignKey: 'ecoleId', // Clé étrangère dans la table 'classes'
      targetKey: 'ecoleId',  // Clé primaire dans la table 'ecoles'
      onDelete: 'RESTRICT',
      as: 'ecole', // Alias pour inclure facilement l'école lors des requêtes
    });

    // Une classe peut avoir plusieurs élèves.
    this.hasMany(models.Eleve, {
      foreignKey: 'classeId', // Clé étrangère dans la table 'eleves'
      sourceKey: 'classeId',  // Clé primaire dans la table 'classes'
      onDelete: 'RESTRICT',
      as: 'eleves', // Alias pour inclure facilement les élèves lors des requêtes
    });

    // Appel de la méthode associate de la classe parente.
    super.associate(models);
  }
}

export default Classe;