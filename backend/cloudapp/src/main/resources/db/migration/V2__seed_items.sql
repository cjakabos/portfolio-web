INSERT INTO item (name, price, description)
SELECT 'Round Widget', 2.99, 'A widget that is round'
WHERE NOT EXISTS (
    SELECT 1 FROM item WHERE name = 'Round Widget' AND description = 'A widget that is round'
);

INSERT INTO item (name, price, description)
SELECT 'Square Widget', 1.99, 'A widget that is square'
WHERE NOT EXISTS (
    SELECT 1 FROM item WHERE name = 'Square Widget' AND description = 'A widget that is square'
);
