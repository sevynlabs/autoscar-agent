-- Mapeia os vendedores Curinga JEEP e Curinga RAM (Catalão/GO) para o grupo de vendedores
-- Usa EMAIL como identificador (mais específico que telefone)
-- E-mails conforme cadastro no portal Autoscar (API /advertisement):
--   Curinga JEEP -> user.id 6129 -> propostar@autoscar.com.br
--   Curinga RAM  -> user.id 6130 -> hg.silvarp@gmail.com
-- Execute este script no banco de produção

-- ========== Curinga JEEP ==========
DELETE FROM "SellerGroupMapping" WHERE "sellerEmail" = 'propostar@autoscar.com.br';

INSERT INTO "SellerGroupMapping" ("id", "sellerPhone", "sellerEmail", "sellerName", "groupJid", "groupName", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  NULL,
  'propostar@autoscar.com.br',
  'Curinga JEEP',
  '120363430276531124@g.us',
  'Curinga Jeep/Ram',
  NOW(),
  NOW()
);

-- ========== Curinga RAM ==========
DELETE FROM "SellerGroupMapping" WHERE "sellerEmail" = 'hg.silvarp@gmail.com';

INSERT INTO "SellerGroupMapping" ("id", "sellerPhone", "sellerEmail", "sellerName", "groupJid", "groupName", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  NULL,
  'hg.silvarp@gmail.com',
  'Curinga RAM',
  '120363430276531124@g.us',
  'Curinga Jeep/Ram',
  NOW(),
  NOW()
);

-- Verifica os resultados
SELECT "sellerName", "sellerEmail", "groupJid", "groupName"
FROM "SellerGroupMapping"
WHERE "sellerEmail" IN ('propostar@autoscar.com.br', 'hg.silvarp@gmail.com');
