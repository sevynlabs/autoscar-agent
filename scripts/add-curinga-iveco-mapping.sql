-- Mapeia o vendedor Curinga IVECO (Uberlândia/MG) para o grupo Curinga Iveco
-- Usa TELEFONE como identificador: o e-mail cadastrado (financeiro@autoscar.com.br)
-- é genérico do Autoscar e poderia casar com outras lojas.
-- Cadastro no portal Autoscar (API /user/6145):
--   Curinga IVECO -> user.id 6145 -> whatsapp 034991360474 -> normalizado 5534991360474
-- Execute este script no banco de produção

DELETE FROM "SellerGroupMapping" WHERE "sellerPhone" = '5534991360474';

INSERT INTO "SellerGroupMapping" ("id", "sellerPhone", "sellerEmail", "sellerName", "groupJid", "groupName", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  '5534991360474',
  NULL,
  'Curinga IVECO',
  '120363402766220561@g.us',
  'Curinga Iveco',
  NOW(),
  NOW()
);

-- Verifica o resultado (e se não existe mapeamento por e-mail que teria prioridade)
SELECT "sellerName", "sellerPhone", "sellerEmail", "groupJid", "groupName"
FROM "SellerGroupMapping"
WHERE "sellerPhone" = '5534991360474'
   OR "sellerEmail" = 'financeiro@autoscar.com.br';
