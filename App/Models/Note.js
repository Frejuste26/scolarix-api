import { DataTypes } from 'sequelize';
import Schema from '../Configs/model.js'; // Assurez-vous que le chemin est correct

/**
 * @class Note
 * @extends Schema
 * @description Modèle pour stocker la note individuelle obtenue par un élève pour une évaluation spécifique au sein d'une composition.
 */
class Note extends Schema {
  /**
   * Initialise le modèle Note avec ses attributs et options.
   * La clé primaire est composite : (matriculEleve, codeEva, codeCompo).
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
        codeEva: { // Renommé 'evaluation' pour la cohérence avec le modèle Evaluation
          type: DataTypes.STRING(10),
          primaryKey: true,
          allowNull: false, // La clé primaire ne doit jamais être nulle
          field: 'code_eva', // Nom de la colonne dans la base de données
          // Pas besoin de 'references' ici, l'association `belongsTo` le gère
        },
        codeCompo: { // Renommé 'compos' pour la cohérence avec le modèle Composition
          type: DataTypes.STRING(10),
          primaryKey: true,
          allowNull: false, // La clé primaire ne doit jamais être nulle
          field: 'code_compo', // Nom de la colonne dans la base de données
          // Pas besoin de 'references' ici, l'association `belongsTo` le gère
        },
        note: {
          type: DataTypes.FLOAT,
          allowNull: false,
          validate: {
            min: 0,
            max: 10, // Assurez-vous que la plage est correcte (0-10 ou 0-20 ?)
          },
        },
        // createdAt, updatedAt, et deletedAt sont gérés par la classe Schema
      },
      {
        sequelize,
        modelName: 'Note',
        tableName: 'notes',
        // La clé primaire composite (matriculEleve, codeEva, codeCompo) assure l'unicité et crée un index implicite.
        // L'index sur 'eleve' (maintenant 'matricul_eleve') est redondant car déjà couvert par la clé primaire composite.
        indexes: [
            // Aucun index explicite supplémentaire n'est généralement nécessaire pour cette clé primaire composite.
            // Si des requêtes spécifiques nécessitent des index sur des sous-ensembles de cette clé,
            // ou d'autres champs non primaires, ils seraient définis ici.
        ],
      }
    );
  }

  /**
   * Définit les associations pour le modèle Note.
   * @param {Object} models - Un objet contenant tous les modèles de l'application.
   * @param {import('./Eleve.js').default} models.Eleve - Le modèle Eleve.
   * @param {import('./Evaluation.js').default} models.Evaluation - Le modèle Evaluation.
   * @param {import('./Composition.js').default} models.Composition - Le modèle Composition.
   */
  static associate(models) {
    // Une note appartient à un élève spécifique.
    this.belongsTo(models.Eleve, {
      foreignKey: 'matriculEleve', // Clé étrangère dans la table 'notes'
      targetKey: 'matricul',       // Clé primaire dans la table 'eleves'
      onDelete: 'CASCADE',         // Si l'élève est supprimé, ses notes sont aussi supprimées
      as: 'eleveDetail',           // Alias pour inclure les détails de l'élève
    });

    // Une note est liée à un type d'évaluation spécifique (ex: Devoir, Examen).
    this.belongsTo(models.Evaluation, {
      foreignKey: 'codeEva',      // Clé étrangère dans la table 'notes'
      targetKey: 'codeEva',       // Clé primaire dans la table 'evaluations'
      onDelete: 'RESTRICT',       // Empêche la suppression d'une évaluation si des notes y sont liées
      as: 'evaluationType',       // Alias pour inclure le type d'évaluation
    });

    // Une note est liée à une composition spécifique (ex: Composition du 1er trimestre).
    this.belongsTo(models.Composition, {
      foreignKey: 'codeCompo',    // Clé étrangère dans la table 'notes'
      targetKey: 'codeCompo',     // Clé primaire dans la table 'compositions'
      onDelete: 'RESTRICT',       // Empêche la suppression d'une composition si des notes y sont liées
      as: 'composition',          // Alias pour inclure les détails de la composition
    });

    // Appel de la méthode associate de la classe parente.
    super.associate(models);
  }
}

export default Note;