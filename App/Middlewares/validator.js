import Joi from 'joi';
import logger from '../Utils/Logger.js'; // Importe l'instance unique du logger
import ErrorResponse from '../Utils/errorResponse.js';

/**
 * @class Validator
 * @description Centralise la validation des schémas de données Joi pour les requêtes API.
 */
class Validator {
  constructor() {
    // L'instance du logger est importée directement, pas besoin de la réinitialiser ici.
  }

  /**
   * Valide les données fournies contre un schéma Joi.
   * @param {Object} data - Les données à valider (généralement `request.body`).
   * @param {Joi.Schema} schema - Le schéma Joi à utiliser pour la validation.
   * @param {number} [statusCode=400] - Le code de statut HTTP à utiliser en cas d'erreur de validation.
   * @throws {ErrorResponse} Si la validation échoue.
   */
  validate(data, schema, statusCode = 400) {
    // Joi.object() n'est pas nécessaire si 'schema' est déjà un objet Joi.Schema.
    // Si 'schema' est un objet simple contenant des définitions Joi, alors Joi.object(schema) est correct.
    // Pour plus de clarté, assurez-vous que vos schémas sont définis comme Joi.object().keys({...}).
    const validationResult = schema.validate(data, { abortEarly: false, allowUnknown: false }); // allowUnknown pour rejeter les champs non définis
    const { error } = validationResult;

    if (error) {
      const messages = error.details.map((err) => err.message).join(', ');
      logger.warn(`Validation error: ${messages}`, { validationErrors: error.details }); // Log plus de détails
      throw new new ErrorResponse(messages, 'VALIDATION_ERROR', statusCode, { details: error.details });
    }
  }

  /**
   * Crée un middleware Express pour la validation du corps de la requête.
   * @param {Joi.Schema} schema - Le schéma Joi à utiliser pour la validation.
   * @returns {Function} Un middleware Express.
   */
  middleware(schema) {
    return (req, res, next) => {
      try {
        this.validate(req.body, schema);
        next();
      } catch (err) {
        // Passe l'erreur au prochain middleware de gestion d'erreurs
        next(err);
      }
    };
  }

  // --- Schémas pour les utilisateurs (User) ---
  userCreateSchema = Joi.object({
    username: Joi.string().required().min(3).max(50),
    password: Joi.string().required().min(6), // Renommé 'mdpasse' en 'password'
    userRole: Joi.string().valid('Administrator', 'Teacher', 'OtherRole').required(), // Ajout de 'OtherRole'
    ecoleId: Joi.string().regex(/^EC[0-9]{3}$/).required(), // Renommé 'ecole' en 'ecoleId'
  });

  userUpdateSchema = Joi.object({
    username: Joi.string().min(3).max(50).optional(), // Rendre optionnel pour les mises à jour
    password: Joi.string().min(6).optional(), // Renommé 'mdpasse' en 'password', rendre optionnel
    userRole: Joi.string().valid('Administrator', 'Teacher', 'OtherRole').optional(), // Ajout de 'OtherRole', rendre optionnel
    ecoleId: Joi.string().regex(/^EC[0-9]{3}$/).optional(), // Renommé 'ecole' en 'ecoleId', rendre optionnel
  }).min(1); // Au moins un champ doit être fourni pour la mise à jour

  loginSchema = Joi.object({
    username: Joi.string().required(),
    password: Joi.string().required(), // Renommé 'mdpasse' en 'password'
  });

  // --- Schémas pour les écoles (Ecole) ---
  ecoleCreateSchema = Joi.object({
    ecoleId: Joi.string().regex(/^EC[0-9]{3}$/).required(),
    ecoleName: Joi.string().required().min(3).max(100),
    iep: Joi.string().max(200).allow(null, ''), // allow(null, '') pour les chaînes vides
    ville: Joi.string().max(50).allow(null, ''), // allow(null, '') pour les chaînes vides
  });

  ecoleUpdateSchema = Joi.object({
    ecoleName: Joi.string().min(3).max(100).optional(),
    iep: Joi.string().max(200).allow(null, '').optional(),
    ville: Joi.string().max(50).allow(null, '').optional(),
  }).min(1);

  // --- Schémas pour les années scolaires (AnneeScolaire) ---
  anneeScolaireCreateSchema = Joi.object({
    codeAnne: Joi.string().required().max(10),
    annee: Joi.string().regex(/^[0-9]{4}-[0-9]{4}$/).required(),
  });

  anneeScolaireUpdateSchema = Joi.object({
    codeAnne: Joi.string().max(10).optional(),
    annee: Joi.string().regex(/^[0-9]{4}-[0-9]{4}$/).optional(),
  }).min(1);

  // --- Schémas pour les classes (Classe) ---
  classeCreateSchema = Joi.object({
    classeId: Joi.string().required().max(10),
    libelle: Joi.string().required().max(50),
    niveau: Joi.string().required().max(20),
    anneeCode: Joi.string().regex(/^[0-9]{4}-[0-9]{4}$/).required(), // Renommé 'annee' en 'anneeCode'
    ecoleId: Joi.string().regex(/^EC[0-9]{3}$/).required(), // Renommé 'ecole' en 'ecoleId'
  });

  classeUpdateSchema = Joi.object({
    libelle: Joi.string().max(50).optional(),
    niveau: Joi.string().max(20).optional(),
    anneeCode: Joi.string().regex(/^[0-9]{4}-[0-9]{4}$/).optional(), // Renommé 'annee' en 'anneeCode'
    ecoleId: Joi.string().regex(/^EC[0-9]{3}$/).optional(), // Renommé 'ecole' en 'ecoleId'
  }).min(1);

  // --- Schémas pour les élèves (Eleve) ---
  eleveCreateSchema = Joi.object({
    matricul: Joi.string().required().max(20),
    lastname: Joi.string().required().max(50),
    firstname: Joi.string().required().max(100), // Max 100 comme dans le modèle
    genre: Joi.string().valid('M', 'F').required(),
    classeId: Joi.string().required().max(10), // Renommé 'classe' en 'classeId'
    ecoleId: Joi.string().regex(/^EC[0-9]{3}$/).required(), // Renommé 'ecole' en 'ecoleId'
  });

  eleveUpdateSchema = Joi.object({
    matricul: Joi.string().max(20).optional(), // Matricule peut être mis à jour ? Généralement non, mais si oui, laisser optionnel.
    lastname: Joi.string().max(50).optional(),
    firstname: Joi.string().max(100).optional(), // Max 100
    genre: Joi.string().valid('M', 'F').optional(),
    classeId: Joi.string().max(10).optional(), // Renommé 'classe' en 'classeId'
    ecoleId: Joi.string().regex(/^EC[0-9]{3}$/).optional(), // Renommé 'ecole' en 'ecoleId'
  }).min(1);

  // --- Schémas pour les évaluations (Evaluation) ---
  evaluationCreateSchema = Joi.object({
    codeEva: Joi.string().required().max(10),
    nameEva: Joi.string().required().max(50),
    coeficient: Joi.number().required().min(0.01), // Alignement avec le modèle (min 0.01)
  });

  evaluationUpdateSchema = Joi.object({
    nameEva: Joi.string().max(50).optional(),
    coeficient: Joi.number().min(0.01).optional(), // Alignement avec le modèle (min 0.01)
  }).min(1);

  // --- Schémas pour les compositions (Composition) ---
  compositionCreateSchema = Joi.object({
    codeCompo: Joi.string().required().max(10),
    libelle: Joi.string().required().max(50),
    dateCompo: Joi.date().required(), // Renommé 'Date' en 'dateCompo'
    typeCompo: Joi.string().valid('Mensuelle', 'Programme', 'Passage').required(), // Utilise valid() pour ENUM
    anneeCode: Joi.string().regex(/^[0-9]{4}-[0-9]{4}$/).required(), // Renommé 'annee' en 'anneeCode'
  });

  compositionUpdateSchema = Joi.object({
    libelle: Joi.string().max(50).optional(),
    dateCompo: Joi.date().optional(), // Renommé 'Date' en 'dateCompo'
    typeCompo: Joi.string().valid('Mensuelle', 'Programme', 'Passage').optional(), // Utilise valid() pour ENUM
    anneeCode: Joi.string().regex(/^[0-9]{4}-[0-9]{4}$/).optional(), // Renommé 'annee' en 'anneeCode'
  }).min(1);

  // --- Schémas pour les notes (Note) ---
  noteCreateSchema = Joi.object({
    matriculEleve: Joi.string().required().max(20), // Renommé 'eleve' en 'matriculEleve'
    codeEva: Joi.string().required().max(10), // Renommé 'evaluation' en 'codeEva'
    codeCompo: Joi.string().required().max(10), // Renommé 'compos' en 'codeCompo'
    note: Joi.number().required().min(0).max(10), // Alignement avec le modèle (max 10)
  });

  noteUpdateSchema = Joi.object({
    note: Joi.number().min(0).max(10).optional(), // Alignement avec le modèle (max 10)
  }).min(1);

  // --- Schémas pour les moyennes (Moyenne) ---
  moyenneCreateSchema = Joi.object({
    matriculEleve: Joi.string().required().max(20), // Renommé 'eleve' en 'matriculEleve'
    codeCompo: Joi.string().required().max(10), // Renommé 'compos' en 'codeCompo'
    moyenne: Joi.number().required().min(0).max(10), // Alignement avec le modèle (max 10)
  });

  moyenneUpdateSchema = Joi.object({
    moyenne: Joi.number().min(0).max(10).optional(), // Alignement avec le modèle (max 10)
  }).min(1);

  // --- Schémas pour les résultats (Resultat) ---
  resultatCreateSchema = Joi.object({
    matriculEleve: Joi.string().required().max(20), // Renommé 'eleve' en 'matriculEleve'
    anneeCode: Joi.string().regex(/^[0-9]{4}-[0-9]{4}$/).required(), // Renommé 'annee' en 'anneeCode'
    decision: Joi.string().valid('Admis', 'Refusé', 'Passage').required(), // Utilise valid() pour ENUM
    rang: Joi.number().required().min(1),
    mga: Joi.number().required().min(0).max(10), // Alignement avec le modèle (max 10)
  });

  resultatUpdateSchema = Joi.object({
    decision: Joi.string().valid('Admis', 'Refusé', 'Passage').optional(), // Utilise valid() pour ENUM
    rang: Joi.number().min(1).optional(),
    mga: Joi.number().min(0).max(10).optional(), // Alignement avec le modèle (max 10)
  }).min(1);
}

export default new Validator();
