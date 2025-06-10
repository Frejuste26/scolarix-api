import { DataTypes } from 'sequelize';
import Schema from '../Configs/model.js'; // Assurez-vous que le chemin est correct

/**
 * @class Resultat
 * @extends Schema
 * @description Modèle pour stocker le résultat final d'un élève pour une année scolaire donnée.
 */
class Resultat extends Schema {
  /**
   * Initialise le modèle Resultat avec ses attributs et options.
   * La clé primaire est composite : (matriculEleve, anneeCode).
   * @param {import('sequelize').Sequelize} sequelize - L'instance Sequelize connectée.
   */
  static init(sequelize) {
    super.init(
      {
        matriculEleve: { // Renommé 'eleve' pour la cohérence avec le modèle Eleve
          type: DataTypes.STRING(20),
          primaryKey: true,
          allowNull: false, // La clé primaire ne doit jamais être nulle
          field: 'matricul_eleve', // Nom de la colonne dans la base de données
          // Pas besoin de 'references' ici, l'association `belongsTo` le gère
        },
        anneeCode: { // Renommé 'annee' pour la cohérence avec le modèle AnneeScolaire
          type: DataTypes.STRING(10),
          primaryKey: true,
          allowNull: false, // La clé primaire ne doit jamais être nulle
          field: 'annee_code', // Nom de la colonne dans la base de données
          // Pas besoin de 'references' ici, l'association `belongsTo` le gère
        },
        decision: {
          type: DataTypes.ENUM('Admis', 'Refusé', 'Passage'), // Ajout de 'Passage' si applicable
          allowNull: false,
        },
        rang: {
          type: DataTypes.INTEGER,
          allowNull: false,
          validate: {
            min: 1, // Le rang doit être au moins 1
          },
        },
        mga: { // Moyenne Générale Annuelle
          type: DataTypes.FLOAT,
          allowNull: false,
          validate: {
            min: 0,
            max: 10, // Confirmez la plage maximale (0-10 ou 0-20 ?)
          },
        },
        // createdAt, updatedAt, et deletedAt sont gérés par la classe Schema
      },
      {
        sequelize,
        modelName: 'Resultat',
        tableName: 'resultats', // Généralement préférable d'utiliser le pluriel pour les noms de tables
        // La clé primaire composite (matriculEleve, anneeCode) assure l'unicité et crée un index implicite.
        // L'index sur 'annee' (maintenant 'annee_code') est redondant car déjà couvert par la clé primaire composite.
        indexes: [
            // Aucun index explicite supplémentaire n'est généralement nécessaire pour cette clé primaire composite.
            // Si des requêtes spécifiques nécessitent des index sur des sous-ensembles de cette clé,
            // ou d'autres champs non primaires, ils seraient définis ici.
            // Par exemple, pour les requêtes de classement par année :
            // { fields: ['annee_code', 'rang'] }
        ],
      }
    );
  }

  /**
   * Définit les associations pour le modèle Resultat.
   * @param {Object} models - Un objet contenant tous les modèles de l'application.
   * @param {import('./Eleve.js').default} models.Eleve - Le modèle Eleve.
   * @param {import('./anneeScolaire.js').default} models.AnneeScolaire - Le modèle AnneeScolaire.
   */
  static associate(models) {
    // Un résultat appartient à un élève spécifique.
    this.belongsTo(models.Eleve, {
      foreignKey: 'matriculEleve', // Clé étrangère dans la table 'resultats'
      targetKey: 'matricul',       // Clé primaire dans la table 'eleves'
      onDelete: 'CASCADE',         // Si l'élève est supprimé, ses résultats sont aussi supprimés
      as: 'eleveDetail',           // Alias pour inclure les détails de l'élève
    });

    // Un résultat est lié à une année scolaire spécifique.
    this.belongsTo(models.AnneeScolaire, {
      foreignKey: 'anneeCode',    // Clé étrangère dans la table 'resultats'
      targetKey: 'codeAnne',      // Clé primaire dans la table 'anneescolaire'
      onDelete: 'RESTRICT',       // Empêche la suppression d'une année si des résultats y sont liés
      as: 'anneeScolaire',        // Alias pour inclure les détails de l'année scolaire
    });

    // Appel de la méthode associate de la classe parente.
    super.associate(models);
  }
}

export default Resultat;