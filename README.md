# scolarix-api
API gestion statistique scolaire 
Module de Gestion des Utilisateurs
- **F1.1 : Gestion des comptes utilisateurs**
  - Création, modification, suppression des comptes (administrateurs, enseignants, parents, élèves).
  - Attributs : Identifiant (email ou matricule), mot de passe, rôle, nom, prénom.
- **F1.2 : Authentification sécurisée**
  - Connexion avec identifiant/mot de passe, support de l’authentification à deux facteurs (optionnel).
- **F1.3 : Gestion des rôles et permissions**
  - Rôles : Admin (accès total), Enseignant (saisie/consultation), Parent/Élève (consultation).
- **F1.4 : Profil utilisateur**
  - Modification des informations personnelles (ex. nom, email).

Module de Gestion des Élèves
- **F2.1 : Enregistrement des élèves**
  - Saisie des informations : Matricule, Nom, Prénoms, Genre, DESPS (optionnel), Code_Classe.
  - Importation en masse depuis Excel/CSV.
- **F2.2 : Gestion des classes**
  - Création, modification, suppression des classes (Nom_Classe, Niveau, Code_Année).
  - Assignation des élèves à une classe.
- **F2.3 : Recherche et filtrage**
  - Recherche par Matricule, Nom, Classe, Genre, ou Année Scolaire.
- **F2.4 : Historique des élèves**
  - Consultation des données historiques (classes, résultats) par année scolaire.

Module de Gestion des Évaluations
- **F3.1 : Création des évaluations**
  - Définition des évaluations : Code_Évaluation, Nom_Évaluation (ex. Lecture, Maths), Poids (ex. 10, 20).
- **F3.2 : Gestion des matières**
  - Regroupement des évaluations par matière (ex. Français inclut Lecture et Dictée).
- **F3.3 : Configuration des périodes**
  - Création des périodes : Code_Période, Nom_Période (ex. Mens.1, Compo Passage), Date, Type (Mensuelle, Progression), Code_Année.

Module de Saisie et Gestion des Notes
- **F4.1 : Saisie des notes**
  - Interface tableau pour saisir les notes par élève, évaluation, et période.
- **F4.2 : Importation des notes**
  - Importation depuis Excel/CSV avec validation des données.
- **F4.3 : Modification des notes**
  - Correction des notes avec journalisation (audit trail).
- **F4.4 : Validation des notes**
  - Vérification avant publication (ex. notes dans la plage du poids).

Module de Calcul et Gestion des Moyennes
- **F5.1 : Calcul automatique des moyennes**
  - Formule : Somme(Notes × Poids) / Somme(Poids) par période et élève.
- **F5.2 : Gestion des types de moyennes**
  - Stockage des moyennes : Mensuelle, Progression, Annuelle.
- **F5.3 : Affichage des moyennes**
  - Vue par élève, classe, ou période avec tri (ex. par moyenne décroissante).

Module de Gestion des Résultats
- **F6.1 : Attribution des décisions**
  - Statut Admis/Refusé basé sur un seuil (ex. moyenne ≥ 5/10).
- **F6.2 : Classement des élèves**
  - Calcul du rang de mérite par classe ou global, gestion des ex-aequo.
- **F6.3 : Statistiques des résultats**
  - Pourcentage d’admis/refusés par classe, genre, ou année scolaire.

Module de Consultation et Rapports
- **F7.1 : Consultation des notes et moyennes**
  - Vue personnalisée selon le rôle (ex. parents : notes de l’élève, enseignants : notes de la classe).
- **F7.2 : Génération de bulletins**
  - Bulletins PDF avec notes, moyennes, rang, et décision.
- **F7.3 : Tableaux de bord**
  - Visualisations graphiques (courbes de moyennes, diagrammes en secteurs).
- **F7.4 : Exportation des rapports**
  - Exportation en Excel, CSV, PDF.

Module de Notifications et Communication
- **F8.1 : Notifications automatiques**
  - Alertes pour enseignants (ex. délais de saisie) et parents (ex. nouveaux bulletins).
- **F8.2 : Messagerie intégrée**
  - Communication entre utilisateurs (ex. signaler une erreur dans une note).
- **F8.3 : Alertes de performance**
  - Notifications pour les élèves en difficulté (ex. moyenne < 5/10).

Module d’Administration
- **F9.1 : Gestion des années scolaires**
  - Création et archivage des années scolaires.
- **F9.2 : Sauvegarde et restauration**
  - Sauvegarde automatique, restauration des données.
- **F9.3 : Paramétrage des seuils**
  - Configuration des seuils (Admis/Refusé), poids des évaluations.
- **F9.4 : Audit des actions**
  - Journalisation des modifications (ex. notes, utilisateurs).

Module de Visualisation
- **F10.1 : Graphiques de performance**
  - Courbes de moyennes par période, histogrammes par matière.
- **F10.2 : Diagrammes de répartition**
  - Diagrammes en secteurs pour Admis/Refusés.

scolarix/
├── App/
│   ├── Controllers/
│   ├── Routes/
│   ├── Models/
│   ├── Middlewares/
│   ├── Utils/
│   ├── Config/
│   └── app.js
├── server.js
├── .env
├── logs/
└── package.json
