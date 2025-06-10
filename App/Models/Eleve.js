import { DataTypes } from 'sequelize';
import Schema from '../Configs/model.js'; // Assurez-vous que le chemin est correct

/**
 * @class Eleve
 * @extends Schema
 * @description Modèle pour gérer les informations des élèves.
 */
class Eleve extends Schema {
  /**
   * Initialise le modèle Eleve avec ses attributs et options.
   * @param {import('sequelize').Sequelize} sequelize - L'instance Sequelize connectée.
   */
  static init(sequelize) {
    super.init(
      {
        matricul: {
          type: DataTypes.STRING(20),
          primaryKey: true,
          allowNull: false, // La clé primaire ne doit jamais être nulle
          unique: true,     // Un matricule doit être unique pour chaque élève
          field: 'matricul', // Nom de la colonne dans la base de données (si différent du nom d'attribut)
        },
        lastname: {
          type: DataTypes.STRING(50),
          allowNull: false,
          field: 'last_name', // Convention snake_case pour les noms de colonnes
        },
        firstname: {
          type: DataTypes.STRING(100),
          allowNull: false,
          field: 'first_name', // Convention snake_case pour les noms de colonnes
        },
        genre: {
          type: DataTypes.ENUM('M', 'F'),
          allowNull: false,
        },
        classeId: { // Renommé 'classe' en 'classeId' pour la cohérence
          type: DataTypes.STRING(10),
          allowNull: false,
          // Les `references` sont gérées par l'association `belongsTo`
          field: 'classe_id', // Nom de la colonne dans la base de données
        },
        ecoleId: { // Renommé 'ecole' en 'ecoleId' pour la cohérence
          type: DataTypes.STRING(10),
          allowNull: false,
          // Les `references` sont gérées par l'association `belongsTo`
          field: 'ecole_id', // Nom de la colonne dans la base de données
        },
        // createdAt, updatedAt, et deletedAt sont gérés par la classe Schema
      },
      {
        sequelize,
        modelName: 'Eleve',
        tableName: 'eleves',
        // Les index sur les clés étrangères 'classe_id' et 'ecole_id' sont généralement créés automatiquement par Sequelize
        // lorsque les associations 'belongsTo' sont définies.
        // Si vous avez besoin d'index supplémentaires ou d'index composites, vous pouvez les ajouter ici.
        indexes: [
            // Exemple d'index composé si un élève doit avoir un matricule unique par école, par exemple
            // {
            //   unique: true,
            //   fields: ['matricul', 'ecole_id'],
            //   name: 'unique_matricul_per_ecole'
            // }
        ]
      }
    );
  }

  /**
   * Définit les associations pour le modèle Eleve.
   * @param {Object} models - Un objet contenant tous les modèles de l'application.
   * @param {import('./Classe.js').default} models.Classe - Le modèle Classe.
   * @param {import('./Ecole.js').default} models.Ecole - Le modèle Ecole.
   * @param {import('./Note.js').default} models.Note - Le modèle Note.
   * @param {import('./Moyenne.js').default} models.Moyenne - Le modèle Moyenne.
   * @param {import('./Resultat.js').default} models.Resultat - Le modèle Resultat.
   */
  static associate(models) {
    // Un élève appartient à une classe spécifique.
    this.belongsTo(models.Classe, {
      foreignKey: 'classeId', // Clé étrangère dans la table 'eleves'
      targetKey: 'classeId',   // Clé primaire dans la table 'classes'
      onDelete: 'RESTRICT',    // Empêche la suppression d'une classe si des élèves y sont liés
      as: 'classe',            // Alias pour inclure facilement la classe lors des requêtes
    });

    // Un élève appartient à une école spécifique.
    this.belongsTo(models.Ecole, {
      foreignKey: 'ecoleId', // Clé étrangère dans la table 'eleves'
      targetKey: 'ecoleId',  // Clé primaire dans la table 'ecoles'
      onDelete: 'RESTRICT',  // Empêche la suppression d'une école si des élèves y sont liés
      as: 'ecole',           // Alias pour inclure facilement l'école lors des requêtes
    });

    // Un élève peut avoir plusieurs notes.
    this.hasMany(models.Note, {
      foreignKey: 'matriculEleve', // Clé étrangère dans la table 'notes' (renommé pour la cohérence)
      sourceKey: 'matricul',      // Clé primaire dans la table 'eleves'
      onDelete: 'CASCADE',        // Supprime les notes si l'élève est supprimé
      as: 'notes',                // Alias pour inclure facilement les notes
    });

    // Un élève peut avoir plusieurs moyennes.
    this.hasMany(models.Moyenne, {
      foreignKey: 'matriculEleve', // Clé étrangère dans la table 'moyennes' (renommé pour la cohérence)
      sourceKey: 'matricul',
      onDelete: 'CASCADE',        // Supprime les moyennes si l'élève est supprimé
      as: 'moyennes',             // Alias pour inclure facilement les moyennes
    });

    // Un élève peut avoir plusieurs résultats.
    this.hasMany(models.Resultat, {
      foreignKey: 'matriculEleve', // Clé étrangère dans la table 'resultats' (renommé pour la cohérence)
      sourceKey: 'matricul',
      onDelete: 'CASCADE',        // Supprime les résultats si l'élève est supprimé
      as: 'resultats',            // Alias pour inclure facilement les résultats
    });

    // Appel de la méthode associate de la classe parente.
    super.associate(models);
  }
}

export default Eleve;