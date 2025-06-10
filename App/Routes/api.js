import express from 'express';
import AuthMiddleware from '../Middlewares/authMiddleware.js';
import EcoleController from '../Controllers/ecole.js';
import UserController from '../Controllers/user.js';
import AnneeScolaireController from '../Controllers/anneeScolaire.js';
import ClasseController from '../Controllers/classe.js';
import EleveController from '../Controllers/eleve.js';
import EvaluationController from '../Controllers/evaluation.js';
import CompositionController from '../Controllers/composition.js';
import NoteController from '../Controllers/note.js';
import MoyenneController from '../Controllers/moyenne.js';
import ResultatController from '../Controllers/resultat.js';
import Validator from '../Middlewares/validator.js'; // Changed Validator.js to validator.js
import { db } from '../Models/index.js'; // Importe l'objet 'db' qui contient tous les modèles

const router = express.Router();

// Instancie les contrôleurs
const userController = new UserController();
const ecoleController = new EcoleController();
const anneeScolaireController = new AnneeScolaireController();
const classeController = new ClasseController();
const eleveController = new EleveController();
const evaluationController = new EvaluationController();
const compositionController = new CompositionController();
const noteController = new NoteController();
const moyenneController = new MoyenneController();
const resultatController = new ResultatController();

// --- User routes ---
router.post(
  '/users',
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize(['Administrator']),
  Validator.middleware(Validator.userCreateSchema),
  userController.createUser.bind(userController)
);
router.get(
  '/users',
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize(['Administrator']),
  userController.getAll.bind(userController)
);
router.get(
  '/users/:id',
  AuthMiddleware.authenticate,
  // L'autorisation de propriété est gérée ici. Le filtrage par école pour les enseignants est dans le contrôleur.
  AuthMiddleware.authorize([], { ownershipRequired: true, model: db.User, idParam: 'id' }),
  userController.getUser.bind(userController)
);
router.put(
  '/users/:id',
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize([], { ownershipRequired: true, model: db.User, idParam: 'id' }),
  Validator.middleware(Validator.userUpdateSchema),
  userController.updateUser.bind(userController)
);
router.delete(
  '/users/:id',
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize(['Administrator']), // Seul l'administrateur peut supprimer des utilisateurs (soft delete)
  userController.deleteUser.bind(userController)
);
router.post(
  '/login',
  Validator.middleware(Validator.loginSchema),
  userController.login.bind(userController)
);

// --- Ecole routes ---
router.post(
  '/ecoles',
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize(['Administrator']),
  Validator.middleware(Validator.ecoleCreateSchema),
  ecoleController.createEcole.bind(ecoleController)
);
router.get(
  '/ecoles',
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize(['Administrator', 'Teacher']), // Les enseignants peuvent voir toutes les écoles
  ecoleController.getAll.bind(ecoleController)
);
router.get(
  '/ecoles/:id',
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize(['Administrator', 'Teacher']), // Les enseignants peuvent voir les détails d'une école
  ecoleController.getEcole.bind(ecoleController)
);
router.put(
  '/ecoles/:id',
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize(['Administrator']),
  Validator.middleware(Validator.ecoleUpdateSchema),
  ecoleController.updateEcole.bind(ecoleController)
);
router.delete(
  '/ecoles/:id',
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize(['Administrator']),
  ecoleController.deleteEcole.bind(ecoleController)
);

// --- AnneeScolaire routes ---
router.post(
  '/anneescolaires',
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize(['Administrator']),
  Validator.middleware(Validator.anneeScolaireCreateSchema),
  anneeScolaireController.createAnneeScolaire.bind(anneeScolaireController)
);
router.get(
  '/anneescolaires',
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize(['Administrator', 'Teacher']),
  anneeScolaireController.getAll.bind(anneeScolaireController)
);
router.get(
  '/anneescolaires/:id',
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize(['Administrator', 'Teacher']),
  anneeScolaireController.getAnneeScolaire.bind(anneeScolaireController)
);
router.put(
  '/anneescolaires/:id',
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize(['Administrator']),
  Validator.middleware(Validator.anneeScolaireUpdateSchema),
  anneeScolaireController.updateAnneeScolaire.bind(anneeScolaireController)
);
router.delete(
  '/anneescolaires/:id',
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize(['Administrator']),
  anneeScolaireController.deleteAnneeScolaire.bind(anneeScolaireController)
);

// --- Classe routes ---
router.post(
  '/classes',
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize(['Administrator', 'Teacher']), // La restriction par école est dans le contrôleur
  Validator.middleware(Validator.classeCreateSchema),
  classeController.createClasse.bind(classeController)
);
router.get(
  '/classes',
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize(['Administrator', 'Teacher']), // La restriction par école est dans le contrôleur
  classeController.getAll.bind(classeController)
);
router.get(
  '/classes/:id',
  AuthMiddleware.authenticate,
  // L'autorisation de propriété/restriction d'école est gérée dans le contrôleur.
  AuthMiddleware.authorize(['Administrator', 'Teacher']),
  classeController.getClasse.bind(classeController)
);
router.put(
  '/classes/:id',
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize(['Administrator', 'Teacher']), // La restriction par école est dans le contrôleur
  Validator.middleware(Validator.classeUpdateSchema),
  classeController.updateClasse.bind(classeController)
);
router.delete(
  '/classes/:id',
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize(['Administrator']), // Seul l'administrateur peut supprimer une classe
  classeController.deleteClasse.bind(classeController)
);

// --- Eleve routes ---
router.post(
  '/eleves',
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize(['Administrator', 'Teacher']), // La restriction par école est dans le contrôleur
  Validator.middleware(Validator.eleveCreateSchema),
  eleveController.createEleve.bind(eleveController)
);
router.get(
  '/eleves',
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize(['Administrator', 'Teacher']), // La restriction par école est dans le contrôleur
  eleveController.getAll.bind(eleveController)
);
router.get(
  '/eleves/:id',
  AuthMiddleware.authenticate,
  // L'autorisation de propriété/restriction d'école est gérée dans le contrôleur.
  AuthMiddleware.authorize(['Administrator', 'Teacher']),
  eleveController.getEleve.bind(eleveController)
);
router.put(
  '/eleves/:id',
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize(['Administrator', 'Teacher']), // La restriction par école est dans le contrôleur
  Validator.middleware(Validator.eleveUpdateSchema),
  eleveController.updateEleve.bind(eleveController)
);
router.delete(
  '/eleves/:id',
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize(['Administrator']), // Seul l'administrateur peut supprimer un élève
  eleveController.deleteEleve.bind(eleveController)
);

// --- Evaluation routes ---
router.post(
  '/evaluations',
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize(['Administrator']),
  Validator.middleware(Validator.evaluationCreateSchema),
  evaluationController.createEvaluation.bind(evaluationController)
);
router.get(
  '/evaluations',
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize(['Administrator', 'Teacher']),
  evaluationController.getAll.bind(evaluationController)
);
router.get(
  '/evaluations/:id',
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize(['Administrator', 'Teacher']),
  evaluationController.getEvaluation.bind(evaluationController)
);
router.put(
  '/evaluations/:id',
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize(['Administrator']),
  Validator.middleware(Validator.evaluationUpdateSchema),
  evaluationController.updateEvaluation.bind(evaluationController)
);
router.delete(
  '/evaluations/:id',
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize(['Administrator']),
  evaluationController.deleteEvaluation.bind(evaluationController)
);

// --- Composition routes ---
router.post(
  '/compositions',
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize(['Administrator', 'Teacher']),
  Validator.middleware(Validator.compositionCreateSchema),
  compositionController.createComposition.bind(compositionController)
);
router.get(
  '/compositions',
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize(['Administrator', 'Teacher']),
  compositionController.getAll.bind(compositionController)
);
router.get(
  '/compositions/:id',
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize(['Administrator', 'Teacher']),
  compositionController.getComposition.bind(compositionController)
);
router.put(
  '/compositions/:id',
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize(['Administrator', 'Teacher']),
  Validator.middleware(Validator.compositionUpdateSchema),
  compositionController.updateComposition.bind(compositionController)
);
router.delete(
  '/compositions/:id',
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize(['Administrator']),
  compositionController.deleteComposition.bind(compositionController)
);

// --- Note routes ---
router.post(
  '/notes',
  AuthMiddleware.authenticate,
  // La restriction par école est dans le contrôleur (pour l'élève associé)
  AuthMiddleware.authorize(['Teacher']),
  Validator.middleware(Validator.noteCreateSchema),
  noteController.createNote.bind(noteController)
);
router.get(
  '/notes/eleve/:eleveId',
  AuthMiddleware.authenticate,
  // L'enseignant ne peut voir que les notes des élèves de son école.
  // L'administrateur peut voir toutes les notes.
  AuthMiddleware.authorize(['Administrator', 'Teacher'], { model: db.Eleve, idParam: 'eleveId', ownershipRequired: true, ownerField: 'ecoleId', isOwner: async (auth, eleveId) => {
    const eleve = await db.Eleve.findByPk(eleveId);
    return eleve && eleve.ecoleId === auth.ecoleId;
  }}),
  noteController.getNotesByEleve.bind(noteController)
);
router.get(
  '/notes',
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize(['Administrator', 'Teacher']), // Le filtrage par école pour les enseignants est dans le contrôleur
  noteController.getAllNotes.bind(noteController)
);
router.put(
  '/notes/:eleveId/:evaluationId/:composId', // Route pour clé primaire composite
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize(['Teacher'], { model: db.Eleve, idParam: 'eleveId', ownershipRequired: true, ownerField: 'ecoleId', isOwner: async (auth, eleveId) => {
    const eleve = await db.Eleve.findByPk(eleveId);
    return eleve && eleve.ecoleId === auth.ecoleId;
  }}),
  Validator.middleware(Validator.noteUpdateSchema),
  noteController.updateNote.bind(noteController)
);
router.delete(
  '/notes/:eleveId/:evaluationId/:composId', // Route pour clé primaire composite
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize(['Administrator']), // Seul l'administrateur peut supprimer une note
  noteController.deleteNote.bind(noteController)
);


// --- Moyenne routes ---
router.post(
  '/moyennes',
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize(['Teacher']), // La restriction par école est dans le contrôleur
  Validator.middleware(Validator.moyenneCreateSchema),
  moyenneController.calculateMoyenne.bind(moyenneController)
);
router.get(
  '/moyennes',
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize(['Administrator', 'Teacher']), // Le filtrage par école pour les enseignants est dans le contrôleur
  moyenneController.getAllMoyennes.bind(moyenneController)
);
router.get(
  '/moyennes/eleve/:eleveId',
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize(['Administrator', 'Teacher'], { model: db.Eleve, idParam: 'eleveId', ownershipRequired: true, ownerField: 'ecoleId', isOwner: async (auth, eleveId) => {
    const eleve = await db.Eleve.findByPk(eleveId);
    return eleve && eleve.ecoleId === auth.ecoleId;
  }}),
  moyenneController.getMoyennesByEleve.bind(moyenneController)
);
router.get(
  '/moyennes/composition/:composId',
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize(['Administrator', 'Teacher']), // Le filtrage par école pour les enseignants est dans le contrôleur
  moyenneController.getMoyennesByCompos.bind(moyenneController)
);
router.put(
  '/moyennes/:eleveId/:composId', // Route pour clé primaire composite
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize(['Teacher'], { model: db.Eleve, idParam: 'eleveId', ownershipRequired: true, ownerField: 'ecoleId', isOwner: async (auth, eleveId) => {
    const eleve = await db.Eleve.findByPk(eleveId);
    return eleve && eleve.ecoleId === auth.ecoleId;
  }}),
  Validator.middleware(Validator.moyenneUpdateSchema),
  moyenneController.updateMoyenne.bind(moyenneController)
);
router.delete(
  '/moyennes/:eleveId/:composId', // Route pour clé primaire composite
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize(['Administrator']), // Seul l'administrateur peut supprimer une moyenne
  moyenneController.deleteMoyenne.bind(moyenneController)
);

// --- Resultat routes ---
router.post(
  '/resultats',
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize(['Administrator']), // La restriction par école est dans le contrôleur
  Validator.middleware(Validator.resultatCreateSchema),
  resultatController.createResultat.bind(resultatController)
);
router.get(
  '/resultats',
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize(['Administrator', 'Teacher']), // Le filtrage par école pour les enseignants est dans le contrôleur
  resultatController.getAllResultats.bind(resultatController)
);
router.get(
  '/resultats/eleve/:eleveId',
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize(['Administrator', 'Teacher'], { model: db.Eleve, idParam: 'eleveId', ownershipRequired: true, ownerField: 'ecoleId', isOwner: async (auth, eleveId) => {
    const eleve = await db.Eleve.findByPk(eleveId);
    return eleve && eleve.ecoleId === auth.ecoleId;
  }}),
  resultatController.getResultatsByEleve.bind(resultatController)
);
router.get(
  '/resultats/annee/:anneeId',
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize(['Administrator', 'Teacher']), // Le filtrage par école pour les enseignants est dans le contrôleur
  resultatController.getResultatsByAnnee.bind(resultatController)
);
router.put(
  '/resultats/:eleveId/:anneeId', // Route pour clé primaire composite
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize(['Administrator']), // Seul l'administrateur peut mettre à jour un résultat
  Validator.middleware(Validator.resultatUpdateSchema),
  resultatController.updateResultat.bind(resultatController)
);
router.delete(
  '/resultats/:eleveId/:anneeId', // Route pour clé primaire composite
  AuthMiddleware.authenticate,
  AuthMiddleware.authorize(['Administrator']), // Seul l'administrateur peut supprimer un résultat
  resultatController.deleteResultat.bind(resultatController)
);

export default router;
