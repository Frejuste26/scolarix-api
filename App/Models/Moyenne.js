import { DataTypes } from 'sequelize';
import Schema from '../Configs/model.js'; // Assurez-vous que le chemin est correct

/**
 * @class Moyenne
 * @extends Schema
 * @description Modèle pour stocker les moyennes obtenues par un élève pour une composition donnée.
 */
class Moyenne extends Schema {
  /**
   * Initialise le modèle Moyenne avec ses attributs et options.
   * @param {import('sequelize').Sequelize} sequelize - L'instance Sequelize connectée.
   */
  static init(sequelize) {
    super.init(
      {
        matriculEleve: { // Renommé 'eleve' en 'matriculEleve' pour la cohérence
          type: DataTypes.STRING(20),
          primaryKey: true,
          allowNull: false, // Ne doit pas être nul
          field: 'matricul_eleve', // Nom de la colonne dans la base de données
          // Pas besoin de 'references' ici, l'association `belongsTo` le gère
        },
        codeCompo: { // Renommé 'compos' en 'codeCompo' pour la cohérence
          type: DataTypes.STRING(10),
          primaryKey: true,
          allowNull: false, // Ne doit pas être nul
          field: 'code_compo', // Nom de la colonne dans la base de données
          // Pas besoin de 'references' ici, l'association `belongsTo` le gère
        },
        moyenne: {
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
        modelName: 'Moyenne',
        tableName: 'moyennes',
        // Le `unique: true` implicite sur les clés primaires composites suffit pour l'unicité.
        // L'index sur 'eleve' (maintenant 'matricul_eleve') est généralement créé automatiquement par Sequelize.
        indexes: [
          // Index composé si la recherche est souvent faite par élève et composition
          // {
          //   unique: true, // Ceci est déjà implicite pour les clés primaires composites
          //   fields: ['matricul_eleve', 'code_compo'],
          //   name: 'unique_moyenne_per_eleve_compo'
          // }
        ],
      }
    );
  }

  /**
   * Définit les associations pour le modèle Moyenne.
   * @param {Object} models - Un objet contenant tous les modèles de l'application.
   * @param {import('./Eleve.js').default} models.Eleve - Le modèle Eleve.
   * @param {import('./Composition.js').default} models.Composition - Le modèle Composition.
   */
  static associate(models) {
    // Une moyenne appartient à un élève spécifique.
    this.belongsTo(models.Eleve, {
      foreignKey: 'matriculEleve', // Clé étrangère dans la table 'moyennes'
      targetKey: 'matricul',       // Clé primaire dans la table 'eleves'
      onDelete: 'CASCADE',         // Si l'élève est supprimé, ses moyennes sont aussi supprimées
      as: 'eleveDetail',           // Alias pour inclure les détails de l'élève
    });

    // Une moyenne est liée à une composition spécifique.
    this.belongsTo(models.Composition, {
      foreignKey: 'codeCompo',    // Clé étrangère dans la table 'moyennes'
      targetKey: 'codeCompo',     // Clé primaire dans la table 'compositions'
      onDelete: 'RESTRICT',       // Empêche la suppression d'une composition si des moyennes y sont liées
      as: 'compositionDetail',    // Alias pour inclure les détails de la composition
    });

    // Appel de la méthode associate de la classe parente.
    super.associate(models);
  }
}

export default Moyenne;