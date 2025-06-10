import { DataTypes } from 'sequelize';
import Schema from '../Configs/model.js';
import bcrypt from 'bcrypt';

/**
 * @class User
 * @extends Schema
 * @description Modèle pour gérer les utilisateurs de l'application (administrateurs, professeurs, etc.).
 */
class User extends Schema {
  /**
   * Initialise le modèle User avec ses attributs et options.
   * @param {import('sequelize').Sequelize} sequelize - L'instance Sequelize pour la connexion.
   */
  static init(sequelize) {
    super.init(
      {
        userId: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false, // Explicitly set as primary key, should not be null
          field: 'user_id',
        },
        username: {
          type: DataTypes.STRING(50),
          allowNull: false,
          unique: true,
          validate: {
            is: {
              args: /^[a-zA-Z0-9_-]+$/i,
              msg: 'Le nom d\'utilisateur ne peut contenir que des lettres, chiffres, tirets et underscores.',
            },
            notEmpty: {
              msg: 'Le nom d\'utilisateur ne peut pas être vide.',
            },
            len: [3, 50], // Ajout d'une longueur minimale et maximale
          },
        },
        password: {
          type: DataTypes.STRING(255), // 255 caractères est bon pour les hachages bcrypt
          allowNull: false,
          field: 'mdpasse', // Mappé à 'mdpasse' dans la base pour compatibilité
          validate: {
            notEmpty: {
              msg: 'Le mot de passe ne peut pas être vide.',
            },
            // Les validations de complexité du mot de passe ne sont pas faites ici
            // car le hachage est fait avant la validation.
            // Elles devraient être gérées au niveau du service ou du contrôleur si vous en avez.
          },
        },
        userRole: {
          type: DataTypes.ENUM('Administrator', 'Teacher', 'OtherRole'), // Ajoutez d'autres rôles si nécessaire
          allowNull: false,
          field: 'user_role',
          defaultValue: 'Teacher', // Définir un rôle par défaut si pertinent
        },
        ecoleId: { // Renommé 'ecole' en 'ecoleId' pour la cohérence
          type: DataTypes.STRING(10), // Type devrait correspondre à la clé primaire de Ecole
          allowNull: false,
          // Pas besoin de 'references' ici, l'association `belongsTo` le gère
          field: 'ecole_id', // Nom de la colonne dans la base de données
        },
        lastLogin: {
          type: DataTypes.DATE,
          allowNull: true,
          field: 'last_login',
        },
        // createdAt, updatedAt, et deletedAt sont gérés par la classe Schema
      },
      {
        sequelize,
        modelName: 'User',
        tableName: 'users',
        // L'index sur 'username' est déjà couvert par 'unique: true' dans sa définition.
        // L'index sur 'ecole_id' sera créé automatiquement par Sequelize via l'association.
        indexes: [
          // Vous pourriez ajouter un index sur user_role si les requêtes filtrent souvent par rôle
          // { fields: ['user_role'] },
        ],
      }
    );

    // --- Hooks de mot de passe ---

    // Hook pour hacher le mot de passe avant la création
    this.addHook('beforeCreate', async (user) => {
      // Assurez-vous que le mot de passe est une chaîne non vide avant de hacher
      if (user.password) {
        try {
          const salt = await bcrypt.genSalt(10);
          user.password = await bcrypt.hash(user.password, salt);
        } catch (error) {
          console.error("Erreur lors du hachage du mot de passe avant création:", error);
          // Gérer l'erreur, potentiellement rejeter la promesse pour empêcher la création
          throw new Error('Erreur de hachage du mot de passe.'); // Ou utiliser ErrorResponse si approprié
        }
      }
    });

    // Hook pour hacher le mot de passe avant la mise à jour
    this.addHook('beforeUpdate', async (user) => {
      // 'user.changed('password')' est la bonne façon de vérifier si le champ a été modifié.
      // Assurez-vous également que la nouvelle valeur n'est pas vide avant de tenter le hachage.
      if (user.changed('password') && user.password) {
        try {
          const salt = await bcrypt.genSalt(10);
          user.password = await bcrypt.hash(user.password, salt);
        } catch (error) {
          console.error("Erreur lors du hachage du mot de passe avant mise à jour:", error);
          // Gérer l'erreur, potentiellement rejeter la promesse pour empêcher la mise à jour
          throw new Error('Erreur de hachage du mot de passe.');
        }
      }
    });

    // --- Méthode d'instance pour comparer les mots de passe ---
    // Cette méthode ne doit PAS être statique, mais une méthode d'instance
    // pour être appelée sur un objet utilisateur récupéré de la DB.
    // userInstance.comparePassword('plainTextPassword')
    this.prototype.comparePassword = async function(candidatePassword) {
      return await bcrypt.compare(candidatePassword, this.password);
    };
  }

  /**
   * Définit les associations du modèle User.
   * @param {Object} models - Un objet contenant tous les modèles de l'application.
   * @param {import('./Ecole.js').default} models.Ecole - Le modèle Ecole.
   */
  static associate(models) {
    // Un utilisateur appartient à une école spécifique.
    this.belongsTo(models.Ecole, {
      foreignKey: 'ecoleId', // Clé étrangère dans la table 'users'
      targetKey: 'ecoleId',  // Clé primaire dans la table 'ecoles'
      onDelete: 'RESTRICT',  // Empêche la suppression d'une école si des utilisateurs y sont liés
      onUpdate: 'CASCADE',   // Si l'ID de l'école change, met à jour la clé étrangère ici
      as: 'ecoleAffiliation', // Alias pour inclure facilement l'école
    });

    // Appel de la méthode associate de la classe parente.
    super.associate(models);
  }
}

export default User;