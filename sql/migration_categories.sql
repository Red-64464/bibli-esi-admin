-- ============================================================
-- Bibl'ESI – Migration catégories
-- Normalise toutes les catégories existantes vers la liste
-- officielle française. À exécuter dans l'éditeur SQL Supabase.
-- ============================================================

-- Réseaux & Télécoms
UPDATE livres SET categorie = 'Réseaux & Télécoms'
WHERE categorie ILIKE '%network%'
   OR categorie ILIKE '%telecom%'
   OR categorie ILIKE '%réseau%'
   OR categorie ILIKE '%reseaux%'
   OR categorie ILIKE '%télécommunication%';

-- Algorithmique
UPDATE livres SET categorie = 'Algorithmique'
WHERE categorie ILIKE '%algorithm%'
   OR categorie ILIKE '%algorithmique%'
   OR categorie = 'Algorithme'
   OR categorie ILIKE '%data structure%'
   OR categorie ILIKE '%structure de données%';

-- Bases de données
UPDATE livres SET categorie = 'Bases de données'
WHERE categorie ILIKE '%database%'
   OR categorie ILIKE '%base de donnée%'
   OR categorie ILIKE '%bases de donnée%'
   OR categorie ILIKE '%nosql%'
   OR categorie = 'Base de données';

-- Sécurité informatique
UPDATE livres SET categorie = 'Sécurité informatique'
WHERE categorie ILIKE '%security%'
   OR categorie ILIKE '%sécurité%'
   OR categorie ILIKE '%cryptograph%'
   OR categorie ILIKE '%cybersecurity%'
   OR categorie ILIKE '%cybersécurité%';

-- Systèmes d'exploitation
UPDATE livres SET categorie = 'Systèmes d''exploitation'
WHERE categorie ILIKE '%operating system%'
   OR categorie ILIKE '%système d''exploitation%'
   OR categorie ILIKE '%linux%'
   OR categorie ILIKE '%unix%';

-- Intelligence artificielle
UPDATE livres SET categorie = 'Intelligence artificielle'
WHERE categorie ILIKE '%artificial intelligence%'
   OR categorie ILIKE '%intelligence artificielle%'
   OR categorie ILIKE '%machine learning%'
   OR categorie ILIKE '%deep learning%'
   OR categorie ILIKE '%apprentissage automatique%'
   OR categorie ILIKE '%neural network%';

-- Développement Web
UPDATE livres SET categorie = 'Développement Web'
WHERE categorie ILIKE '%web development%'
   OR categorie ILIKE '%développement web%'
   OR categorie ILIKE '%developpement web%'
   OR categorie ILIKE '%internet application%'
   OR categorie ILIKE '%application web%';

-- Génie logiciel
UPDATE livres SET categorie = 'Génie logiciel'
WHERE categorie ILIKE '%software engineering%'
   OR categorie ILIKE '%génie logiciel%'
   OR categorie ILIKE '%genie logiciel%'
   OR categorie ILIKE '%software development%';

-- Architecture des ordinateurs
UPDATE livres SET categorie = 'Architecture des ordinateurs'
WHERE categorie ILIKE '%computer architecture%'
   OR categorie ILIKE '%architecture des ordinateurs%'
   OR categorie ILIKE '%microprocessor%'
   OR categorie ILIKE '%microprocesseur%'
   OR categorie ILIKE '%embedded system%'
   OR categorie ILIKE '%système embarqué%';

-- Programmation
UPDATE livres SET categorie = 'Programmation'
WHERE categorie ILIKE '%programming%'
   OR categorie ILIKE '%programmation%'
   OR categorie ILIKE '%coding%'
   OR categorie ILIKE '%programming language%'
   OR categorie ILIKE '%langage de programmation%';

-- Électronique
UPDATE livres SET categorie = 'Électronique'
WHERE categorie ILIKE '%electronic%'
   OR categorie ILIKE '%électronique%'
   OR categorie ILIKE '%electronique%'
   OR categorie ILIKE '%signal processing%'
   OR categorie ILIKE '%traitement du signal%';

-- Mathématiques
UPDATE livres SET categorie = 'Mathématiques'
WHERE categorie ILIKE '%mathemat%'
   OR categorie ILIKE '%mathématique%'
   OR categorie ILIKE '%mathematique%'
   OR categorie ILIKE '%algebra%'
   OR categorie ILIKE '%algèbre%'
   OR categorie ILIKE '%calculus%'
   OR categorie ILIKE '%statistic%'
   OR categorie ILIKE '%statistique%'
   OR categorie ILIKE '%probabilit%'
   OR categorie = 'Mathématiques';

-- Physique
UPDATE livres SET categorie = 'Physique'
WHERE categorie ILIKE '%physic%'
   OR categorie ILIKE '%physique%'
   OR categorie ILIKE '%mechanic%'
   OR categorie ILIKE '%thermodynamic%'
   OR categorie ILIKE '%quantum%';

-- Économie & Gestion
UPDATE livres SET categorie = 'Économie & Gestion'
WHERE categorie ILIKE '%econom%'
   OR categorie ILIKE '%business%'
   OR categorie ILIKE '%management%'
   OR categorie ILIKE '%finance%'
   OR categorie ILIKE '%gestion%'
   OR categorie ILIKE '%comptabilit%';

-- Langue & Communication
UPDATE livres SET categorie = 'Langue & Communication'
WHERE categorie ILIKE '%language arts%'
   OR categorie ILIKE '%linguist%'
   OR categorie ILIKE '%communication%'
   OR categorie ILIKE '%writing%'
   OR categorie ILIKE '%expression écrite%';

-- Littérature
UPDATE livres SET categorie = 'Littérature'
WHERE categorie ILIKE '%fiction%'
   OR categorie ILIKE '%literary%'
   OR categorie ILIKE '%literature%'
   OR categorie ILIKE '%littérature%'
   OR categorie ILIKE '%poésie%'
   OR categorie ILIKE '%poesie%';

-- Informatique générale (catch-all pour le reste des entrées "computers/...")
-- Doit être avant "Sciences" et "Technologie" pour ne pas écraser les cas ci-dessus
UPDATE livres SET categorie = 'Informatique générale'
WHERE (categorie ILIKE '%computer%' OR categorie ILIKE '%informatique%')
  AND categorie NOT IN (
    'Réseaux & Télécoms', 'Algorithmique', 'Bases de données',
    'Sécurité informatique', 'Systèmes d''exploitation',
    'Intelligence artificielle', 'Développement Web', 'Génie logiciel',
    'Architecture des ordinateurs', 'Programmation', 'Électronique'
  );

-- Technologie & Ingénierie
UPDATE livres SET categorie = 'Technologie & Ingénierie'
WHERE (categorie ILIKE '%technolog%' OR categorie ILIKE '%engineering%' OR categorie ILIKE '%ingénierie%')
  AND categorie NOT IN (
    'Réseaux & Télécoms', 'Algorithmique', 'Bases de données',
    'Sécurité informatique', 'Systèmes d''exploitation',
    'Intelligence artificielle', 'Développement Web', 'Génie logiciel',
    'Architecture des ordinateurs', 'Programmation', 'Électronique',
    'Informatique générale'
  );

-- Sciences (catch-all)
UPDATE livres SET categorie = 'Sciences'
WHERE categorie ILIKE '%science%'
  AND categorie NOT IN (
    'Réseaux & Télécoms', 'Algorithmique', 'Bases de données',
    'Sécurité informatique', 'Systèmes d''exploitation',
    'Intelligence artificielle', 'Développement Web', 'Génie logiciel',
    'Architecture des ordinateurs', 'Programmation', 'Électronique',
    'Mathématiques', 'Physique', 'Informatique générale',
    'Technologie & Ingénierie'
  );

-- Tout ce qui reste et qui n'est pas déjà une catégorie officielle → "Autre"
UPDATE livres SET categorie = 'Autre'
WHERE categorie IS NOT NULL
  AND categorie NOT IN (
    'Algorithmique', 'Architecture des ordinateurs', 'Bases de données',
    'Développement Web', 'Électronique', 'Génie logiciel',
    'Informatique générale', 'Intelligence artificielle', 'Mathématiques',
    'Physique', 'Programmation', 'Réseaux & Télécoms',
    'Sécurité informatique', 'Systèmes d''exploitation',
    'Économie & Gestion', 'Langue & Communication', 'Littérature',
    'Sciences', 'Technologie & Ingénierie', 'Autre'
  )
  AND categorie <> '';

-- Aperçu des catégories après migration
SELECT categorie, COUNT(*) as nb_livres
FROM livres
GROUP BY categorie
ORDER BY nb_livres DESC;
