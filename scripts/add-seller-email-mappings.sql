-- Adiciona mapeamentos dos vendedores para os grupos corretos
-- Usa EMAIL como identificador (mais específico que telefone)
-- Execute este script no banco de produção APÓS rodar a migration

-- ========== PRIMEIRA MÃO - by SAGA (Uberlândia) ==========
DELETE FROM "SellerGroupMapping" WHERE "sellerEmail" = 'centraldeoportunidadesudi@gruposaga.com.br';

INSERT INTO "SellerGroupMapping" ("id", "sellerPhone", "sellerEmail", "sellerName", "groupJid", "groupName", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  NULL,
  'centraldeoportunidadesudi@gruposaga.com.br',
  'PRIMEIRA MÃO - by SAGA',
  '120363407822620700@g.us',
  'Primeira Mão by Saga',
  NOW(),
  NOW()
);

-- ========== Saga Off Road João Naves - Primeira Mão ==========
DELETE FROM "SellerGroupMapping" WHERE "sellerEmail" = 'keren.cdourado@gruposaga.com.br';

INSERT INTO "SellerGroupMapping" ("id", "sellerPhone", "sellerEmail", "sellerName", "groupJid", "groupName", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  NULL,
  'keren.cdourado@gruposaga.com.br',
  'Saga Off Road João Naves - Primeira Mão',
  '120363407822620700@g.us',
  'Primeira Mão by Saga',
  NOW(),
  NOW()
);

-- ========== Curinga Novos ==========
DELETE FROM "SellerGroupMapping" WHERE "sellerEmail" = 'marketing@curinga.com.br';

INSERT INTO "SellerGroupMapping" ("id", "sellerPhone", "sellerEmail", "sellerName", "groupJid", "groupName", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  NULL,
  'marketing@curinga.com.br',
  'Curinga Novos',
  '120363407922436757@g.us',
  'Curinga Novos',
  NOW(),
  NOW()
);

-- Verifica os resultados
SELECT * FROM "SellerGroupMapping" ORDER BY "createdAt" DESC;
