import { DataTypes } from 'sequelize';
import Schema from '../Configs/model.js'; // Assurez-vous que le chemin est correct

/**
 * @class AnneeScolaire
 * @extends Schema
 * @description Modèle pour gérer les années scolaires dans la base de données.
 */
class AnneeScolaire extends Schema {
  /**
   * Initialise le modèle AnneeScolaire avec ses attributs et options.
   * @param {import('sequelize').Sequelize} sequelize - L'instance Sequelize connectée.
   */
  static init(sequelize) {
    // La méthode super.init() dans Schema prend les attributs et un objet d'options.
    // L'instance 'sequelize' doit être incluse dans l'objet d'options.
    super.init(
      {
        codeAnne: {
          type: DataTypes.STRING(10),
          primaryKey: true,
          allowNull: false, // Le champ clé primaire ne devrait pas être null
          validate: {
            is: /^[0-9]{4}-[0-9]{4}$/, // Ex: "2023-2024"
          },
          field: 'code_anne', // Nom de la colonne dans la base de données (snake_case par convention)
        },
        annee: {
          type: DataTypes.STRING(20), // Ex: "Année Scolaire 2023-2024"
          allowNull: false,
          unique: true, // L'année scolaire devrait être unique
        },
        // createdAt, updatedAt, et deletedAt sont gérés par la classe Schema
      },
      {
        sequelize, // Passe l'instance sequelize ici comme requis par Schema.init
        modelName: 'AnneeScolaire',
        tableName: 'anneescolaire',
        // timestamps, paranoid, underscored sont gérés par défaut par la classe Schema
        // normalizeStrings: true (par défaut dans Schema) s'appliquera aussi ici
      }
    );
  }

  /**
   * Définit les associations pour le modèle AnneeScolaire.
   * @param {Object} models - Un objet contenant tous les modèles de l'application.
   * @param {import('./Classe.js').default} models.Classe - Le modèle Classe.
   * @param {import('./Composition.js').default} models.Composition - Le modèle Composition.
   * @param {import('./Resultat.js').default} models.Resultat - Le modèle Resultat.
   */
  static associate(models) {
    // Une année scolaire peut avoir plusieurs classes.
    this.hasMany(models.Classe, {
      foreignKey: 'anneeCode', // Assurez-vous que 'anneeCode' est le bon nom de la clé étrangère dans le modèle Classe
      sourceKey: 'codeAnne', // La clé primaire de ce modèle est 'codeAnne'
      onDelete: 'RESTRICT', // Empêche la suppression d'une année si des classes y sont liées
    });

    // Une année scolaire peut avoir plusieurs compositions (examens, etc.).
    this.hasMany(models.Composition, {
      foreignKey: 'anneeCode', // Assurez-vous que 'anneeCode' est le bon nom de la clé étrangère dans Composition
      sourceKey: 'codeAnne',
      onDelete: 'RESTRICT', // Empêche la suppression d'une année si des compositions y sont liées
    });

    // Une année scolaire peut avoir plusieurs résultats.
    this.hasMany(models.Resultat, {
      foreignKey: 'anneeCode', // Assurez-vous que 'anneeCode' est le bon nom de la clé étrangère dans Resultat
      sourceKey: 'codeAnne',
      onDelete: 'RESTRICT', // Empêche la suppression d'une année si des résultats y sont liés
    });

    // Appelle la méthode associate de la classe parente pour la gestion des logs si non surchargée.
    super.associate(models);
  }
}

export default AnneeScolaire;