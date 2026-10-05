# Audit Bibl'ESI — sécurité, fiabilité et performance

Date : 31 août 2026. Audit en lecture seule des projets admin/public, du VPS et de PostgreSQL.

## Résumé

La base est saine et très légère : les tables Bibl'ESI font au plus 160 kB, les index utiles sont présents (ISBN, titre, prêts actifs, étudiant) et les services principaux sont démarrés. Les écritures anonymes sont bloquées par les règles RLS de PostgreSQL.

En revanche, le système n'est pas encore « parfait » : un rappel automatique échoue régulièrement, le site public ne livre pas ses en-têtes de sécurité, et une fonction e-mail non active est dangereuse si elle est remise en service telle quelle.

## À corriger en premier

### SEC-01 — Haute : fonction `send-email` non protégée si elle est activée

- Emplacement : `supabase/functions/send-email/index.ts:17-85`.
- Preuve : CORS ouvert à tous (`Access-Control-Allow-Origin: "*"`) et aucune vérification de session ou de rôle avant l'appel à Resend.
- Impact : si cette fonction est redéployée correctement dans cet état, une personne ayant la clé publique Supabase pourrait s'en servir comme relais d'e-mails.
- État actuel : le test sans destinataire retourne `500 InvalidWorkerCreation`, donc la fonction n'est pas actuellement opérationnelle. C'est un dysfonctionnement, pas une protection.
- Correction : exiger un JWT valide, vérifier `private.bibli_has_permission(...)`/un rôle admin, limiter les destinataires au domaine autorisé si approprié, appliquer un rate-limit serveur et limiter la taille des champs.

### OPS-01 — Haute : le worker de rappels perd régulièrement sa connexion à Supabase

- Emplacement : `deploy/supabase-proxy.conf:5-6` et `reminder-worker/reminder-worker.mjs:40-49`.
- Preuve : les journaux du proxy montrent des `connect() failed (111: Connection refused)` toutes les quinze minutes lors de la lecture des réglages de rappel.
- Impact : les rappels automatiques peuvent ne pas être envoyés, même si le conteneur est marqué « Up ».
- Correction : rendre la résolution Docker de `supabase-kong` dynamique dans Nginx (resolver Docker + variable `proxy_pass`) ou faire communiquer le worker directement par un endpoint interne fiable. Ajouter une alerte lorsque le worker échoue.

### SEC-02 — Moyenne : en-têtes de sécurité absents sur le site public en ligne

- Emplacement : `C:\Users\rayan\Desktop\bibli-esi-public\nginx.conf:10-32`.
- Preuve : le serveur définit les en-têtes globalement, mais les blocs `location` ajoutent leur propre `Cache-Control`, ce qui annule l'héritage Nginx. La réponse HTTPS publique ne contient ni `X-Frame-Options`, ni `X-Content-Type-Options`, ni `Referrer-Policy`, ni `Permissions-Policy`.
- Impact : protection moins bonne contre l'intégration dans une iframe, certains types MIME douteux et les fuites de referer.
- Correction : répéter ces en-têtes dans chaque bloc `location` ou les déclarer dans un fichier inclus. Ajouter ensuite une CSP réaliste après validation des domaines utilisés.

### SEC-03 — Moyenne : injection HTML possible dans la fenêtre d'impression

- Emplacement : `src/lib/print.js:7-35`, `src/lib/print.js:49-57`, `src/lib/print.js:76-98`.
- Preuve : des titres, auteurs, notes et noms sont interpolés dans `document.write(...)` sans échappement HTML.
- Impact : une donnée de livre ou une note contenant du HTML/JavaScript pourrait exécuter du code dans la fenêtre d'impression d'un administrateur.
- Correction : échapper systématiquement `&`, `<`, `>`, `"`, `'` avant l'impression, ou générer le document avec des nœuds DOM et `textContent`.

## À renforcer ensuite

### SEC-04 — Moyenne : données en attente conservées sur l'appareil

- Emplacement : `src/lib/offlineQueue.js:4-16, 71-89`.
- Preuve : Dexie conserve localement des actions et parfois des photos de cartes étudiantes tant que la synchronisation n'a pas réussi.
- Impact : sur un téléphone partagé ou perdu, ces données restent accessibles au profil navigateur local.
- Correction : afficher clairement les éléments en attente, supprimer automatiquement après succès/annulation, ne jamais conserver plus longtemps que nécessaire et ajouter un bouton « effacer les données locales » lors de la déconnexion.

### SEC-05 — Moyenne : absence de limitation générale au proxy

- Emplacement : `deploy/supabase-proxy.conf:1-15`.
- Preuve : aucune règle Nginx de limitation par IP. La recherche de livres a bien une limite applicative (`supabase/functions/bibli-book-lookup/index.ts:137-148`), mais ce n'est pas le cas général.
- Impact : plus de risques de tentatives répétées de connexion et d'appels coûteux vers Supabase.
- Correction : définir des zones `limit_req`/`limit_conn` adaptées pour l'authentification et les fonctions sensibles, sans bloquer les usages normaux.

### SEC-06 — Basse : droits SQL anonymes trop larges en apparence

- Preuve : le rôle `anon` possède encore des droits SQL INSERT/UPDATE/DELETE sur les tables `bibli_*`, mais les règles RLS les refusent réellement. Un test d'insertion anonyme a été bloqué par PostgreSQL.
- Impact : pas de fuite actuelle, mais la sécurité dépend exclusivement de RLS.
- Correction : retirer les droits d'écriture `anon` inutiles afin d'avoir deux protections indépendantes : droits SQL + RLS.

### DEV-01 — Moyenne pour le poste de développement : Vite vulnérable

- Emplacement : `package.json` des projets admin et public (`vite` 5.4.10).
- Preuve : `npm audit --omit=dev` remonte 1 alerte haute Vite et 1 alerte modérée esbuild. Elles concernent principalement le serveur de développement Windows, pas les conteneurs Nginx de production.
- Correction : planifier la mise à niveau de Vite, tester le build et les PWA avant de la publier.

## Performance et base de données

- PostgreSQL : les index nécessaires sont présents ; aucun index invalide n'a été observé.
- Taille : très faible actuellement, avec 143 Go de disque libre. Les pages sont rapides dans cet état.
- Ressources : les conteneurs Bibl'ESI consomment très peu. Le VPS dispose encore d'environ 6 Go de mémoire disponible, mais le swap est presque rempli ; il faut le surveiller sous charge.
- Limite à venir : plusieurs pages chargent actuellement tous les livres/étudiants/prêts avec `select("*")`, par exemple `src/pages/Dashboard.jsx:123-132`, `src/pages/Etudiants.jsx:335-340`, `src/pages/Prets.jsx:99-108` et `C:\Users\rayan\Desktop\bibli-esi-public\src/App.jsx:44-46`.
- Correction performance : avant d'atteindre beaucoup d'élèves/livres, passer à une pagination serveur, sélectionner uniquement les colonnes utiles et conserver les filtres/recherches côté PostgreSQL.

## Contrôles positifs confirmés

- HTTPS actif sur les deux sites.
- Admin : `nosniff`, anti-iframe, politique de referer et permissions navigateur sont bien livrés.
- PostgreSQL : RLS est activé sur toutes les tables Bibl'ESI contrôlées.
- Test réel : une insertion de livre avec le rôle anonyme est refusée par RLS.
- Les étudiants ne sont pas visibles au rôle anonyme ; le catalogue public reste lisible comme prévu.
- Les buckets privés pour les cartes étudiantes et les livres à identifier n'autorisent pas l'écriture anonyme.
- Les buckets publics (couvertures, vidéo d'accès) gardent l'écriture réservée aux comptes authentifiés ayant la permission adaptée.

## Priorité recommandée

1. Réparer la connexion du worker de rappels.
2. Protéger ou supprimer proprement `send-email`.
3. Corriger les en-têtes du site public et l'échappement de l'impression.
4. Ajouter le rate-limit et retirer les droits anonymes superflus.
5. Mettre à niveau Vite et préparer la pagination serveur.
