-- Lot 308 — coordonnées GPS des chefs-lieux de wilaya pour la carte des concessionnaires.
ALTER TABLE "Wilaya" ADD COLUMN "latitude" DOUBLE PRECISION;
ALTER TABLE "Wilaya" ADD COLUMN "longitude" DOUBLE PRECISION;

-- Coordonnées des 69 chefs-lieux de wilaya (découpage 2019 + loi 2026).
UPDATE "Wilaya" SET "latitude" = 27.8742, "longitude" = -0.2939 WHERE "id" = 1;  -- Adrar
UPDATE "Wilaya" SET "latitude" = 36.1647, "longitude" = 1.3317 WHERE "id" = 2;  -- Chlef
UPDATE "Wilaya" SET "latitude" = 33.8000, "longitude" = 2.8650 WHERE "id" = 3;  -- Laghouat
UPDATE "Wilaya" SET "latitude" = 35.8756, "longitude" = 7.1139 WHERE "id" = 4;  -- Oum El Bouaghi
UPDATE "Wilaya" SET "latitude" = 35.5569, "longitude" = 6.1742 WHERE "id" = 5;  -- Batna
UPDATE "Wilaya" SET "latitude" = 36.7508, "longitude" = 5.0567 WHERE "id" = 6;  -- Béjaïa
UPDATE "Wilaya" SET "latitude" = 34.8484, "longitude" = 5.7278 WHERE "id" = 7;  -- Biskra
UPDATE "Wilaya" SET "latitude" = 31.6167, "longitude" = -2.2167 WHERE "id" = 8;  -- Béchar
UPDATE "Wilaya" SET "latitude" = 36.4700, "longitude" = 2.8283 WHERE "id" = 9;  -- Blida
UPDATE "Wilaya" SET "latitude" = 36.3789, "longitude" = 3.9003 WHERE "id" = 10; -- Bouira
UPDATE "Wilaya" SET "latitude" = 22.7850, "longitude" = 5.5228 WHERE "id" = 11; -- Tamanrasset
UPDATE "Wilaya" SET "latitude" = 35.4042, "longitude" = 8.1244 WHERE "id" = 12; -- Tébessa
UPDATE "Wilaya" SET "latitude" = 34.8828, "longitude" = -1.3147 WHERE "id" = 13; -- Tlemcen
UPDATE "Wilaya" SET "latitude" = 35.3711, "longitude" = 1.3175 WHERE "id" = 14; -- Tiaret
UPDATE "Wilaya" SET "latitude" = 36.7117, "longitude" = 4.0453 WHERE "id" = 15; -- Tizi Ouzou
UPDATE "Wilaya" SET "latitude" = 36.7525, "longitude" = 3.0420 WHERE "id" = 16; -- Alger
UPDATE "Wilaya" SET "latitude" = 34.6704, "longitude" = 3.2500 WHERE "id" = 17; -- Djelfa
UPDATE "Wilaya" SET "latitude" = 36.8211, "longitude" = 5.7692 WHERE "id" = 18; -- Jijel
UPDATE "Wilaya" SET "latitude" = 36.1900, "longitude" = 5.4078 WHERE "id" = 19; -- Sétif
UPDATE "Wilaya" SET "latitude" = 34.8303, "longitude" = 0.1517 WHERE "id" = 20; -- Saïda
UPDATE "Wilaya" SET "latitude" = 36.8764, "longitude" = 6.9061 WHERE "id" = 21; -- Skikda
UPDATE "Wilaya" SET "latitude" = 35.1897, "longitude" = -0.6308 WHERE "id" = 22; -- Sidi Bel Abbès
UPDATE "Wilaya" SET "latitude" = 36.8972, "longitude" = 7.7653 WHERE "id" = 23; -- Annaba
UPDATE "Wilaya" SET "latitude" = 36.4622, "longitude" = 7.4264 WHERE "id" = 24; -- Guelma
UPDATE "Wilaya" SET "latitude" = 36.3650, "longitude" = 6.6147 WHERE "id" = 25; -- Constantine
UPDATE "Wilaya" SET "latitude" = 36.2675, "longitude" = 2.7539 WHERE "id" = 26; -- Médéa
UPDATE "Wilaya" SET "latitude" = 35.9311, "longitude" = 0.0892 WHERE "id" = 27; -- Mostaganem
UPDATE "Wilaya" SET "latitude" = 35.7054, "longitude" = 4.5421 WHERE "id" = 28; -- M'Sila
UPDATE "Wilaya" SET "latitude" = 35.3975, "longitude" = 0.1411 WHERE "id" = 29; -- Mascara
UPDATE "Wilaya" SET "latitude" = 31.9497, "longitude" = 5.3253 WHERE "id" = 30; -- Ouargla
UPDATE "Wilaya" SET "latitude" = 35.6969, "longitude" = -0.6331 WHERE "id" = 31; -- Oran
UPDATE "Wilaya" SET "latitude" = 33.6833, "longitude" = 1.0167 WHERE "id" = 32; -- El Bayadh
UPDATE "Wilaya" SET "latitude" = 26.5086, "longitude" = 8.4669 WHERE "id" = 33; -- Illizi
UPDATE "Wilaya" SET "latitude" = 36.0733, "longitude" = 4.7628 WHERE "id" = 34; -- Bordj Bou Arréridj
UPDATE "Wilaya" SET "latitude" = 36.7525, "longitude" = 3.4722 WHERE "id" = 35; -- Boumerdès
UPDATE "Wilaya" SET "latitude" = 36.7672, "longitude" = 8.3136 WHERE "id" = 36; -- El Tarf
UPDATE "Wilaya" SET "latitude" = 27.6744, "longitude" = -8.1478 WHERE "id" = 37; -- Tindouf
UPDATE "Wilaya" SET "latitude" = 35.6069, "longitude" = 1.8106 WHERE "id" = 38; -- Tissemsilt
UPDATE "Wilaya" SET "latitude" = 33.3561, "longitude" = 6.8675 WHERE "id" = 39; -- El Oued
UPDATE "Wilaya" SET "latitude" = 35.4344, "longitude" = 7.1428 WHERE "id" = 40; -- Khenchela
UPDATE "Wilaya" SET "latitude" = 36.2864, "longitude" = 7.9511 WHERE "id" = 41; -- Souk Ahras
UPDATE "Wilaya" SET "latitude" = 36.5908, "longitude" = 2.4469 WHERE "id" = 42; -- Tipaza
UPDATE "Wilaya" SET "latitude" = 36.4503, "longitude" = 6.2644 WHERE "id" = 43; -- Mila
UPDATE "Wilaya" SET "latitude" = 36.2640, "longitude" = 1.9690 WHERE "id" = 44; -- Aïn Defla
UPDATE "Wilaya" SET "latitude" = 33.2667, "longitude" = -0.3167 WHERE "id" = 45; -- Naâma
UPDATE "Wilaya" SET "latitude" = 35.2967, "longitude" = -1.1417 WHERE "id" = 46; -- Aïn Témouchent
UPDATE "Wilaya" SET "latitude" = 32.4900, "longitude" = 3.6700 WHERE "id" = 47; -- Ghardaïa
UPDATE "Wilaya" SET "latitude" = 35.7375, "longitude" = 0.5567 WHERE "id" = 48; -- Relizane
UPDATE "Wilaya" SET "latitude" = 29.2633, "longitude" = 0.2308 WHERE "id" = 49; -- Timimoun
UPDATE "Wilaya" SET "latitude" = 21.3253, "longitude" = 0.9564 WHERE "id" = 50; -- Bordj Badji Mokhtar
UPDATE "Wilaya" SET "latitude" = 34.4306, "longitude" = 5.0667 WHERE "id" = 51; -- Ouled Djellal
UPDATE "Wilaya" SET "latitude" = 30.1319, "longitude" = -2.1667 WHERE "id" = 52; -- Béni Abbès
UPDATE "Wilaya" SET "latitude" = 27.1928, "longitude" = 2.4672 WHERE "id" = 53; -- In Salah
UPDATE "Wilaya" SET "latitude" = 19.5683, "longitude" = 5.7722 WHERE "id" = 54; -- In Guezzam
UPDATE "Wilaya" SET "latitude" = 33.1000, "longitude" = 6.0667 WHERE "id" = 55; -- Touggourt
UPDATE "Wilaya" SET "latitude" = 24.5544, "longitude" = 9.4842 WHERE "id" = 56; -- Djanet
UPDATE "Wilaya" SET "latitude" = 33.9500, "longitude" = 5.9167 WHERE "id" = 57; -- El M'Ghair
UPDATE "Wilaya" SET "latitude" = 32.2833, "longitude" = 3.6333 WHERE "id" = 58; -- El Meniaa
UPDATE "Wilaya" SET "latitude" = 34.1128, "longitude" = 2.1022 WHERE "id" = 59; -- Aflou
UPDATE "Wilaya" SET "latitude" = 35.3831, "longitude" = 5.3650 WHERE "id" = 60; -- Barika
UPDATE "Wilaya" SET "latitude" = 34.9458, "longitude" = 5.7050 WHERE "id" = 61; -- El Kantara
UPDATE "Wilaya" SET "latitude" = 34.7453, "longitude" = 8.0556 WHERE "id" = 62; -- Bir El Ater
UPDATE "Wilaya" SET "latitude" = 34.8347, "longitude" = -1.2536 WHERE "id" = 63; -- El Aricha
UPDATE "Wilaya" SET "latitude" = 35.2186, "longitude" = 2.3178 WHERE "id" = 64; -- Ksar Chellala
UPDATE "Wilaya" SET "latitude" = 35.4536, "longitude" = 2.8800 WHERE "id" = 65; -- Aïn Ouessara
UPDATE "Wilaya" SET "latitude" = 34.1533, "longitude" = 3.5000 WHERE "id" = 66; -- Messaad
UPDATE "Wilaya" SET "latitude" = 35.8903, "longitude" = 2.7550 WHERE "id" = 67; -- Ksar El Boukhari
UPDATE "Wilaya" SET "latitude" = 35.2094, "longitude" = 4.1783 WHERE "id" = 68; -- Bou Saâda
UPDATE "Wilaya" SET "latitude" = 33.2333, "longitude" = 0.5500 WHERE "id" = 69; -- El Abiodh Sidi Cheikh
