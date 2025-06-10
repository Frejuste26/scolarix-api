import { DataTypes } from 'sequelize';
import Schema from '../Configs/model.js'; // Assurez-vous que le chemin est correct

/**
 * @class Composition
 * @extends Schema
 * @description Modèle pour gérer les évaluations (compositions, examens) des élèves.
 */
class Composition extends Schema {
  /**
   * Initialise le modèle Composition avec ses attributs et options.
   * @param {import('sequelize').Sequelize} sequelize - L'instance Sequelize connectée.
   */
  static init(sequelize) {
    super.init(
      {
        codeCompo: {
          type: DataTypes.STRING(10),
          primaryKey: true,
          allowNull: false, // La clé primaire ne doit pas être nulle
          field: 'code_compo', // Nom de la colonne dans la base de données
        },
        libelle: {
          type: DataTypes.STRING(50),
          allowNull: false,
          // Un libellé peut être unique par année scolaire et type de composition
          // L'unicité combinée sera gérée par un index unique si nécessaire
        },
        dateCompo: { // Renommé 'Date' en 'dateCompo' pour éviter les conflits de nommage et être plus explicite
          type: DataTypes.DATEONLY,
          allowNull: false,
          field: 'date_compo', // Nom de la colonne dans la base de données
        },
        typeCompo: {
          type: DataTypes.ENUM('Mensuelle', 'Programme', 'Passage'),
          allowNull: false,
          field: 'type_compo',
        },
        anneeCode: { // Renommé 'annee' en 'anneeCode' pour la cohérence avec AnneeScolaire
          type: DataTypes.STRING(10),
          allowNull: false,
          // Pas besoin de 'references' ici, l'association `belongsTo` le gère
          field: 'annee_code', // Nom de la colonne dans la base de données
        },
        // createdAt, updatedAt, et deletedAt sont gérés par la classe Schema
      },
      {
        sequelize,
        modelName: 'Composition',
        tableName: 'compositions',
        // Si la combinaison libelle, typeCompo, anneeCode doit être unique, ajoutez un index composé :
        indexes: [
          {
            unique: true,
            fields: ['libelle', 'type_compo', 'annee_code'], // Utilisez les noms de colonnes réels
            name: 'unique_composition_per_year_type'
          }
        ]
        // timestamps, paranoid, underscored, normalizeStrings sont gérés par défaut par la classe Schema
      }
    );
  }

  /**
   * Définit les associations pour le modèle Composition.
   * @param {Object} models - Un objet contenant tous les modèles de l'application.
   * @param {import('./anneeScolaire.js').default} models.AnneeScolaire - Le modèle AnneeScolaire.
   * @param {import('./Note.js').default} models.Note - Le modèle Note.
   * @param {import('./Moyenne.js').default} models.Moyenne - Le modèle Moyenne.
   */
  static associate(models) {
    // Une composition appartient à une année scolaire spécifique.
    this.belongsTo(models.AnneeScolaire, {
      foreignKey: 'anneeCode', // Clé étrangère dans la table 'compositions'
      targetKey: 'codeAnne',   // Clé primaire dans la table 'anneescolaire'
      onDelete: 'RESTRICT',
      as: 'anneeScolaire', // Alias pour inclure facilement l'année scolaire
    });

    // Une composition peut avoir plusieurs notes.
    this.hasMany(models.Note, {
      foreignKey: 'codeCompo', // Clé étrangère dans la table 'notes'
      sourceKey: 'codeCompo',  // Clé primaire dans la table 'compositions'
      onDelete: 'RESTRICT',
      as: 'notes', // Alias pour inclure facilement les notes
    });

    // Une composition peut être liée à plusieurs moyennes.
    this.hasMany(models.Moyenne, {
      foreignKey: 'codeCompo', // Clé étrangère dans la table 'moyennes'
      sourceKey: 'codeCompo',  // Clé primaire dans la table 'compositions'
      onDelete: 'RESTRICT',
      as: 'moyennes', // Alias pour inclure facilement les moyennes
    });

    // Appel de la méthode associate de la classe parente.
    super.associate(models);
  }
}

export default Composition;